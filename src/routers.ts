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
import { Gear } from "./models/Gear";
const { verifyPresetFlow } = require("./utils/verifyPresetFlow");

// ─── Tipos para integración n8n ───────────────────────────────────────────────

type GearConfigRaw = {
  gearId: string;
  gearNombre: string;
  gearTipo: string;
  parametros: Record<string, unknown>;
};

type AmpPresetGlobal = {
  AMP?: {
    algoritmo: string;
    P1?: number;
    P2?: number;
    P3?: number;
    P4?: number;
  };
  CAB?: { algoritmo: string; P1?: number };
  NS?: { algoritmo: string; P1?: number };
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
    system_params?: Record<string, unknown>;
  }>;
  ampPresetGlobal?: AmpPresetGlobal | null;
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
    console.warn(
      "[n8n] N8N_WEBHOOK_URL_V2 y N8N_WEBHOOK_URL no configurados — usando fallback OpenAI directo",
    );
    throw new Error("N8N_FALLBACK");
  }

  console.log(
    `[n8n] Usando ${ENV.n8nWebhookUrlV2 ? "Orchestrator v2" : "Preset Generator v1"}: ${webhookUrl}`,
  );

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
      throw new Error(
        `n8n respondió con status ${response.status}: ${errorText}`,
      );
    }

    const data = (await response.json()) as N8nPresetResponse;

    if (!data.success) {
      throw new Error(
        `n8n reportó error: ${data.error || "error desconocido"}`,
      );
    }

    if (!data.presetsData) {
      throw new Error("n8n retornó respuesta sin estructura válida");
    }
    if (
      data.presetsData.length === 0 &&
      (!data.configuracion_base || data.configuracion_base.length === 0)
    ) {
      throw new Error("n8n retornó presets y configuración base vacíos");
    }

    console.log(
      `[n8n] Presets generados: ${data.presetsData.length} sección(es) — songDbId: ${payload.songDbId}`,
    );
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

// ─── Core: n8n + fallback + verify ───────────────────────────────────────────

async function generatePresetsCore(params: {
  song: import("./models/Song").ISong;
  gear: import("./models/Gear").IGear[];
  userId: string;
  songDbId: string;
}): Promise<{
  presetsData: N8nPresetResponse;
  verification: { valid: boolean; errors: string[]; warnings: string[] };
}> {
  const { song, gear, userId, songDbId } = params;

  let presetsData: N8nPresetResponse;

  try {
    presetsData = await callN8nPresetGenerator({ song, gear, userId, songDbId });
  } catch (n8nError) {
    if ((n8nError as Error).message === "N8N_FALLBACK") {
      console.warn("[generatePresetsCore] Fallback OpenAI — configurar N8N_WEBHOOK_URL");
      const tr = song.toneResearch;
      const toneCtx = tr
        ? [
            `GANANCIA: ${tr.nivelDistorsion ?? "no especificado"}`,
            `LIMPIO: ${tr.esTocadoLimpio ? "SÍ — DRIVE OFF + GAIN ≤ 3" : "No"}`,
            `CADENA: ${tr.cadenaSenal?.join(" → ") || "no especificada"}`,
            `AMP: ${tr.amplificador ? `${(tr.amplificador as any).marca ?? ""} ${(tr.amplificador as any).modelo ?? ""}`.trim() : "no especificado"}`,
            `NOTAS: ${tr.notes || "ninguna"}`,
          ].join("\n")
        : "Sin datos.";
      const gearIdMap: Record<string, string> = {};
      gear.forEach((g, idx) => {
        gearIdMap[`equipo_${idx + 1}`] = String(g._id);
      });
      const mapId = (c: GearConfigRaw) => ({
        ...c,
        gearId: gearIdMap[c.gearId] ?? c.gearId,
      });
      const staticGear = gear.filter((g) => g.type === "amplificador" || g.type === "guitarra");
      const dynamicGear = gear.filter((g) => g.type !== "amplificador" && g.type !== "guitarra");
      const staticList = staticGear.map((g) => `equipo_${gear.indexOf(g) + 1} = ${g.brand || ""} ${g.model || ""} (${g.type})`).join(", ");
      const dynamicList = dynamicGear.map((g) => `equipo_${gear.indexOf(g) + 1} = ${g.brand || ""} ${g.model || ""} (${g.type})`).join(", ");
      const fallbackPrompt = `Eres un técnico de sonido experto. Genera presets COMPLETOS con valores EXACTOS.\nCANCIÓN: ${song.title} — ${song.artist}\nTONO:\n${toneCtx}\nEQUIPO:\n${gear.map((g, i) => `[EQUIPO ${i + 1}] gearId:equipo_${i + 1} | ${g.brand} ${g.model} | type:${g.type}`).join("\n")}\nREGLA: AMPLIFICADORES/GUITARRAS → configuracion_base. PEDALERAS → presetsData.\nEstático: ${staticList || "ninguno"} | Dinámico: ${dynamicList || "ninguno"}\nMÁXIMO 3 presets. Nombres "A0","A1","A2". Valores numéricos. Si esTocadoLimpio=true: DRIVE OFF.\nResponde SOLO con JSON:\n{"configuracion_base":[],"presets":[],"advertencia":null}`;
      const fbResult = await invokeLLM({
        messages: [
          { role: "system", content: fallbackPrompt },
          { role: "user", content: `Genera presets para "${song.title}" de ${song.artist}.` },
        ],
        responseFormat: { type: "json" },
        useWebSearch: false,
      });
      const fbData = parseJSON<{
        configuracion_base?: GearConfigRaw[];
        presets: Array<{
          nombre: string;
          momento_cancion: string;
          descripcion: string;
          configuracion: GearConfigRaw[];
          nota_tecnica?: string;
          consejos?: string[];
        }>;
        advertencia?: string;
      }>(fbResult.content);
      presetsData = {
        success: true,
        configuracion_base: (fbData.configuracion_base || []).map(mapId),
        presetsData: (fbData.presets || []).map((p) => ({
          ...p,
          configuracion: (p.configuracion || []).map(mapId),
        })),
        advertencia: fbData.advertencia,
      };
    } else {
      throw n8nError;
    }
  }

  // Verificación automática
  let verification = verifyPresetFlow(presetsData);

  if (!verification.valid) {
    console.warn(`[generatePresetsCore] Verificación falló — reintentando. Errores: ${verification.errors.join("; ")}`);
    try {
      presetsData = await callN8nPresetGenerator({ song, gear, userId, songDbId });
      verification = verifyPresetFlow(presetsData);
      if (!verification.valid) {
        console.error(`[generatePresetsCore] Reintento falló. Errores: ${verification.errors.join("; ")}`);
      }
    } catch (retryErr) {
      console.error("[generatePresetsCore] Reintento lanzó error:", retryErr);
    }
  }

  if (verification.warnings.length > 0) {
    console.warn(`[generatePresetsCore] Warnings: ${verification.warnings.join("; ")}`);
  }

  return { presetsData, verification };
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

async function searchDeezer(
  title: string,
  artist: string,
): Promise<DeezerTrack[]> {
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
    const enriched = await Promise.all(
      deezerResults.map(async (r) => {
        const existing = await db.getSongByTitleAndArtist(
          r.title,
          r.artist.name,
        );
        return {
          id: String(r.id),
          musicBrainzId: String(r.id),
          title: r.title,
          artist: r.artist.name,
          coverUrl: r.album.cover_medium,
          hasToneResearch: !!existing?.toneResearch?.researchedAt,
        };
      }),
    );

    // 3. Opcional: eliminar duplicados por título+artista si Deezer devolvió varios
    //    (aunque la API no suele hacerlo, por seguridad)
    const unique = new Map<string, (typeof enriched)[0]>();
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

  researchTone: protectedProcedure
    .input(
      z.object({
        musicBrainzId: z.string(),
        title: z.string(),
        artist: z.string(),
        coverUrl: z.string().optional(),
      }),
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
        return {
          success: true,
          data: song.toneResearch,
          songDbId: String(song._id),
        };
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
          efectos?: Array<{
            nombre: string;
            marca?: string;
            modelo?: string;
            tipo: string;
            posicion?: string;
          }>;
          amplificador?: {
            marca?: string;
            modelo?: string;
            configuracion?: string;
          };
          guitarra?: { marca?: string; modelo?: string; pastillas?: string };
          cadena_senal?: string[];
          tecnica?: string;
          nivel_distorsion?: string;
          es_tocado_limpio?: boolean;
          fuente_verificada?: string;
          notas?: string;
          estructura?: Array<{
            seccion: string;
            dinamica?: string;
            nivel_distorsion?: string;
            efectos_clave?: string[];
            gain_relativo?: number;
            tecnica?: string;
            notas?: string;
          }>;
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
          estructura: Array.isArray(researchData.estructura)
            ? researchData.estructura
            : [],
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
        return {
          success: false,
          error: "Error investigando el tono",
          songDbId: String(song._id),
        };
      }
    }),

  generatePreset: protectedProcedure
    .input(generatePresetFromSongSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = String(ctx.user._id || ctx.user.openId);
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
        console.log(
          `[generatePreset] Investigando gear del artista: ${input.artist} — ${input.title}`,
        );

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
- ANALIZA LA ESTRUCTURA REAL DE LA CANCIÓN sección por sección.
- amp_reference es OBLIGATORIO: investiga el amp del artista y describe su carácter tonal + EQ base estimada (0-100).
- song_structure es OBLIGATORIO: cada sección de la canción con intensidad (1-10), textura, efectos clave y ajuste de EQ relativo.

Responde SOLO con este JSON (sin markdown):
{
  "amp_reference": {
    "marca": "Marca exacta del amplificador",
    "modelo": "Modelo exacto",
    "caracter": "bright|dark|neutral",
    "gain_base": 55,
    "eq_base": { "bass": 50, "mid": 60, "treble": 65 },
    "notes": "Notas sobre configuración del amp en esta canción"
  },
  "song_structure": [
    {
      "section": "intro|verso|coro|pre-coro|solo|bridge|outro|riff|breakdown",
      "intensity": 5,
      "texture": "clean|crunch|heavy",
      "key_effects": ["nombre del efecto activo"],
      "eq_adjust": { "bass": 50, "mid": 55, "treble": 60 },
      "gain_delta": 0,
      "technique": "tecnica especifica en esta seccion"
    }
  ],
  "efectos": [
    {
      "nombre": "Nombre exacto del pedal/efecto",
      "marca": "Marca",
      "modelo": "Modelo exacto",
      "tipo": "distorsion|overdrive|fuzz|reverb|delay|chorus|flanger|phaser|wah|comp|eq|boost|tremolo|vibrato|pitch|octave|clean",
      "posicion": "posición en la cadena"
    }
  ],
  "amplificador": {
    "marca": "Marca exacta",
    "modelo": "Modelo exacto",
    "configuracion": "Descripción de EQ y ganancia"
  },
  "guitarra": {
    "marca": "Marca exacta",
    "modelo": "Modelo exacto",
    "pastillas": "Tipo de pastillas"
  },
  "cadena_senal": ["guitarra", "pedal1", "amplificador"],
  "tecnica": "Descripción de la técnica principal",
  "nivel_distorsion": "clean|light-crunch|crunch|high-gain|heavy",
  "es_tocado_limpio": false,
  "fuente_verificada": "URL o fuente consultada",
  "notas": "Información adicional",
  "estructura": [
    {
      "seccion": "intro|verso|coro|pre-coro|solo|bridge|outro|riff|breakdown",
      "dinamica": "pp|p|mp|mf|f|ff",
      "nivel_distorsion": "clean|light-crunch|crunch|high-gain|heavy",
      "efectos_clave": ["efecto activo"],
      "gain_relativo": 1,
      "tecnica": "tecnica especifica",
      "notas": "cambios tonales"
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
            amp_reference?: {
              marca: string;
              modelo: string;
              caracter: string;
              gain_base: number;
              eq_base: { bass: number; mid: number; treble: number };
              notes: string;
            };
            song_structure?: Array<{
              section: string;
              intensity: number;
              texture: string;
              key_effects: string[];
              eq_adjust?: { bass: number; mid: number; treble: number };
              gain_delta?: number;
              technique?: string;
            }>;
            efectos?: Array<{
              nombre: string;
              marca?: string;
              modelo?: string;
              tipo: string;
              posicion?: string;
            }>;
            amplificador?: {
              marca?: string;
              modelo?: string;
              configuracion?: string;
            };
            guitarra?: { marca?: string; modelo?: string; pastillas?: string };
            cadena_senal?: string[];
            tecnica?: string;
            nivel_distorsion?: string;
            es_tocado_limpio?: boolean;
            fuente_verificada?: string;
            notas?: string;
            estructura?: Array<{
              seccion: string;
              dinamica?: string;
              nivel_distorsion?: string;
              efectos_clave?: string[];
              gain_relativo?: number;
              tecnica?: string;
              notas?: string;
            }>;
          }>(result.content);

          toneResearch = {
            // ── v2 campos ──
            ampReference: researchData.amp_reference
              ? {
                  marca: researchData.amp_reference.marca || "",
                  modelo: researchData.amp_reference.modelo || "",
                  caracter:
                    (researchData.amp_reference.caracter as
                      | "bright"
                      | "dark"
                      | "neutral") || "neutral",
                  gainBase: researchData.amp_reference.gain_base ?? 50,
                  eqBase: researchData.amp_reference.eq_base || {
                    bass: 50,
                    mid: 50,
                    treble: 50,
                  },
                  notes: researchData.amp_reference.notes || "",
                }
              : undefined,
            songStructure: Array.isArray(researchData.song_structure)
              ? researchData.song_structure.map((s) => ({
                  section: s.section as any,
                  intensity: s.intensity ?? 5,
                  texture:
                    (s.texture as "clean" | "crunch" | "heavy") || "crunch",
                  keyEffects: s.key_effects || [],
                  eqAdjust: s.eq_adjust,
                  gainDelta: s.gain_delta,
                  technique: s.technique,
                }))
              : undefined,
            baseTone: {
              nivelDistorsion: researchData.nivel_distorsion || "crunch",
              esTocadoLimpio: researchData.es_tocado_limpio ?? false,
            },

            // ── legacy campos ──
            equipment: researchData.efectos || [],
            amplificador: researchData.amplificador || {},
            guitarra: researchData.guitarra || {},
            cadenaSenal: researchData.cadena_senal || [],
            techniques: researchData.tecnica ? [researchData.tecnica] : [],
            notes: researchData.notas || "",
            nivelDistorsion: researchData.nivel_distorsion,
            esTocadoLimpio: researchData.es_tocado_limpio,
            estructura: Array.isArray(researchData.estructura)
              ? researchData.estructura
              : [],
            researchedAt: new Date(),
          };

          await db.updateSongToneResearch(songDbId, toneResearch);
          console.log(
            `[generatePreset] Tono investigado y cacheado para: ${input.title}`,
          );
        } catch (researchError) {
          console.error(
            "[generatePreset] Error investigando tono:",
            researchError,
          );
          toneResearch = {
            equipment: [],
            amplificador: {},
            guitarra: {},
            cadenaSenal: [],
            techniques: [],
            notes:
              "No se pudo investigar el tono. n8n generará presets basados solo en el equipo del usuario.",
            nivelDistorsion: undefined,
            esTocadoLimpio: undefined,
            estructura: [],
            researchedAt: new Date(),
          };
        }
      } else {
        console.log(
          `[generatePreset] Cache hit — tono ya investigado para: ${input.title}`,
        );
      }

      // ── Paso 3: Recuperar gear del usuario ───────────────────────────
      const gearList = await Promise.all(
        input.gearIds.map((id) => db.getGearById(id)),
      );
      const validGear = gearList.filter(Boolean) as NonNullable<
        (typeof gearList)[number]
      >[];

      if (validGear.length === 0) {
        throw new Error("No se encontró el equipo seleccionado");
      }

      // ── Paso 4+5: Generar presets (n8n + fallback + verify) ─────────
      const { presetsData, verification } = await generatePresetsCore({
        song: { ...song, toneResearch },
        gear: validGear,
        userId,
        songDbId,
      });

      // ── Paso 6: Guardar preset en MongoDB ────────────────────────────
      const preset = await db.createPreset({
        userId,
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
        userId,
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
        ampPresetGlobal: presetsData.ampPresetGlobal || null,
        verification: {
          valid: verification.valid,
          errors: verification.errors,
          warnings: verification.warnings,
        },
      };
    }),
});

// ─── Gear Router ──────────────────────────────────────────────────────────────

const gearRouter = router({
  list: protectedProcedure.query(({ ctx }) =>
    db.getUserGear(String(ctx.user._id || ctx.user.openId)),
  ),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => db.getGearById(input.id)),

  create: protectedProcedure
    .input(gearSchema)
    .mutation(async ({ ctx, input }) => {
      const gear = await db.createGear(
        String(ctx.user._id || ctx.user.openId),
        {
          ...input,
          isDefault: false,
        },
      );

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
        if (g.isDefault)
          await db.updateGear(String(g._id), { isDefault: false });
      }
      return db.updateGear(input.id, { isDefault: true });
    }),

  getSpecs: protectedProcedure
    .input(
      z.object({
        gearId: z.string(),
        brand: z.string(),
        model: z.string(),
        type: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const N8N_BASE = (ENV.n8nWebhookUrl || ENV.n8nWebhookUrlV2)?.replace(
        /\/webhook\/.*$/,
        "",
      );
      const webhookUrl = N8N_BASE
        ? `${N8N_BASE}/webhook/guitartone-gear-specs`
        : undefined;
      if (!webhookUrl) return { success: false, specs: null };

      try {
        const response = await fetch(webhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-webhook-secret": ENV.n8nWebhookSecret || "",
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
        const data = (await response.json()) as {
          success: boolean;
          specs: Record<string, unknown>;
        };
        const specs = data.specs || null;
        // Persistir specs en MongoDB para que generatePreset tenga procId
        if (specs && input.gearId) {
          await Gear.findByIdAndUpdate(input.gearId, { specs });
        }
        return { success: true, specs };
      } catch {
        return { success: false, specs: null };
      }
    }),
});

// ─── Presets Router ───────────────────────────────────────────────────────────

const presetsRouter = router({
  list: protectedProcedure.query(({ ctx }) =>
    db.getUserPresets(String(ctx.user._id || ctx.user.openId)),
  ),

  favorites: protectedProcedure.query(({ ctx }) =>
    db.getUserFavoritePresets(String(ctx.user._id || ctx.user.openId)),
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
      const userId = String(ctx.user._id || ctx.user.openId);
      const song = await db.getSongById(input.songId);
      if (!song) throw new Error("Canción no encontrada");

      const gearList = await Promise.all(
        input.gearIds.map((id) => db.getGearById(id)),
      );
      const validGear = gearList.filter(Boolean) as NonNullable<
        (typeof gearList)[number]
      >[];

      if (validGear.length === 0)
        throw new Error("No se encontró el equipo seleccionado");

      // ── Generar presets (n8n + fallback + verify) ──────────────────────
      const { presetsData, verification } = await generatePresetsCore({
        song,
        gear: validGear,
        userId,
        songDbId: input.songId,
      });

      // ── Persistir en MongoDB ─────────────────────────────────────────
      const preset = await db.createPreset({
        userId,
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
        userId,
        musicBrainzId: song.musicBrainzId,
        title: song.title,
        artist: song.artist,
        releaseDate: song.releaseDate,
        coverUrl: song.coverUrl,
      });

      return {
        success: true,
        preset,
        toneResearch: song.toneResearch,
        ampPresetGlobal: presetsData.ampPresetGlobal || null,
        verification: {
          valid: verification.valid,
          errors: verification.errors,
          warnings: verification.warnings,
        },
      };
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
      }),
    )
    .mutation(({ input }) => db.updatePreset(input.id, input.data)),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => db.deletePreset(input.id)),
});

// ─── History Router ───────────────────────────────────────────────────────────

const historyRouter = router({
  list: protectedProcedure.query(({ ctx }) =>
    db.getUserSearchHistory(String(ctx.user._id || ctx.user.openId)),
  ),
  clear: protectedProcedure.mutation(({ ctx }) =>
    db.clearUserSearchHistory(String(ctx.user._id || ctx.user.openId)),
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
      }),
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
      ctx.res.cookie(COOKIE_NAME, token, {
        ...cookieOptions,
        maxAge: ONE_YEAR_MS,
      });

      const user = await db.getUserByOpenId(openId);
      return { success: true, user };
    }),

  login: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = await db.getUserByEmail(input.email);
      if (!user || !user.passwordHash)
        throw new Error("Email o contraseña incorrectos");

      const valid = verifyPassword(input.password, user.passwordHash);
      if (!valid) throw new Error("Email o contraseña incorrectos");

      await db.upsertUser({ openId: user.openId, lastSignedIn: new Date() });

      const token = await createSessionToken(user.openId, user.name ?? "");
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, token, {
        ...cookieOptions,
        maxAge: ONE_YEAR_MS,
      });

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
