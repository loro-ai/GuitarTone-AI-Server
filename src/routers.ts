import { z } from "zod";
import { nanoid } from "nanoid";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { invokeLLM, parseJSON } from "./_core/llm";
import { hashPassword, verifyPassword, createSessionToken } from "./_core/sdk";
import * as db from "./db";
import { ENV } from "./_core/env";

// ─── Tipos para integración n8n ───────────────────────────────────────────────

type GearConfigRaw = {
  gearId: string;
  gearNombre: string;
  gearTipo: string;
  parametros: Record<string, unknown>;
};

type N8nPresetResponse = {
  success: boolean;
  configuracion_base: GearConfigRaw[];
  presetsData: Array<{
    nombre: string;
    tag?: string;
    etiqueta?: string;
    descripcion_corta?: string;
    momento_cancion: string;
    efecto_principal?: string;
    descripcion: string;
    explicacion?: string;
    configuracion: GearConfigRaw[];
    nota_tecnica?: string;
    consejos?: string[];
  }>;
  advertencia?: string;
  error?: string;
};

// ─── n8n Preset Generator ─────────────────────────────────────────────────────

async function callN8nPresetGenerator(payload: {
  song: import("./models/Song").ISong;
  gear: import("./models/Gear").IGear[];
  userId: string;
  songDbId: string;
}): Promise<N8nPresetResponse> {
  const webhookUrl = ENV.n8nWebhookUrlV2 || ENV.n8nWebhookUrl;

  if (!webhookUrl) {
    console.warn("[n8n] N8N_WEBHOOK_URL_V2 y N8N_WEBHOOK_URL no configurados — usando fallback OpenAI directo");
    throw new Error("N8N_FALLBACK");
  }

  console.log(`[n8n] Usando ${ENV.n8nWebhookUrlV2 ? "Orchestrator v2" : "Preset Generator v1"}: ${webhookUrl}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-webhook-secret": ENV.n8nWebhookSecret,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "sin detalle");
      throw new Error(`n8n respondió con status ${response.status}: ${errorText}`);
    }

    const data = await response.json() as N8nPresetResponse;

    if (!data.success) {
      throw new Error(`n8n reportó error: ${data.error || "error desconocido"}`);
    }

    if (!data.presetsData) {
      throw new Error("n8n retornó respuesta sin estructura válida");
    }
    if (data.presetsData.length === 0 && (!data.configuracion_base || data.configuracion_base.length === 0)) {
      throw new Error("n8n retornó presets y configuración base vacíos");
    }

    console.log(`[n8n] Presets generados: ${data.presetsData.length} sección(es) — songDbId: ${payload.songDbId}`);
    return data;

  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw new Error("n8n timeout: generación superó 90 segundos");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const searchSongSchema = z.object({
  title: z.string().min(1),
  artist: z.string().min(1),
});

const gearSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["pedalera", "amplificador", "guitarra", "procesador", "otro"]),
  brand: z.string().optional(),
  model: z.string().optional(),
  specs: z.record(z.string(), z.unknown()).optional(),
});

const generatePresetSchema = z.object({
  songId: z.string().min(1),
  gearIds: z.array(z.string().min(1)),
});

const generatePresetFromSongSchema = z.object({
  musicBrainzId: z.string(),
  title: z.string(),
  artist: z.string(),
  coverUrl: z.string().optional(),
  gearIds: z.array(z.string().min(1)),
});

// ─── Deezer ───────────────────────────────────────────────────────────────────

type DeezerTrack = {
  id: number;
  title: string;
  artist: { name: string };
  album: { title: string; cover_medium?: string };
};

async function searchDeezer(title: string, artist: string): Promise<DeezerTrack[]> {
  try {
    const url = new URL("https://api.deezer.com/search");
    url.searchParams.set("q", `${title} ${artist}`);
    url.searchParams.set("limit", "5");

    const response = await fetch(url.toString());
    if (!response.ok) throw new Error("Deezer API error");

    const data = (await response.json()) as { data?: DeezerTrack[] };
    return data.data || [];
  } catch (error) {
    console.error("[Deezer] Search error:", error);
    return [];
  }
}

async function getDeezerTrackById(id: string): Promise<DeezerTrack | null> {
  try {
    const response = await fetch(`https://api.deezer.com/track/${id}`);
    if (!response.ok) return null;
    return (await response.json()) as DeezerTrack;
  } catch {
    return null;
  }
}

// ─── Songs Router ─────────────────────────────────────────────────────────────

const songsRouter = router({
  search: publicProcedure.input(searchSongSchema).query(async ({ input }) => {
    // 1. Buscar en Deezer
    const deezerResults = await searchDeezer(input.title, input.artist);
    if (deezerResults.length === 0) return [];

    // 2. Para cada resultado, verificar si ya existe en la BD (sin crearla)
    const enriched = await Promise.all(deezerResults.map(async (r) => {
      const existing = await db.getSongByTitleAndArtist(r.title, r.artist.name);
      return {
        id: String(r.id),
        musicBrainzId: String(r.id),
        title: r.title,
        artist: r.artist.name,
        coverUrl: r.album.cover_medium,
        hasToneResearch: !!existing?.toneResearch?.researchedAt,
      };
    }));

    // 3. Opcional: eliminar duplicados por título+artista si Deezer devolvió varios
    //    (aunque la API no suele hacerlo, por seguridad)
    const unique = new Map<string, typeof enriched[0]>();
    for (const item of enriched) {
      const key = `${item.title}|${item.artist}`.toLowerCase();
      if (!unique.has(key)) unique.set(key, item);
    }

    return Array.from(unique.values());
  }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const track = await getDeezerTrackById(input.id);
      if (!track) return null;
      return {
        id: String(track.id),
        title: track.title,
        artist: track.artist.name,
        coverUrl: track.album.cover_medium,
      };
    }),

  researchTone: publicProcedure
    .input(
      z.object({
        musicBrainzId: z.string(),
        title: z.string(),
        artist: z.string(),
        coverUrl: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      // Crear/obtener la canción (busca primero por título+artista)
      const song = await db.createOrGetSong({
        musicBrainzId: input.musicBrainzId,
        title: input.title,
        artist: input.artist,
        coverUrl: input.coverUrl,
      });

      // Si ya tiene investigación, retornar desde cache
      if (song.toneResearch?.researchedAt) {
        console.log("[researchTone] Cache hit para:", input.title);
        return { success: true, data: song.toneResearch, songDbId: String(song._id) };
      }

      const systemPrompt = `Eres un experto en gear de guitarra con acceso a internet.
Investiga el tono REAL y VERIFICADO de la canción "${input.title}" de "${input.artist}".

PRIORIDAD DE FUENTES:
1. Videos de Rig Rundown en YouTube (Premier Guitar, Reverb.com)
2. Guitar World, Premier Guitar, Ultimate Guitar
3. Equipboard.com
4. Foros de guitarristas (Reddit r/Guitar, TalkBass, etc.)
5. Entrevistas oficiales con el artista

REGLAS CRÍTICAS — NUNCA violar:
- Si la canción suena LIMPIA (clean/jangle/fingerpicking), "es_tocado_limpio" DEBE ser true y "nivel_distorsion" DEBE ser "clean"
- NO inventes efectos. Si no encuentras información verificada, indica "sin información verificada"
- Distingue entre el tono del artista EN ESA CANCIÓN ESPECÍFICA vs su tono general
- Muchas canciones acústicas/country/folk son 100% clean — no asumas distorsión
- ANALIZA LA ESTRUCTURA REAL DE LA CANCIÓN: identifica secciones (intro, verso, coro, puente, solo) y cómo cambia el tono en cada una

Responde SOLO con este JSON (sin markdown):
{
  "efectos": [{"nombre": "Nombre exacto del pedal/efecto", "marca": "Marca fabricante", "modelo": "Modelo exacto", "tipo": "distorsion|overdrive|fuzz|reverb|delay|chorus|flanger|phaser|wah|comp|eq|boost|tremolo|vibrato|pitch|octave|clean", "posicion": "posicion en la cadena"}],
  "amplificador": {"marca": "...", "modelo": "...", "configuracion": "descripcion de EQ y ganancia"},
  "guitarra": {"marca": "...", "modelo": "...", "pastillas": "tipo de pastillas"},
  "cadena_senal": ["guitarra", "efecto1", "amplificador"],
  "tecnica": "descripcion de la tecnica de toque (fingerpicking, plectro, slide, etc.)",
  "nivel_distorsion": "clean|light-crunch|crunch|high-gain|heavy",
  "es_tocado_limpio": true,
  "fuente_verificada": "URL o descripción de dónde se encontró la info",
  "notas": "datos adicionales importantes sobre el tono (EQ, compresion, efectos clave)",
  "estructura": [
    {
      "seccion": "intro|verso|coro|pre-coro|estribillo|puente|bridge|solo|outro|ending|riff|interludio|interlude|breakdown|hook|refrain|climax",
      "dinamica": "pp|p|mp|mf|f|ff",
      "nivel_distorsion": "clean|light-crunch|crunch|high-gain|heavy",
      "efectos_clave": ["nombre del efecto activo en esta seccion"],
      "gain_relativo": 1,
      "tecnica": "tecnica especifica de esta seccion",
      "notas": "cambios tonales respecto a la seccion anterior"
    }
  ]
}`;

      try {
        const result = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `Busca específicamente: "${input.title} ${input.artist} guitar pedals tone" y "${input.artist} rig rundown ${input.title}". Necesito el gear EXACTO usado en ESA canción, no el arsenal general del artista.`,
            },
          ],
          responseFormat: { type: "json" },
          useWebSearch: true,
        });

        const researchData = parseJSON<{
          efectos?: Array<{ nombre: string; marca?: string; modelo?: string; tipo: string; posicion?: string }>;
          amplificador?: { marca?: string; modelo?: string; configuracion?: string };
          guitarra?: { marca?: string; modelo?: string; pastillas?: string };
          cadena_senal?: string[];
          tecnica?: string;
          nivel_distorsion?: string;
          es_tocado_limpio?: boolean;
          fuente_verificada?: string;
          notas?: string;
          estructura?: Array<{ seccion: string; dinamica?: string; nivel_distorsion?: string; efectos_clave?: string[]; gain_relativo?: number; tecnica?: string; notas?: string }>;
        }>(result.content);

        const toneResearch = {
          equipment: researchData.efectos || [],
          amplificador: researchData.amplificador || {},
          guitarra: researchData.guitarra || {},
          cadenaSenal: researchData.cadena_senal || [],
          techniques: researchData.tecnica ? [researchData.tecnica] : [],
          notes: researchData.notas || "",
          nivelDistorsion: researchData.nivel_distorsion,
          esTocadoLimpio: researchData.es_tocado_limpio,
          estructura: Array.isArray(researchData.estructura) ? researchData.estructura : [],
          researchedAt: new Date(),
        };

        await db.updateSongToneResearch(String(song._id), toneResearch);

        return {
          success: true,
          data: toneResearch,
          songDbId: String(song._id),
        };
      } catch (error) {
        console.error("[LLM] researchTone error:", error);
        return { success: false, error: "Error investigando el tono", songDbId: String(song._id) };
      }
    }),

  generatePreset: publicProcedure
    .input(generatePresetFromSongSchema)
    .mutation(async ({ ctx, input }) => {
      // ── Paso 1: Crear o recuperar la canción ──────────────────────────
      const song = await db.createOrGetSong({
        musicBrainzId: input.musicBrainzId,
        title: input.title,
        artist: input.artist,
        coverUrl: input.coverUrl,
      });

      const songDbId = String(song._id);

      // ── Paso 2: Investigar el tono (con cache) ────────────────────────
      let toneResearch = song.toneResearch?.researchedAt
        ? song.toneResearch
        : null;

      if (!toneResearch) {
        console.log(`[generatePreset] Investigando gear del artista: ${input.artist} — ${input.title}`);

        const researchSystemPrompt = `Eres un experto en gear de guitarra eléctrica con acceso a internet.
Investiga el equipo EXACTO y VERIFICADO que usa el artista en la canción especificada.

PRIORIDAD DE FUENTES:
1. Videos de Rig Rundown (Premier Guitar, Reverb.com)
2. Guitar World, Premier Guitar, Ultimate Guitar
3. Equipboard.com
4. Entrevistas oficiales con el artista
5. Foros especializados (Reddit r/Guitar, TalkBass, The Gear Page)

REGLAS CRÍTICAS:
- Investiga el gear usado EN ESA CANCIÓN ESPECÍFICA, no el gear general del artista.
- Si la canción es limpia (clean/jangle/fingerpicking/acústica): "es_tocado_limpio" DEBE ser true y "nivel_distorsion" DEBE ser "clean".
- NO inventes efectos. Si no hay información verificada para un campo, usa null.
- Documenta CADA pedal, procesador y efecto por separado en el array de efectos.
- Incluye la posición en la cadena de señal si se conoce.
- ANALIZA LA ESTRUCTURA REAL DE LA CANCIÓN: identifica secciones (intro, verso, coro, puente, solo) y cómo cambia el tono/dinámica en cada una.

Responde SOLO con este JSON (sin markdown):
{
  "efectos": [
    {
      "nombre": "Nombre exacto del pedal/efecto",
      "marca": "Marca del fabricante",
      "modelo": "Modelo exacto",
      "tipo": "distorsion|overdrive|fuzz|reverb|delay|chorus|flanger|phaser|wah|comp|eq|boost|tremolo|vibrato|pitch|octave|clean",
      "posicion": "número o descripción de posición en la cadena"
    }
  ],
  "amplificador": {
    "marca": "Marca exacta",
    "modelo": "Modelo exacto",
    "configuracion": "Descripción de EQ y ganancia usados en esta canción"
  },
  "guitarra": {
    "marca": "Marca exacta",
    "modelo": "Modelo exacto",
    "pastillas": "Tipo de pastillas (single coil, humbucker, P90, etc.)"
  },
  "cadena_senal": ["guitarra", "pedal1", "pedal2", "amplificador"],
  "tecnica": "Descripción detallada de la técnica (fingerpicking, plectro duro/suave, slide, palm muting, etc.)",
  "nivel_distorsion": "clean|light-crunch|crunch|high-gain|heavy",
  "es_tocado_limpio": false,
  "fuente_verificada": "URL o descripción de la fuente consultada",
  "notas": "Información adicional clave sobre el tono: afinación, configuración especial, detalles de EQ, etc.",
  "estructura": [
    {
      "seccion": "intro|verso|coro|pre-coro|estribillo|puente|bridge|solo|outro|ending|riff|interludio|interlude|breakdown|hook|refrain|climax",
      "dinamica": "pp|p|mp|mf|f|ff",
      "nivel_distorsion": "clean|light-crunch|crunch|high-gain|heavy",
      "efectos_clave": ["nombre del efecto activo en esta seccion"],
      "gain_relativo": 1,
      "tecnica": "tecnica especifica en esta seccion (palm muting, strumming abierto, etc.)",
      "notas": "cambios tonales respecto a la seccion anterior"
    }
  ]
}`;

        try {
          const result = await invokeLLM({
            messages: [
              { role: "system", content: researchSystemPrompt },
              {
                role: "user",
                content: `Busca específicamente: "${input.title} ${input.artist} guitar pedals tone" y "${input.artist} rig rundown ${input.title}". Necesito el gear EXACTO usado en ESA canción, no el arsenal general del artista.`,
              },
            ],
            responseFormat: { type: "json" },
            useWebSearch: true,
          });

          const researchData = parseJSON<{
            efectos?: Array<{ nombre: string; marca?: string; modelo?: string; tipo: string; posicion?: string }>;
            amplificador?: { marca?: string; modelo?: string; configuracion?: string };
            guitarra?: { marca?: string; modelo?: string; pastillas?: string };
            cadena_senal?: string[];
            tecnica?: string;
            nivel_distorsion?: string;
            es_tocado_limpio?: boolean;
            fuente_verificada?: string;
            notas?: string;
            estructura?: Array<{ seccion: string; dinamica?: string; nivel_distorsion?: string; efectos_clave?: string[]; gain_relativo?: number; tecnica?: string; notas?: string }>;
          }>(result.content);

          toneResearch = {
            equipment: researchData.efectos || [],
            amplificador: researchData.amplificador || {},
            guitarra: researchData.guitarra || {},
            cadenaSenal: researchData.cadena_senal || [],
            techniques: researchData.tecnica ? [researchData.tecnica] : [],
            notes: researchData.notas || "",
            nivelDistorsion: researchData.nivel_distorsion,
            esTocadoLimpio: researchData.es_tocado_limpio,
            estructura: Array.isArray(researchData.estructura) ? researchData.estructura : [],
            researchedAt: new Date(),
          };

          await db.updateSongToneResearch(songDbId, toneResearch);
          console.log(`[generatePreset] Tono investigado y cacheado para: ${input.title}`);

        } catch (researchError) {
          console.error("[generatePreset] Error investigando tono:", researchError);
          toneResearch = {
            equipment: [],
            amplificador: {},
            guitarra: {},
            cadenaSenal: [],
            techniques: [],
            notes: "No se pudo investigar el tono. n8n generará presets basados solo en el equipo del usuario.",
            nivelDistorsion: undefined,
            esTocadoLimpio: undefined,
            estructura: [],
            researchedAt: new Date(),
          };
        }
      } else {
        console.log(`[generatePreset] Cache hit — tono ya investigado para: ${input.title}`);
      }

      // ── Paso 3: Recuperar gear del usuario ───────────────────────────
      const gearList = await Promise.all(input.gearIds.map((id) => db.getGearById(id)));
      const validGear = gearList.filter(Boolean) as NonNullable<(typeof gearList)[number]>[];

      if (validGear.length === 0) {
        throw new Error("No se encontró el equipo seleccionado");
      }

      // ── Paso 4: Llamar a n8n ─────────────────────────────────────────
      const songWithTone = { ...song, toneResearch };

      let presetsData: N8nPresetResponse;

      try {
        presetsData = await callN8nPresetGenerator({
          song: songWithTone,
          gear: validGear,
          userId: String((ctx as any)?.user?._id || (ctx as any)?.user?.openId || "anonymous"),
          songDbId,
        });
      } catch (n8nError) {
        if ((n8nError as Error).message === "N8N_FALLBACK") {
          console.warn("[generatePreset] Fallback OpenAI — configurar N8N_WEBHOOK_URL");
          const tr = songWithTone.toneResearch;
          const toneCtx = tr ? [
            `GANANCIA: ${tr.nivelDistorsion ?? "no especificado"}`,
            `LIMPIO: ${tr.esTocadoLimpio ? "SÍ — DRIVE OFF + GAIN ≤ 3" : "No"}`,
            `CADENA: ${tr.cadenaSenal?.join(" → ") || "no especificada"}`,
            `AMP: ${tr.amplificador ? `${(tr.amplificador as any).marca ?? ""} ${(tr.amplificador as any).modelo ?? ""}`.trim() : "no especificado"}`,
            `NOTAS: ${tr.notes || "ninguna"}`,
          ].join("\n") : "Sin datos.";
          const staticGear  = validGear.filter(g => g.type === "amplificador" || g.type === "guitarra");
          const dynamicGear = validGear.filter(g => g.type !== "amplificador" && g.type !== "guitarra");
          const fallbackPrompt = `Eres un técnico de sonido experto. Genera presets COMPLETOS con valores EXACTOS.\nCANCIÓN: ${input.title} — ${input.artist}\nTONO:\n${toneCtx}\nEQUIPO:\n${validGear.map((g, i) => `[EQUIPO ${i+1}] gearId:${g._id} | ${g.brand} ${g.model} | type:${g.type}`).join("\n")}\nREGLA: AMPLIFICADORES/GUITARRAS → configuracion_base. PEDALERAS → presetsData.\nEstático: ${staticGear.map(g => `gearId:${g._id} = ${g.brand} ${g.model} (${g.type})`).join(", ") || "ninguno"}\nDinámico: ${dynamicGear.map(g => `gearId:${g._id} = ${g.brand} ${g.model} (${g.type})`).join(", ") || "ninguno"}\nMÁXIMO 3 presets. Nombres "A0","A1","A2". Valores numéricos. Si esTocadoLimpio=true: DRIVE OFF.\nResponde SOLO con JSON:\n{"configuracion_base":[],"presets":[],"advertencia":null}`;
          const fbResult = await invokeLLM({
            messages: [
              { role: "system", content: fallbackPrompt },
              { role: "user", content: `Genera presets para "${input.title}" de ${input.artist}.` },
            ],
            responseFormat: { type: "json" },
            useWebSearch: false,
          });
          const fbData = parseJSON<{ configuracion_base?: GearConfigRaw[]; presets: Array<{ nombre: string; momento_cancion: string; descripcion: string; configuracion: GearConfigRaw[]; nota_tecnica?: string; consejos?: string[] }>; advertencia?: string }>(fbResult.content);
          const gearIdMap: Record<string, string> = {};
          validGear.forEach((g, idx) => { gearIdMap[`equipo_${idx + 1}`] = String(g._id); });
          const mapId = (c: GearConfigRaw) => ({ ...c, gearId: gearIdMap[c.gearId] ?? c.gearId });
          presetsData = {
            success: true,
            configuracion_base: (fbData.configuracion_base || []).map(mapId),
            presetsData: (fbData.presets || []).map(p => ({ ...p, configuracion: (p.configuracion || []).map(mapId) })),
            advertencia: fbData.advertencia,
          };
        } else {
          throw n8nError;
        }
      }

      // ── Paso 5: Guardar preset en MongoDB ────────────────────────────
      const preset = await db.createPreset({
        userId: String((ctx as any)?.user?._id || (ctx as any)?.user?.openId || "anonymous"),
        songId: songDbId,
        songTitle: input.title,
        songArtist: input.artist,
        gearIds: input.gearIds,
        configuracion_base: presetsData.configuracion_base || [],
        presetsData: presetsData.presetsData,
        advertencia: presetsData.advertencia,
        isFavorite: false,
      });

      await db.addSearchHistory({
        userId: String((ctx as any)?.user?._id || (ctx as any)?.user?.openId || "anonymous"),
        musicBrainzId: input.musicBrainzId,
        title: input.title,
        artist: input.artist,
        coverUrl: input.coverUrl,
      });

      return {
        success: true,
        preset,
        toneResearch,
        songDbId,
      };
    }),
});

// ─── Gear Router ──────────────────────────────────────────────────────────────

const gearRouter = router({
  list: protectedProcedure.query(({ ctx }) =>
    db.getUserGear(String(ctx.user._id || ctx.user.openId))
  ),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => db.getGearById(input.id)),

  create: protectedProcedure
    .input(gearSchema)
    .mutation(async ({ ctx, input }) => {
      const gear = await db.createGear(String(ctx.user._id || ctx.user.openId), {
        ...input,
        isDefault: false,
      });

      return gear;
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string(), data: gearSchema.partial() }))
    .mutation(({ input }) => db.updateGear(input.id, input.data)),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => db.deleteGear(input.id)),

  setDefault: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = String(ctx.user._id || ctx.user.openId);
      const userGear = await db.getUserGear(userId);
      for (const g of userGear) {
        if (g.isDefault) await db.updateGear(String(g._id), { isDefault: false });
      }
      return db.updateGear(input.id, { isDefault: true });
    }),

  getSpecs: protectedProcedure
    .input(z.object({
      gearId: z.string(),
      brand: z.string(),
      model: z.string(),
      type: z.string(),
    }))
    .query(async ({ input }) => {
      const N8N_BASE = (ENV.n8nWebhookUrl || ENV.n8nWebhookUrlV2)?.replace(/\/webhook\/.*$/, '');
      const webhookUrl = N8N_BASE ? `${N8N_BASE}/webhook/guitartone-gear-specsv2` : undefined;
      if (!webhookUrl) return { success: false, specs: null };

      try {
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-webhook-secret': ENV.n8nWebhookSecret || '',
          },
          body: JSON.stringify({
            gearId: input.gearId,
            brand: input.brand,
            model: input.model,
            type: input.type,
          }),
          signal: AbortSignal.timeout(8000),
        });

        if (!response.ok) return { success: false, specs: null };
        const data = await response.json() as { success: boolean; specs: Record<string, unknown> };
        return { success: true, specs: data.specs || null };
      } catch {
        return { success: false, specs: null };
      }
    }),
});

// ─── Presets Router ───────────────────────────────────────────────────────────

const presetsRouter = router({
  list: protectedProcedure.query(({ ctx }) =>
    db.getUserPresets(String(ctx.user._id || ctx.user.openId))
  ),

  favorites: protectedProcedure.query(({ ctx }) =>
    db.getUserFavoritePresets(String(ctx.user._id || ctx.user.openId))
  ),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const preset = await db.getPresetById(input.id);
      const userId = String(ctx.user._id || ctx.user.openId);
      return preset?.userId === userId ? preset : null;
    }),

  generate: protectedProcedure
    .input(generatePresetSchema)
    .mutation(async ({ ctx, input }) => {
      const song = await db.getSongById(input.songId);
      if (!song) throw new Error("Canción no encontrada");

      const gearList = await Promise.all(input.gearIds.map((id) => db.getGearById(id)));
      let validGear = gearList.filter(Boolean) as NonNullable<(typeof gearList)[number]>[];

      if (validGear.length === 0) throw new Error("No se encontró el equipo seleccionado");

      // ── Construir contexto del tono original ────────────────────────────
      const tr = song.toneResearch;
      const toneContext = tr
        ? [
            `NIVEL DE GANANCIA: ${tr.nivelDistorsion ?? "no especificado"}`,
            `TONO LIMPIO: ${tr.esTocadoLimpio ? "Sí — usa ganancia baja o 0" : "No — requiere distorsión/crunch"}`,
            `CADENA DE SEÑAL ORIGINAL: ${tr.cadenaSenal?.join(" → ") || "no especificada"}`,
            `AMPLIFICADOR ORIGINAL: ${tr.amplificador ? `${tr.amplificador.marca ?? ""} ${tr.amplificador.modelo ?? ""} — ${tr.amplificador.configuracion ?? ""}`.trim() : "no especificado"}`,
            `TÉCNICA: ${tr.techniques?.join(", ") || "no especificada"}`,
            `NOTAS: ${tr.notes || "ninguna"}`,
          ].join("\n")
        : "Sin datos de investigación del tono original.";

      // ── Construir descripción detallada de cada equipo ───────────────────
      const gearBlocks = validGear.map((g, idx) => {
        const isMulti = g.manualData?.esMultiEfectos ?? (g.type === "pedalera" || g.type === "procesador");
        const isAmp   = g.type === "amplificador";

        const lines: string[] = [];
        lines.push(`=== EQUIPO ${idx + 1}: ${g.brand || ""} ${g.model || ""} — ${g.name} [ID: equipo_${idx + 1}] ===`);
        lines.push(`Tipo: ${g.type}`);

        if (g.manualData) {
          lines.push(`Descripción: ${g.manualData.description}`);

          // ── Multi-efectos: mostrar estructura modular ──
          if (isMulti && g.manualData.modules && g.manualData.modules.length > 0) {
            lines.push(`MULTI-EFECTOS — Módulos disponibles (configura CADA UNO en el preset):`);
            g.manualData.modules.forEach((mod) => {
              lines.push(`\n  MÓDULO: ${mod.nombre} (${mod.label})`);
              if (mod.puedeApagarse) lines.push(`  Puede estar ON u OFF (incluir "estado": "ON"/"OFF")`);
              if (mod.efectos.length > 0) {
                lines.push(`  Efectos disponibles:`);
                mod.efectos.forEach((ef) => {
                  const params = ef.parametros.map(p => `${p.nombre} [${p.rango}]`).join(", ");
                  lines.push(`    - ${ef.tipo}: ${params}`);
                });
              }
            });
          }

          // ── Amplificador o pedal simple: parámetros planos ──
          if (!isMulti && g.manualData.parameters.length > 0) {
            const label = isAmp ? "AMPLIFICADOR — Controles a configurar:" : "PEDAL — Controles a configurar:";
            lines.push(label);
            g.manualData.parameters.forEach((p) => {
              lines.push(`  • ${p.name}: rango ${p.range}${p.defaultValue ? ` (default: ${p.defaultValue})` : ""} — ${p.description}`);
            });
          }

          // ── Learnings críticos ──
          if (g.manualData.learnings && g.manualData.learnings.length > 0) {
            lines.push(`\n⚠ REGLAS CRÍTICAS DEL EQUIPO (OBLIGATORIAS — no violar):`);
            g.manualData.learnings.forEach((l, i) => lines.push(`  ${i + 1}. ${l}`));
          }

          if (g.manualData.notes) {
            lines.push(`\nNotas adicionales: ${g.manualData.notes}`);
          }
        } else {
          lines.push(`[Sin datos de manual — usa parámetros estándar del modelo ${g.brand} ${g.model}]`);
          if (isMulti) lines.push(`MULTI-EFECTOS: incluye módulos COMP, DRIVE, EQ, MOD, DELAY, REVERB con ON/OFF.`);
          if (isAmp)   lines.push(`AMPLIFICADOR: configura GAIN/PRE, VOLUME/POST, BASS/LOW, MIDDLE/MID, TREBLE/HIGH.`);
        }

        return lines.join("\n");
      });

      // ── Formato de salida para multi-efectos (ejemplo basado en ZOOM B1) ──
      const multiGear = validGear.find(g => g.manualData?.esMultiEfectos ?? (g.type === "pedalera" || g.type === "procesador"));
      const exampleModuleFormat = multiGear
        ? `Para el MULTI-EFECTOS, los parametros deben tener este formato de módulos:
{
  "PATCH_LEVEL": 80,
  "COMP":  { "estado": "ON",  "tipo": "Compressor", "valor": "C3" },
  "EFX":   { "estado": "OFF" },
  "DRIVE": { "estado": "ON",  "tipo": "TUBE PRE", "GAIN": 30, "MIX": 60 },
  "EQ":    { "LO": 10, "MID": 12, "HI": 14 },
  "ZNR":   { "estado": "ON",  "tipo": "ZNR", "sensibilidad": 3 },
  "MOD_DELAY":    { "estado": "ON",  "tipo": "Chorus", "Prm1": "C2", "Prm2": 10 },
  "REVERB_DELAY": { "estado": "ON",  "tipo": "Room",   "Prm1": "R3", "Prm2": 3  }
}
Módulos con "estado": "OFF" NO llevan parámetros adicionales.`
        : "";

      // Clasificar equipo: estático (amp/guitarra) vs dinámico (pedaleras/pedales)
      const staticGear  = validGear.filter(g => g.type === "amplificador" || g.type === "guitarra");
      const dynamicGear = validGear.filter(g => g.type !== "amplificador" && g.type !== "guitarra");

      const staticGearList  = staticGear.map((g, i) => `equipo_${validGear.indexOf(g) + 1} = ${g.brand || ""} ${g.model || ""} (${g.type})`).join(", ");
      const dynamicGearList = dynamicGear.map((g, i) => `equipo_${validGear.indexOf(g) + 1} = ${g.brand || ""} ${g.model || ""} (${g.type})`).join(", ");

      // ── Generar presets via n8n (o fallback a OpenAI) ───────────────────
      try {
        let presetsData: N8nPresetResponse;

        try {
          presetsData = await callN8nPresetGenerator({
            song,
            gear: validGear,
            userId: String(ctx.user._id || ctx.user.openId),
            songDbId: input.songId,
          });
        } catch (n8nError) {
          if ((n8nError as Error).message === "N8N_FALLBACK") {
            // ── Fallback a OpenAI directo (desarrollo sin n8n) ─────────────
            console.warn("[Preset] Fallback OpenAI — configurar N8N_WEBHOOK_URL para producción");
            const tr = song.toneResearch;
            const toneContext = tr ? [
              `GANANCIA: ${tr.nivelDistorsion ?? "no especificado"}`,
              `LIMPIO: ${tr.esTocadoLimpio ? "SÍ — DRIVE OFF + GAIN ≤ 3" : "No"}`,
              `CADENA: ${tr.cadenaSenal?.join(" → ") || "no especificada"}`,
              `AMP ORIGINAL: ${tr.amplificador ? `${tr.amplificador.marca ?? ""} ${tr.amplificador.modelo ?? ""} — ${tr.amplificador.configuracion ?? ""}`.trim() : "no especificado"}`,
              `TÉCNICA: ${tr.techniques?.join(", ") || "no especificada"}`,
              `NOTAS: ${tr.notes || "ninguna"}`,
            ].join("\n") : "Sin datos.";
            const staticGear  = validGear.filter(g => g.type === "amplificador" || g.type === "guitarra");
            const dynamicGear = validGear.filter(g => g.type !== "amplificador" && g.type !== "guitarra");
            const staticList  = staticGear.map(g => `equipo_${validGear.indexOf(g) + 1} = ${g.brand || ""} ${g.model || ""} (${g.type})`).join(", ");
            const dynamicList = dynamicGear.map(g => `equipo_${validGear.indexOf(g) + 1} = ${g.brand || ""} ${g.model || ""} (${g.type})`).join(", ");
            const gearBlocks  = validGear.map((g, idx) => {
              const isMulti = g.manualData?.esMultiEfectos ?? (g.type === "pedalera" || g.type === "procesador");
              const lines: string[] = [`=== EQUIPO ${idx + 1}: ${g.brand || ""} ${g.model || ""} [ID: equipo_${idx + 1}] ===`];
              if (g.manualData) {
                lines.push(`Descripción: ${g.manualData.description}`);
                if (isMulti && g.manualData.modules?.length) {
                  g.manualData.modules.forEach(mod => {
                    lines.push(`  MÓDULO: ${mod.nombre} (${mod.label})`);
                    mod.efectos.forEach(ef => lines.push(`    - ${ef.tipo}: ${ef.parametros.map(p => `${p.nombre}[${p.rango}]`).join(", ")}`));
                  });
                } else {
                  g.manualData.parameters.forEach(p => lines.push(`  • ${p.name}: rango ${p.range} — ${p.description}`));
                }
                if (g.manualData.learnings?.length) {
                  lines.push("⚠ REGLAS CRÍTICAS:");
                  g.manualData.learnings.forEach((l, i) => lines.push(`  ${i + 1}. ${l}`));
                }
              }
              return lines.join("\n");
            });
            const multiGear = validGear.find(g => g.manualData?.esMultiEfectos ?? (g.type === "pedalera" || g.type === "procesador"));
            const exampleFmt = multiGear ? `Formato modular para multi-efectos:\n{"COMP":{"estado":"ON","tipo":"Compressor","valor":"C3"},"DRIVE":{"estado":"OFF"},"EQ":{"LO":10,"MID":12,"HI":14}}` : "";
            const fallbackPrompt = `Eres un técnico de sonido experto. Genera presets COMPLETOS con valores EXACTOS.\nCANCIÓN: ${song.title} — ${song.artist}\nTONO:\n${toneContext}\nEQUIPO:\n${gearBlocks.join("\n\n")}\n${exampleFmt}\nREGLA: AMPLIFICADORES/GUITARRAS → "configuracion_base". PEDALERAS → cada preset.\nEstático: ${staticList || "ninguno"} | Dinámico: ${dynamicList || "ninguno"}\nMÁXIMO 3 presets. Nombres "A0","A1","A2". Solo valores numéricos. Si esTocadoLimpio=true: DRIVE OFF.\nResponde SOLO con JSON:\n{"configuracion_base":[{"gearId":"equipo_X","gearNombre":"","gearTipo":"amplificador","parametros":{}}],"presets":[{"nombre":"A0","momento_cancion":"","descripcion":"","configuracion":[{"gearId":"equipo_Y","gearNombre":"","gearTipo":"pedalera","parametros":{}}],"nota_tecnica":null,"consejos":[]}],"advertencia":null}`;
            const fbResult = await invokeLLM({
              messages: [
                { role: "system", content: fallbackPrompt },
                { role: "user", content: `Genera los presets para "${song.title}" de ${song.artist}.` },
              ],
              responseFormat: { type: "json" },
              useWebSearch: false,
            });
            const fbData = parseJSON<{
              configuracion_base?: GearConfigRaw[];
              presets: Array<{ nombre: string; momento_cancion: string; descripcion: string; configuracion: GearConfigRaw[]; nota_tecnica?: string; consejos?: string[]; }>;
              advertencia?: string;
            }>(fbResult.content);
            const gearIdMap: Record<string, string> = {};
            validGear.forEach((g, idx) => { gearIdMap[`equipo_${idx + 1}`] = String(g._id); });
            const mapId = (c: GearConfigRaw) => ({ ...c, gearId: gearIdMap[c.gearId] ?? c.gearId });
            presetsData = {
              success: true,
              configuracion_base: (fbData.configuracion_base || []).map(mapId),
              presetsData: (fbData.presets || []).map(p => ({ ...p, configuracion: (p.configuracion || []).map(mapId) })),
              advertencia: fbData.advertencia,
            };
          } else {
            throw n8nError;
          }
        }

        // ── Persistir en MongoDB ─────────────────────────────────────────
        const preset = await db.createPreset({
          userId: String(ctx.user._id || ctx.user.openId),
          songId: input.songId,
          songTitle: song.title,
          songArtist: song.artist,
          gearIds: input.gearIds,
          configuracion_base: presetsData.configuracion_base || [],
          presetsData: presetsData.presetsData,
          advertencia: presetsData.advertencia,
          isFavorite: false,
        });

        await db.addSearchHistory({
          userId: String(ctx.user._id || ctx.user.openId),
          musicBrainzId: song.musicBrainzId,
          title: song.title,
          artist: song.artist,
          releaseDate: song.releaseDate,
          coverUrl: song.coverUrl,
        });

        return { success: true, preset, toneResearch: song.toneResearch };

      } catch (error) {
        console.error("[Preset Generation] Error:", error);
        throw new Error("Error generando presets");
      }
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        data: z
          .object({
            rating: z.number().min(1).max(5).optional(),
            userNotes: z.string().optional(),
            isFavorite: z.boolean().optional(),
          })
          .partial(),
      })
    )
    .mutation(({ input }) => db.updatePreset(input.id, input.data)),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => db.deletePreset(input.id)),
});

// ─── History Router ───────────────────────────────────────────────────────────

const historyRouter = router({
  list: protectedProcedure.query(({ ctx }) =>
    db.getUserSearchHistory(String(ctx.user._id || ctx.user.openId))
  ),
  clear: protectedProcedure.mutation(({ ctx }) =>
    db.clearUserSearchHistory(String(ctx.user._id || ctx.user.openId))
  ),
});

// ─── Auth Router ──────────────────────────────────────────────────────────────

const authRouter = router({
  me: publicProcedure.query((opts) => opts.ctx.user),

  register: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        email: z.string().email(),
        password: z.string().min(6),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await db.getUserByEmail(input.email);
      if (existing) throw new Error("Ya existe una cuenta con ese email");

      const openId = nanoid();
      await db.upsertUser({
        openId,
        name: input.name,
        email: input.email.toLowerCase().trim(),
        passwordHash: hashPassword(input.password),
        loginMethod: "email",
        lastSignedIn: new Date(),
      });

      const token = await createSessionToken(openId, input.name);
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      const user = await db.getUserByOpenId(openId);
      return { success: true, user };
    }),

  login: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await db.getUserByEmail(input.email);
      if (!user || !user.passwordHash) throw new Error("Email o contraseña incorrectos");

      const valid = verifyPassword(input.password, user.passwordHash);
      if (!valid) throw new Error("Email o contraseña incorrectos");

      await db.upsertUser({ openId: user.openId, lastSignedIn: new Date() });

      const token = await createSessionToken(user.openId, user.name ?? "");
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      return { success: true, user };
    }),

  logout: publicProcedure.mutation(({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return { success: true } as const;
  }),
});

// ─── Main Router ──────────────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,
  auth: authRouter,
  songs: songsRouter,
  gear: gearRouter,
  presets: presetsRouter,
  history: historyRouter,
});

export type AppRouter = typeof appRouter;
