const payload = $('Extract Processor ID').first().json;
const allItems = $input.all().map(i => i.json);

const algorithms   = allItems.filter(r => r.Algoritmo && r.Slot_Type && !r._empty);
const systemParams = allItems.filter(r => r.Param_Global && r.Valores_Permitidos && !r._empty);
const procModelArr = allItems.filter(r => r.Marca && r.Modelo && !r._empty);
const processorModel = procModelArr;
const ampSpecsArr  = allItems.filter(r => r.userAmp !== undefined || r.artistAmp !== undefined);
const ampSpecs     = ampSpecsArr.length > 0 ? ampSpecsArr[0] : { userAmp: null, artistAmp: null };

const song      = payload.song;
const gear      = payload.gear;
const staticGear  = payload.staticGear;
const dynamicGear = payload.dynamicGear;
const procId    = payload.procId;
const tr        = song.toneResearch;
const equipment = tr?.equipment || [];

// ══════════════════════════════════════════════════════
// ARQUITECTURA DE SLOTS POR PROCESADOR
// ══════════════════════════════════════════════════════
const PROCESSOR_SLOTS = {
  PROC_001: [
    { key: 'COMP_LIMIT', label: 'COMP/LIMIT', slots: ['DYN'],             nullable: true  },
    { key: 'EFX',        label: 'EFX',        slots: ['FLT','EFX','MOD'], nullable: true  },
    { key: 'DRIVE',      label: 'DRIVE',      slots: ['DIST','AMP'],      nullable: false },
    { key: 'EQ',         label: 'EQ',         slots: ['EQ'],              nullable: false, fixed: true },
    { key: 'ZNR',        label: 'ZNR',        slots: ['DYN'],             nullable: false, fixed: true },
    { key: 'MOD_DELAY',  label: 'MOD/DELAY',  slots: ['MOD','DLY'],       nullable: true  },
    { key: 'REV_DELAY',  label: 'REV/DELAY',  slots: ['REV','DLY'],       nullable: true  },
  ],
  PROC_002: [
    { key: 'AMP',  label: 'AMP',    slots: ['AMP'],          nullable: false },
    { key: 'DIST', label: 'DIST',   slots: ['DIST'],         nullable: true  },
    { key: 'MOD',  label: 'MOD',    slots: ['MOD'],          nullable: true  },
    { key: 'DLY',  label: 'DELAY',  slots: ['DLY','DELAY'],  nullable: true  },
    { key: 'REV',  label: 'REVERB', slots: ['REV','REVERB'], nullable: true  },
    { key: 'DYN',  label: 'COMP',   slots: ['DYN'],          nullable: true  },
  ],
  PROC_003: [
    { key: 'AMP',  label: 'AIRD PREAMP', slots: ['AMP'],          nullable: false },
    { key: 'DIST', label: 'DS/OD',       slots: ['DIST'],         nullable: true  },
    { key: 'MOD',  label: 'FX/MOD',      slots: ['MOD','EFX'],    nullable: true  },
    { key: 'DLY',  label: 'DELAY',       slots: ['DLY','DELAY'],  nullable: true  },
    { key: 'REV',  label: 'REVERB',      slots: ['REV','REVERB'], nullable: true  },
    { key: 'DYN',  label: 'NS/COMP',     slots: ['DYN'],          nullable: true  },
    { key: 'EQ',   label: 'EQ',          slots: ['EQ'],           nullable: true  },
  ],
  PROC_004: [
    { key: 'FX_COMP', label: 'FX/COMP', slots: ['FLT','DYN'],    nullable: true  },
    { key: 'DS_OD',   label: 'DS/OD',   slots: ['DIST'],         nullable: true  },
    { key: 'AMP',     label: 'AMP',     slots: ['AMP'],          nullable: false },
    { key: 'CAB',     label: 'CAB',     slots: ['CAB'],          nullable: false, fixed: true },
    { key: 'NS',      label: 'NS',      slots: ['DYN'],          nullable: false, fixed: true },
    { key: 'EQ',      label: 'EQ',      slots: ['EQ'],           nullable: true  },
    { key: 'MOD',     label: 'MOD',     slots: ['MOD'],          nullable: true  },
    { key: 'DELAY',   label: 'DELAY',   slots: ['DLY','DELAY'],  nullable: true  },
    { key: 'REVERB',  label: 'REVERB',  slots: ['REV','REVERB'], nullable: true  },
  ],
};

// ══════════════════════════════════════════════════════
// REFERENCIA COMPLETA DE PANTALLA — ZOOM B1 (PROC_001)
//
// El Zoom B1 usa un código de pantalla de 2 caracteres:
//   LETRA = algoritmo    DÍGITO = valor del parámetro 1 (siempre 1-9)
//
// Ejemplo: "A7" = Auto Wah con sensibilidad 7
//          "C3" = Chorus con mix 3
//          "FF" + Gain + Mix = Fuzz Face (DRIVE tiene formato propio)
// ══════════════════════════════════════════════════════

const ZOOM_B1_REFERENCIA = `
════════════════════════════════════════════════════════
REFERENCIA COMPLETA ZOOM B1 — CÓDIGOS DE PANTALLA
════════════════════════════════════════════════════════

── COMP/LIMIT ──────────────────────────────────────────
Formato JSON: { "display": "X#", "activo": true }
donde X = letra del algoritmo, # = valor 1-9

C1-C9  Compressor  — P1=Sensibilidad (1=mínima, 9=máxima)
L1-L9  Limiter     — P1=Nivel referencia (1=bajo, 9=alto)

Ejemplo activo: { "display": "C4", "activo": true }
Ejemplo off:    { "activo": false }

── EFX ─────────────────────────────────────────────────
Formato JSON: { "display": "X#", "activo": true }
UN SOLO valor 1-9. Sin ningún parámetro adicional.

A1-A9  Auto Wah         — Sensibilidad (7-8 para Frusciante/funk)
F1-F9  Resonance Filter — Sensibilidad
O1-O9  Octave           — Nivel sub-octava
T1-T9  Tremolo          — Velocidad
P1-P9  Phaser           — Velocidad (3-4 = lento psicodélico)
R1-R9  Ring Mod         — Frecuencia
D1-D9  Defret           — Sensibilidad
S1-S9  Slow Attack      — Tiempo de ataque
V1-V9  Pedal Vox        — Énfasis de frecuencia

Ejemplo activo: { "display": "A7", "activo": true }
Ejemplo off:    { "activo": false }

── DRIVE ────────────────────────────────────────────────
Formato JSON: { "display": "XX", "P1": Gain, "P2": Mix, "activo": true }
display = código de 2 letras del algoritmo
P1 = Gain  rango 0-30
P2 = Mix   rango 0-10  (mantener ≤7 para preservar graves)

AG  AMPEG SVT         — Rock/Metal. Graves densos.
SB  SUPER BASS        — Rock clásico. Midrange británico.
SW  SWR SM-900        — Funk/Slap. Transparente.
AC  ACOUSTIC 360      — Jazz/Soul. Medios ricos.
BM  BASSMAN           — Blues/Rock 60s. Cálido.
HA  HARTKE HA3500     — Fusion/Pop. Hi-fi.
TE  TRACE ELLIOT      — Rock/Fusion. Carácter inglés.
TU  TUBE PRE          — Todos los géneros. Cálido/cremoso.
SA  SANSAMP           — Grabación directa. Pulido.
TS  TS9 Tube Screamer — Overdrive suave. Blues/Rock.
OD  ODB-3             — Distorsión agresiva. Metal/Punk.
DS  MXR Bass D.I.+    — Distorsión controlada. Rock/Metal.
FF  FUZZ FACE         — Fuzz psicodélico. Rock 60s/Hendrix.
MS  MONO SYN          — Sintetizador (P1=s/p/m, P2=Mix 0-10)

Ejemplo activo: { "display": "FF", "GAIN": 20, "MIX": 7, "activo": true }
Ejemplo off:    { "activo": false }

── EQ ──────────────────────────────────────────────────
Formato JSON: { "LO": #, "MID": #, "HI": # }
Escala de hardware 8-18.  13 = flat (0 dB).
8-12 = corte (negativo).  14-18 = realce (positivo).
LO=70Hz (cuerpo)   MID=450Hz (presencia)   HI=3kHz (brillo/ataque)

Ejemplos:
Flat:                         { "LO": 13, "MID": 13, "HI": 13 }
Realzar medios (corta mezcla):{ "LO": 13, "MID": 16, "HI": 14 }
Slap/Pick (curva V):          { "LO": 16, "MID": 11, "HI": 16 }
Compensación Peavey Decade:   { "LO": 13, "MID": 15, "HI": 15 }

── ZNR ─────────────────────────────────────────────────
Formato JSON: número entero directo (NO objeto).
Rango 0-9.  0=off.  1-3=suave.  4-6=medio.  7-9=agresivo.
Single coil (Strat): 4-6.  Alta ganancia: 6-8.

Ejemplo: "ZNR": 5

── MOD/DELAY ───────────────────────────────────────────
Formato JSON: { "display": "X#", "P2": valor, "activo": true }
display = código pantalla (letra+dígito 1-9)
P2 = segundo parámetro (Rate, Time o sin P2 según algoritmo)

MODULACIÓN (P2 = Rate 1-50):
C1-C9  Chorus   — P2=Rate(1-50). Rate 1-5=orgánico, 6+=artificial.
F1-F9  Flanger  — P2=Rate(1-50).
V1-V9  Vibrato  — P2=Rate(1-50).
E1-E9  Ensemble — sin P2 (solo display).
S1-S9  Step     — sin P2 (solo display).

PITCH (P2 varía):
M1-M9  Mono Pitch Shift — P2=Semitonos(1-12) o "dt" para detune.
H1-H9  HPS              — P2=Clave tonal ("C","D","E","F","G","A","B").
B1-B9  Pitch Bend       — P2=Posición inicial pedal(0-10). Requiere pedal.
N1-N9  Detune           — P2=Afinación fina(0-25).

DELAY (P2 = Tiempo en ms, rango 10-5000):
D1-D9  Delay     — P2=Time ms(10-5000).
T1-T9  Tape Echo — P2=Time ms(10-5000).

Ejemplos:
Chorus activo:    { "display": "C5", "P2": 15, "activo": true }
Flanger activo:   { "display": "F4", "P2": 20, "activo": true }
Delay activo:     { "display": "D6", "P2": 380, "activo": true }
Ensemble activo:  { "display": "E5", "activo": true }
Off:              { "activo": false }

── REV/DELAY ───────────────────────────────────────────
Formato JSON: { "display": "X#", "P2": valor, "activo": true }
Máximo 3000ms (vs 5000ms de MOD/DELAY).
NOTA: se desactiva automáticamente si el RITMO está en reproducción.

REVERB (P2 = Decay 1-30):
H1-H9  Hall Reverb   — P2=Decay(1-30). Espacioso, largo.
R1-R9  Room Reverb   — P2=Decay(1-30). Natural, corto.
S1-S9  Spring Reverb — P2=Decay(1-30). Vintage años 60.

DELAY (P2 = Tiempo en ms, rango 10-3000):
D1-D9  Delay Digital — P2=Time ms(10-3000).
T1-T9  Tape Echo     — P2=Time ms(10-3000).
A1-A9  Analog Delay  — P2=Time ms(10-3000).
P1-P9  Ping Pong     — P2=Time ms(10-3000). Solo audible en stereo.

Ejemplos:
Hall activo:         { "display": "H5", "P2": 10, "activo": true }
Room activo:         { "display": "R4", "P2": 6, "activo": true }
Analog Delay activo: { "display": "A5", "P2": 380, "activo": true }
Off:                 { "activo": false }

── PATCH_LVL ───────────────────────────────────────────
Número entero directo. Rango 2-98. Default=80.
Ejemplo: "PATCH_LVL": 80
`;

// ══════════════════════════════════════════════════════
// MAPEO: tipo de efecto → prefijo de pantalla del Zoom B1
// Usado por el pre-asignador para determinar qué slot recibe cada efecto
// ══════════════════════════════════════════════════════
const TIPO_A_ALGORITMO = {
  'phaser':     ['PHASER', 'Phaser (EFX)'],
  'fuzz':       ['FUZZ FACE', 'SQUEAK'],
  'wah':        ['Auto Wah', 'Resonance Filter', 'Pedal Vox'],
  'chorus':     ['CHORUS', 'CE-CHORUS'],
  'delay':      ['ANALOGDLY', 'DELAY', 'Analog Delay', 'TAPE ECHO', 'Delay (MOD)', 'Delay (REV)'],
  'reverb':     ['HALL', 'ROOM', 'SPRING', 'PLATE', 'MOD REVERB', 'Hall Reverb', 'Room Reverb', 'Spring Reverb'],
  'flanger':    ['FLANGER'],
  'tremolo':    ['TREMOLO', 'Tremolo (EFX)'],
  'vibrato':    ['VIBRATO'],
  'overdrive':  ['TS Drive', 'GoldDRV'],
  'distorsion': ['SQUEAK', 'GoldDRV', 'TS Drive'],
  'compressor': ['M COMP', 'OptComp', 'BlackOpt', 'Compressor'],
  'filter':     ['Auto Wah', 'Resonance Filter'],
  'pitch':      ['Mono Pitch Shift', 'HPS', 'Octave'],
  'octave':     ['Octave'],
};

// Algoritmos del Zoom B1 que van en el slot EFX (no en MOD_DELAY)
const EFX_ALGORITMOS = [
  'Auto Wah','Resonance Filter','Pedal Vox',
  'PHASER','Phaser (EFX)','TREMOLO','Tremolo (EFX)',
  'VIBRATO','Ring Mod','Defret','Slow Attack (EFX)',
];

const SLOT_TYPE_A_KEY_PROC001 = (algoNombre, slotType) => {
  if (slotType === 'FLT' || slotType === 'EFX') return 'EFX';
  if (slotType === 'MOD') return EFX_ALGORITMOS.some(n => algoNombre.includes(n)) ? 'EFX' : 'MOD_DELAY';
  if (slotType === 'DIST' || slotType === 'AMP') return 'DRIVE';
  if (slotType === 'DLY') return 'MOD_DELAY';
  if (slotType === 'REV') return 'REV_DELAY';
  if (slotType === 'DYN') return 'COMP_LIMIT';
  if (slotType === 'EQ')  return 'EQ';
  if (slotType === 'PCT' || slotType === 'SIM') return 'MOD_DELAY';
  return 'MOD_DELAY';
};

const SLOT_TYPE_A_KEY_GENERIC = {
  'AMP':'AMP','DIST':'DIST','MOD':'MOD',
  'DLY':'DLY','DELAY':'DLY','REV':'REV','REVERB':'REV',
  'DYN':'DYN','EQ':'EQ','FLT':'DIST','EFX':'MOD',
};

// ══════════════════════════════════════════════════════
// PRE-ASIGNADOR
// ══════════════════════════════════════════════════════
const slots = PROCESSOR_SLOTS[procId] || PROCESSOR_SLOTS['PROC_001'];
const effectoToSlot = {};

equipment.forEach(efx => {
  const tipo = (efx.tipo || '').toLowerCase();
  const nombresObjetivo = TIPO_A_ALGORITMO[tipo] || [];

  const algoCandidato = algorithms.find(a =>
    nombresObjetivo.some(n => (a.Algoritmo||'').toLowerCase() === n.toLowerCase())
  ) || algorithms.find(a =>
    nombresObjetivo.some(n => (a.Algoritmo||'').toLowerCase().includes(n.toLowerCase()))
  );

  if (!algoCandidato) {
    console.log(`[PreAsignador] Sin candidato para tipo="${tipo}" efecto="${efx.nombre}"`);
    return;
  }

  const algoSlot = algoCandidato.Slot_Type || '';
  const slotKey = procId === 'PROC_001'
    ? SLOT_TYPE_A_KEY_PROC001(algoCandidato.Algoritmo, algoSlot)
    : (SLOT_TYPE_A_KEY_GENERIC[algoSlot] || 'MOD');

  if (effectoToSlot[slotKey]) {
    console.log(`[PreAsignador] Slot "${slotKey}" ya ocupado, saltando "${efx.nombre}"`);
    return;
  }

  // Obtener el prefijo de pantalla desde Display_Hardware del algoritmo
  const displayHW = algoCandidato.Display_Hardware || '';

  effectoToSlot[slotKey] = {
    efecto_artista: efx.nombre,
    tipo,
    algoritmo:   algoCandidato.Algoritmo,
    displayHW,
    target_real: algoCandidato.Target_Real_ID || '',
    candidatos:  algorithms
      .filter(a => nombresObjetivo.some(n => (a.Algoritmo||'').toLowerCase().includes(n.toLowerCase())))
      .map(a => `${a.Algoritmo} (${a.Display_Hardware||''})`)
      .slice(0, 4),
  };
  console.log(`[PreAsignador] "${efx.nombre}" (${tipo}) → slot="${slotKey}" algoritmo="${algoCandidato.Algoritmo}" display="${displayHW}"`);
});

// ── Bloque de slots pre-asignados ──
const slotsBlock = slots.map(slotDef => {
  const assigned = effectoToSlot[slotDef.key];
  if (slotDef.fixed) {
    return `[${slotDef.key}] ${slotDef.label} — FIJO (siempre presente, ajusta valores según el tono)`;
  }
  if (assigned) {
    return `[${slotDef.key}] ${slotDef.label} — emula: "${assigned.efecto_artista}" (${assigned.tipo})\n  Algoritmo BD: "${assigned.algoritmo}" | Prefijo pantalla: "${assigned.displayHW}"\n  Alternativos: ${assigned.candidatos.join(', ')}`;
  }
  return `[${slotDef.key}] ${slotDef.label} — off (el artista no usa este efecto en esta canción)`;
}).join('\n\n');

const efectosPrincipales = equipment.filter(e => !['volume','tuner'].includes((e.tipo||'').toLowerCase()));
const numPresets = Math.min(Math.max(efectosPrincipales.length, 1), 3);

const toneCtx = tr ? [
  `NIVEL DE GANANCIA: ${tr.nivelDistorsion || 'no especificado'}`,
  `TONO LIMPIO: ${tr.esTocadoLimpio ? 'SI — DRIVE off' : 'No'}`,
  `CADENA ORIGINAL: ${(tr.cadenaSenal||[]).join(' -> ') || 'no especificada'}`,
  `AMP ORIGINAL: ${tr.amplificador ? (tr.amplificador.marca+' '+tr.amplificador.modelo).trim() : 'no especificado'}`,
  `GUITARRA ORIGINAL: ${tr.guitarra ? (tr.guitarra.marca+' '+tr.guitarra.modelo+' — '+tr.guitarra.pastillas).trim() : 'no especificada'}`,
  `TECNICA: ${(tr.techniques||[]).join(' | ') || 'no especificada'}`,
  `NOTAS: ${tr.notes || 'ninguna'}`,
].join('\n') : 'Sin datos de tono investigado.';

let ampBlock = '';
if (ampSpecs.userAmp || ampSpecs.artistAmp) {
  if (ampSpecs.artistAmp) {
    ampBlock += `AMP ARTISTA — ${ampSpecs.artistAmp.nombre}:\n`;
    ampBlock += `  Controles: ${ampSpecs.artistAmp.controles} | Rango: ${ampSpecs.artistAmp.rango}\n`;
    if (ampSpecs.artistAmp.sweetSpots) ampBlock += `  Sweet spots: ${ampSpecs.artistAmp.sweetSpots}\n`;
  }
  if (ampSpecs.userAmp) {
    ampBlock += `\nAMP USUARIO — ${ampSpecs.userAmp.nombre} (gearId: ${ampSpecs.userAmp.gearId}):\n`;
    ampBlock += `  Controles: ${ampSpecs.userAmp.controles} | Rango: ${ampSpecs.userAmp.rango}\n`;
    if (ampSpecs.userAmp.sweetSpots) ampBlock += `  Sweet spots: ${ampSpecs.userAmp.sweetSpots}\n`;
    ampBlock += `  INSTRUCCION: Configura el amp del usuario para aproximar el carácter del amp del artista.`;
  }
}

const procSpecs = processorModel.length > 0
  ? 'ESPECIFICACIONES DEL PROCESADOR:\n' + Object.entries(processorModel[0])
      .filter(([k]) => !['ID_Proc','ID'].includes(k))
      .map(([k,v]) => `  * ${k}: ${v}`).join('\n')
  : '';

const gearIdsBloque = 'GEAR IDs REALES DE MONGODB — COPIAR EXACTAMENTE:\n' +
  gear.map((g, i) => `  equipo_${i+1}: gearId="${g._id}" | ${g.name || ((g.brand||'')+(g.model||'')).trim()} | type:${g.type}`).join('\n');

const staticList  = staticGear.map(g => `gearId:"${g._id}" (${g.type}: ${(g.brand||'').trim()} ${(g.model||'').trim()})`).join(', ') || 'ninguno';
const dynamicList = dynamicGear.map(g => `gearId:"${g._id}" (${g.type}: ${(g.brand||'').trim()} ${(g.model||'').trim()})`).join(', ') || 'ninguno';

// ══════════════════════════════════════════════════════
// SYSTEM PROMPT
// ══════════════════════════════════════════════════════
const systemPrompt = `Eres GuitarTone AI Engine — técnico de sonido senior especializado en procesadores de efectos digitales.

Tu única función: recibir datos de una canción + equipo del usuario + slots PRE-ASIGNADOS, y generar un JSON de presets con valores numéricos exactos y texto explicativo en español.

PROHIBICIONES ABSOLUTAS:
1. NUNCA uses un algoritmo diferente al indicado en SLOTS PRE-ASIGNADOS.
2. NUNCA inventes valores fuera del rango definido en la REFERENCIA.
3. NUNCA incluyas texto, markdown o comentarios fuera del JSON.
4. NUNCA pongas amplificadores/guitarras en presetsData.configuracion[].
5. NUNCA pongas procesadores en configuracion_base[].
6. Si esTocadoLimpio=true o nivelDistorsion=clean: DRIVE off.
7. NUNCA inventes gearIds. Copia EXACTAMENTE los ObjectIds del user message.

REGLA DE SLOTS:
- Slot "off" → { "activo": false } únicamente. Sin display, sin parámetros.
- Slot "FIJO" → siempre presente con valores según la canción.
- Slot activo → usar EXACTAMENTE el formato de la REFERENCIA del módulo.

${procId === 'PROC_001' ? ZOOM_B1_REFERENCIA : ''}

REGLAS DE PRESETS:
- Genera EXACTAMENTE ${numPresets} preset(s).
- Cada preset tiene UN efecto protagonista diferente.
- tag: uno de RIFF, CORO, SOLO, PUENTE, INTRO, VERSO.
- etiqueta: nombre corto del momento.
- descripcion_corta: 4-6 palabras del sonido.
- explicacion: 2-4 frases en español sobre el efecto, el amp y qué esperar al tocar.
- consejos: mínimo 2 tips prácticos de uso en vivo.

ESTRUCTURA DE MODULOS PARA ${procId}:
${slots.map(s => `- ${s.key}: "${s.label}"`).join('\n')}

FORMATO DE SALIDA — solo JSON válido. Ejemplo completo para PROC_001:
{
  "configuracion_base": [
    {
      "gearId": "ObjectId exacto",
      "gearNombre": "Peavey Decade",
      "gearTipo": "amplificador",
      "parametros": { "Gain": 5, "Bass": 6, "Middle": 5, "Treble": 6 }
    }
  ],
  "presetsData": [
    {
      "nombre": "A0",
      "tag": "RIFF",
      "etiqueta": "Riff principal",
      "descripcion_corta": "Wah rítmico con crunch suave",
      "momento_cancion": "0:00-1:30",
      "efecto_principal": "Auto Wah",
      "explicacion": "El Auto Wah A7 responde al ataque de la púa abriendo el filtro...",
      "configuracion": [
        {
          "gearId": "ObjectId exacto",
          "gearNombre": "zoom b1",
          "gearTipo": "procesador",
          "modulos": {
            "COMP_LIMIT": { "activo": false },
            "EFX":        { "display": "A7", "activo": true },
            "DRIVE":      { "display": "FF", "P1": 20, "P2": 7, "activo": true },
            "EQ":         { "LO": 13, "MID": 15, "HI": 15 },
            "ZNR":        5,
            "MOD_DELAY":  { "activo": false },
            "REV_DELAY":  { "activo": false },
            "PATCH_LVL":  80
          }
        }
      ],
      "nota_tecnica": null,
      "consejos": ["tip 1", "tip 2"]
    }
  ],
  "advertencia": null
}`;

// ══════════════════════════════════════════════════════
// USER MESSAGE
// ══════════════════════════════════════════════════════
const userMessage = `CANCION: "${song.title}" — ${song.artist}

TONO DEL ARTISTA:
${toneCtx}

${ampBlock ? 'AMPLIFICADORES:\n' + ampBlock + '\n\n' : ''}PROCESADOR ACTIVO: ${procId}
${procSpecs}

SLOTS PRE-ASIGNADOS PARA ${procId} (${slots.length} slots):
${slotsBlock}

${gearIdsBloque}

EQUIPO FISICO DEL USUARIO:
${gear.map((g, idx) => {
  let line = `[EQUIPO ${idx+1}] gearId:${g._id} | ${(g.brand||'').trim()} ${(g.model||'').trim()} | type:${g.type}`;
  if (g.name) line += `\n  Nombre: ${g.name}`;
  return line;
}).join('\n\n')}

SEPARACION OBLIGATORIA:
* configuracion_base → ${staticList}
* presetsData.configuracion[] → ${dynamicList}

Genera EXACTAMENTE ${numPresets} preset(s). Solo JSON.`;

console.log(`[Build OpenAI Prompt v6] procId=${procId} slots=${slots.length} efectos=${equipment.length} presets=${numPresets} asignados=${Object.keys(effectoToSlot).join(',')}`);

return [{ json: { systemPrompt, userMessage, procId, songDbId: payload.songDbId, userId: payload.userId, songTitle: song.title, songArtist: song.artist } }];
