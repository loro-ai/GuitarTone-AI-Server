# Prompt Generador de toneResearch JSON

> Copiar este prompt completo en ChatGPT/Claude con web search activado.
> Reemplazar `[CANCIONES]` con la lista de canciones a investigar.
> El output es JSON listo para pegar en `seed-songs.js`.

---

## PROMPT

```
Eres un experto en gear de guitarra eléctrica con acceso a internet.
Investiga el equipo EXACTO y VERIFICADO usado en cada canción de la lista.

PRIORIDAD DE FUENTES:
1. Videos de Rig Rundown (Premier Guitar, Reverb.com)
2. Guitar World, Premier Guitar, Ultimate Guitar
3. Equipboard.com
4. Entrevistas oficiales con el artista
5. Foros especializados (Reddit r/Guitar, TalkBass, The Gear Page)

REGLAS CRÍTICAS:
- Investiga el gear usado EN ESA CANCIÓN ESPECÍFICA, no el gear general del artista.
- Si la canción es limpia (clean/jangle/fingerpicking/acústica): "esTocadoLimpio" DEBE ser true y "nivelDistorsion" DEBE ser "clean".
- NO inventes efectos. Si no hay información verificada para un campo, usa null.
- Documenta CADA pedal, procesador y efecto por separado en el array de efectos.
- ANALIZA LA ESTRUCTURA REAL DE LA CANCIÓN: identifica las secciones que REALMENTE existen y cómo cambia el tono/dinámica en cada una.
- Cada canción tiene su propia estructura. NO todas las canciones tienen las mismas secciones.
- Usa SOLO las secciones que existen en la canción. Secciones válidas:
  - BASE (ritmo/fundamento): intro, verso, outro, ending, riff, interludio, interlude, breakdown, stanza
  - CORO (alta energía melódica): coro, estribillo, chorus, pre-coro, precoro, hook, refrain
  - SOLO (máxima intensidad/lead): solo, puente, bridge, climax, cadenza, shred
- Si la canción NO tiene coro, NO incluyas sección coro. Si NO tiene solo, NO incluyas solo.
- Si la canción NO tiene cambios tonales entre secciones, estructura debe tener 1-2 entradas genéricas.
- Si la canción SÍ tiene cambios (ej: verso limpio → coro con distorsión → solo con wah), cada sección DEBE reflejar esos cambios.

FORMATO DE SALIDA — un array JSON, cada elemento es un objeto para seed-songs.js:

[
  {
    "musicBrainzId": "manual_[slug_cancion]",
    "title": "Nombre Canción",
    "artist": "Artista",
    "coverUrl": "...",
    "toneResearch": {
      "equipment": [
        {
          "nombre": "Nombre exacto del pedal/efecto",
          "tipo": "distortion|overdrive|fuzz|reverb|delay|chorus|flanger|phaser|wah|comp|eq|boost|tremolo|vibrato|pitch|octave|clean",
          "posicion": "posición en la cadena o contexto de uso"
        }
      ],
      "amplificador": {
        "marca": "Marca exacta",
        "modelo": "Modelo exacto",
        "configuracion": "Descripción de EQ y ganancia en esta canción"
      },
      "guitarra": {
        "marca": "Marca exacta",
        "modelo": "Modelo exacto",
        "pastillas": "Tipo (single coil, humbucker, P90, etc.)"
      },
      "cadenaSenal": ["guitarra", "pedal1", "pedal2", "amplificador"],
      "techniques": ["técnica 1", "técnica 2"],
      "notes": "Información clave sobre el tono",
      "nivelDistorsion": "clean|light-crunch|crunch|high-gain|heavy",
      "esTocadoLimpio": false,
      "estructura": [
        {
          "seccion": "intro|verso|coro|pre-coro|estribillo|puente|bridge|solo|outro|ending|riff|interludio|interlude|breakdown|hook|refrain|climax",
          "dinamica": "pp|p|mp|mf|f|ff",
          "nivel_distorsion": "clean|light-crunch|crunch|high-gain|heavy",
          "efectos_clave": ["nombre del efecto activo en esta sección"],
          "tecnica": "técnica específica de esta sección"
        }
      ],
      "researchedAt": "2026-03-24T00:00:00.000Z"
    }
  }
]

REGLAS DE ESTRUCTURA:
- "dinamica" usa notación musical: pp (muy suave) → ff (muy fuerte)
- "nivel_distorsion" DEBE ser coherente con el nivelDistorsion global:
  - Si global es "clean", ninguna sección puede ser "high-gain" (salvo solo)
  - Si global es "high-gain", el verso puede ser "crunch" pero no "clean"
- "efectos_clave" solo incluye los efectos ACTIVOS en esa sección (no los que están off)
- Si dos secciones son tonalmente idénticas, agrupar: usar solo 1 entrada "verso/coro"
- NO forzar secciones que no existen: si no hay solo, no hay solo. Si no hay coro, no hay coro.
- Ejemplos reales:
  - Balada acústica: [verso, coro] (2 secciones, ambas clean)
  - Rock clásico con solo: [intro, verso, coro, solo] (4 secciones, verso crunch → coro high-gain → solo high-gain con wah)
  - Funk sin solo: [verso, coro] (2 secciones, mismo gain pero distintos efectos)
  - Ambient/post-rock: [intro, verso, climax] (3 secciones, crescendo progresivo)
  - Punk: [verso] (1 sección, todo igual)
- Mínimo 1 sección, máximo 5

Responde SOLO con el array JSON. Sin markdown, sin explicaciones.

CANCIONES A INVESTIGAR:
[CANCIONES]
```

---

## EJEMPLO DE USO

Reemplazar `[CANCIONES]` con:

```
1. "Comfortably Numb" — Pink Floyd
2. "Under the Bridge" — Red Hot Chili Peppers
3. "Sultans of Swing" — Dire Straits
```

---

## POST-PROCESAMIENTO

1. Copiar el JSON generado
2. Validar con `node -e "JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'))"`
3. Pegar los objetos dentro del array `songs` en `seed-songs.js`
4. Ejecutar: `cd code/back && node scripts/seed-songs.js`
