import 'dotenv/config';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Definir el esquema de Song (igual que en la app)
const songSchema = new mongoose.Schema({
  musicBrainzId: { type: String, required: true, unique: true, index: true },
  title: { type: String, required: true },
  artist: { type: String, required: true },
  releaseDate: { type: String },
  coverUrl: { type: String },
  toneResearch: {
    equipment: [
      {
        nombre: String,
        tipo: String,
        posicion: String,
      },
    ],
    amplificador: {
      marca: String,
      modelo: String,
      configuracion: String,
    },
    guitarra: {
      marca: String,
      modelo: String,
      pastillas: String,
    },
    cadenaSenal: [String],
    techniques: [String],
    notes: String,
    nivelDistorsion: String,
    esTocadoLimpio: Boolean,
    estructura: [
      {
        seccion: String,
        dinamica: String,
        nivel_distorsion: String,
        efectos_clave: [String],
        tecnica: String,
      },
    ],
    researchedAt: Date,
  },
}, { timestamps: true });

const Song = mongoose.model('Song', songSchema);

// Lista de canciones a insertar
const songs = [
  // ===== JUPITER =====
  {
    "musicBrainzId": "manual_dani_california",
    "title": "Dani California",
    "artist": "Red Hot Chili Peppers",
    "coverUrl": "...",
    "toneResearch": {
      "equipment": [
        {"nombre":"Boss DS-2 Turbo Distortion","tipo":"distortion","posicion":"principal"},
        {"nombre":"MXR Micro Amp","tipo":"boost","posicion":"después"},
        {"nombre":"Ibanez WH-10 Wah","tipo":"wah","posicion":"solo"}
      ],
      "amplificador":{"marca":"Marshall","modelo":"Silver Jubilee + Major","configuracion":"gain medio, master alto"},
      "guitarra":{"marca":"Fender","modelo":"Stratocaster","pastillas":"bridge"},
      "cadenaSenal":["guitarra","Boss DS-2","MXR Micro Amp","Ibanez WH-10 Wah","amplificador"],
      "techniques":["riff rock","alternate picking","solo con bends amplios"],
      "notes":"Distorsión principal del DS-2.",
      "nivelDistorsion":"high-gain",
      "esTocadoLimpio":false,
      "estructura":[
        {"seccion":"intro","dinamica":"mf","nivel_distorsion":"crunch","efectos_clave":["Boss DS-2"],"tecnica":"riff palm mute"},
        {"seccion":"verso","dinamica":"mf","nivel_distorsion":"crunch","efectos_clave":["Boss DS-2"],"tecnica":"riff rock"},
        {"seccion":"coro","dinamica":"f","nivel_distorsion":"high-gain","efectos_clave":["Boss DS-2","MXR Micro Amp"],"tecnica":"power chords abiertos"},
        {"seccion":"solo","dinamica":"ff","nivel_distorsion":"high-gain","efectos_clave":["Boss DS-2","Ibanez WH-10 Wah"],"tecnica":"bends amplios con wah"}
      ],
      "researchedAt":"2026-03-23T00:00:00.000Z"
    }
  },
  {
    "musicBrainzId": "manual_snow",
    "title": "Snow (Hey Oh)",
    "artist": "Red Hot Chili Peppers",
    "coverUrl": "...",
    "toneResearch": {
      "equipment":[
        {"nombre":"Compresor (rack)","tipo":"compressor","posicion":"activo"},
        {"nombre":"Boss CE-1 Chorus Ensemble","tipo":"chorus","posicion":"sutil"}
      ],
      "amplificador":{"marca":"Fender","modelo":"Twin Reverb","configuracion":"clean brillante"},
      "guitarra":{"marca":"Fender","modelo":"Stratocaster","pastillas":"posición 2"},
      "cadenaSenal":["guitarra","compressor","Boss CE-1","amplificador"],
      "techniques":["alternate picking continuo","arpegios rápidos"],
      "notes":"Compresión clave.",
      "nivelDistorsion":"clean",
      "esTocadoLimpio":true,
      "estructura":[
        {"seccion":"verso","dinamica":"mf","nivel_distorsion":"clean","efectos_clave":["compressor","Boss CE-1"],"tecnica":"alternate picking continuo"},
        {"seccion":"coro","dinamica":"f","nivel_distorsion":"clean","efectos_clave":["compressor","Boss CE-1"],"tecnica":"arpegios rapidos mas intensos"}
      ],
      "researchedAt":"2026-03-23T00:00:00.000Z"
    }
  },
  {
    "musicBrainzId": "manual_charlie",
    "title": "Charlie",
    "artist": "Red Hot Chili Peppers",
    "coverUrl": "...",
    "toneResearch": {
      "equipment":[{"nombre":"MXR Micro Amp","tipo":"boost","posicion":"leve"}],
      "amplificador":{"marca":"Marshall","modelo":"Silver Jubilee","configuracion":"edge breakup"},
      "guitarra":{"marca":"Fender","modelo":"Stratocaster","pastillas":"single coil"},
      "cadenaSenal":["guitarra","MXR Micro Amp","amplificador"],
      "techniques":["funk riff","ghost notes"],
      "notes":"Tono dinámico.",
      "nivelDistorsion":"edge",
      "esTocadoLimpio":false,
      "researchedAt":"2026-03-23T00:00:00.000Z"
    }
  },
  {
    "musicBrainzId": "manual_stadium_arcadium",
    "title": "Stadium Arcadium",
    "artist": "Red Hot Chili Peppers",
    "coverUrl": "...",
    "toneResearch": {
      "equipment":[{"nombre":"Delay","tipo":"delay","posicion":"ambiente"}],
      "amplificador":{"marca":"Fender","modelo":"Twin Reverb","configuracion":"clean"},
      "guitarra":{"marca":"Fender","modelo":"Stratocaster","pastillas":"neck"},
      "cadenaSenal":["guitarra","delay","amplificador"],
      "techniques":["melodía","bends largos"],
      "notes":"Mucho espacio.",
      "nivelDistorsion":"clean",
      "esTocadoLimpio":true,
      "researchedAt":"2026-03-23T00:00:00.000Z"
    }
  },

  {
    "musicBrainzId": "manual_hump_de_bump",
    "title": "Hump de Bump",
    "artist": "Red Hot Chili Peppers",
    "coverUrl": "...",
    "toneResearch": {
      "equipment":[{"nombre":"Ibanez WH-10 Wah","tipo":"wah","posicion":"constante"}],
      "amplificador":{"marca":"Marshall","modelo":"Jubilee","configuracion":"crunch funk"},
      "guitarra":{"marca":"Fender","modelo":"Stratocaster","pastillas":"single coil"},
      "cadenaSenal":["guitarra","Ibanez WH-10 Wah","amplificador"],
      "techniques":["funk con wah","groove"],
      "notes":"Wah protagonista.",
      "nivelDistorsion":"crunch",
      "esTocadoLimpio":false,
      "researchedAt":"2026-03-23T00:00:00.000Z"
    }
  },

  {
    "musicBrainzId": "manual_she_looks_to_me",
    "title": "She Looks to Me",
    "artist": "Red Hot Chili Peppers",
    "coverUrl": "...",
    "toneResearch": {
      "equipment":[{"nombre":"Delay","tipo":"delay","posicion":"ambiente"}],
      "amplificador":{"marca":"Fender","modelo":"Twin Reverb","configuracion":"clean cálido"},
      "guitarra":{"marca":"Fender","modelo":"Stratocaster","pastillas":"neck"},
      "cadenaSenal":["guitarra","delay","amplificador"],
      "techniques":["melodía expresiva","bends suaves"],
      "notes":"Ambiente amplio.",
      "nivelDistorsion":"clean",
      "esTocadoLimpio":true,
      "researchedAt":"2026-03-23T00:00:00.000Z"
    }
  },

  {
    "musicBrainzId": "manual_tell_me_baby",
    "title": "Tell Me Baby",
    "artist": "Red Hot Chili Peppers",
    "coverUrl": "...",
    "toneResearch": {
      "equipment":[{"nombre":"MXR Micro Amp","tipo":"boost","posicion":"leve"}],
      "amplificador":{"marca":"Marshall","modelo":"Jubilee","configuracion":"edge"},
      "guitarra":{"marca":"Fender","modelo":"Stratocaster","pastillas":"single coil"},
      "cadenaSenal":["guitarra","MXR Micro Amp","amplificador"],
      "techniques":["riff funky","ghost notes"],
      "notes":"Entre limpio y crunch.",
      "nivelDistorsion":"edge",
      "esTocadoLimpio":false,
      "researchedAt":"2026-03-23T00:00:00.000Z"
    }
  },

  {
    "musicBrainzId": "manual_hard_to_concentrate",
    "title": "Hard to Concentrate",
    "artist": "Red Hot Chili Peppers",
    "coverUrl": "...",
    "toneResearch": {
      "equipment":[{"nombre":"Chorus ligero","tipo":"chorus","posicion":"sutil"}],
      "amplificador":{"marca":"Fender","modelo":"Twin Reverb","configuracion":"clean"},
      "guitarra":{"marca":"Fender","modelo":"Stratocaster","pastillas":"neck"},
      "cadenaSenal":["guitarra","chorus","amplificador"],
      "techniques":["arpegios limpios","dinámica suave"],
      "notes":"Tono cálido y limpio.",
      "nivelDistorsion":"clean",
      "esTocadoLimpio":true,
      "researchedAt":"2026-03-23T00:00:00.000Z"
    }
  },

  {
    "musicBrainzId": "manual_21st_century",
    "title": "21st Century",
    "artist": "Red Hot Chili Peppers",
    "coverUrl": "...",
    "toneResearch": {
      "equipment":[{"nombre":"MXR Micro Amp","tipo":"boost","posicion":"activo"}],
      "amplificador":{"marca":"Marshall","modelo":"Jubilee","configuracion":"crunch"},
      "guitarra":{"marca":"Fender","modelo":"Stratocaster","pastillas":"bridge"},
      "cadenaSenal":["guitarra","MXR Micro Amp","amplificador"],
      "techniques":["riff funk","palm mute"],
      "notes":"Crunch rítmico.",
      "nivelDistorsion":"crunch",
      "esTocadoLimpio":false,
      "researchedAt":"2026-03-23T00:00:00.000Z"
    }
  },

  {
    "musicBrainzId": "manual_slow_cheetah",
    "title": "Slow Cheetah",
    "artist": "Red Hot Chili Peppers",
    "coverUrl": "...",
    "toneResearch": {
      "equipment":[{"nombre":"Delay","tipo":"delay","posicion":"ambiente"}],
      "amplificador":{"marca":"Fender","modelo":"Twin Reverb","configuracion":"clean"},
      "guitarra":{"marca":"Fender","modelo":"Stratocaster","pastillas":"neck"},
      "cadenaSenal":["guitarra","delay","amplificador"],
      "techniques":["fraseo lento","bends suaves"],
      "notes":"Mucho espacio.",
      "nivelDistorsion":"clean",
      "esTocadoLimpio":true,
      "estructura":[
        {"seccion":"verso","dinamica":"p","nivel_distorsion":"clean","efectos_clave":["delay"],"tecnica":"fraseo lento"},
        {"seccion":"coro","dinamica":"mf","nivel_distorsion":"light-crunch","efectos_clave":["delay"],"tecnica":"strumming abierto"},
        {"seccion":"outro","dinamica":"f","nivel_distorsion":"crunch","efectos_clave":["delay"],"tecnica":"crescendo final"}
      ],
      "researchedAt":"2026-03-23T00:00:00.000Z"
    }
  },

  // ===== MARS =====

  {
    "musicBrainzId": "manual_wet_sand",
    "title": "Wet Sand",
    "artist": "Red Hot Chili Peppers",
    "coverUrl": "...",
    "toneResearch": {
      "equipment":[
        {"nombre":"Boss DS-2 Turbo Distortion","tipo":"distortion","posicion":"solo"},
        {"nombre":"Delay","tipo":"delay","posicion":"ambiente"}
      ],
      "amplificador":{"marca":"Marshall","modelo":"Jubilee","configuracion":"dinámico"},
      "guitarra":{"marca":"Fender","modelo":"Stratocaster","pastillas":"single coil"},
      "cadenaSenal":["guitarra","Boss DS-2","delay","amplificador"],
      "techniques":["crescendo","feedback","solo emocional"],
      "notes":"Gran dinámica.",
      "nivelDistorsion":"crunch",
      "esTocadoLimpio":false,
      "estructura":[
        {"seccion":"intro","dinamica":"p","nivel_distorsion":"clean","efectos_clave":["delay"],"tecnica":"arpegios limpios"},
        {"seccion":"verso","dinamica":"mp","nivel_distorsion":"light-crunch","efectos_clave":["delay"],"tecnica":"strumming suave"},
        {"seccion":"coro","dinamica":"f","nivel_distorsion":"crunch","efectos_clave":["Boss DS-2","delay"],"tecnica":"power chords"},
        {"seccion":"solo","dinamica":"ff","nivel_distorsion":"high-gain","efectos_clave":["Boss DS-2","delay"],"tecnica":"solo emocional con feedback"}
      ],
      "researchedAt":"2026-03-23T00:00:00.000Z"
    }
  },

  {
    "musicBrainzId": "manual_especially_in_michigan",
    "title": "Especially in Michigan",
    "artist": "Red Hot Chili Peppers",
    "coverUrl": "...",
    "toneResearch": {
      "equipment":[{"nombre":"Delay","tipo":"delay","posicion":"sutil"}],
      "amplificador":{"marca":"Marshall","modelo":"Jubilee","configuracion":"clean-crunch"},
      "guitarra":{"marca":"Fender","modelo":"Stratocaster","pastillas":"middle"},
      "cadenaSenal":["guitarra","delay","amplificador"],
      "techniques":["riff limpio","dinámica"],
      "notes":"Textura ambiental.",
      "nivelDistorsion":"edge",
      "esTocadoLimpio":false,
      "researchedAt":"2026-03-23T00:00:00.000Z"
    }
  },

  {
    "musicBrainzId": "manual_warlocks",
    "title": "Warlocks",
    "artist": "Red Hot Chili Peppers",
    "coverUrl": "...",
    "toneResearch": {
      "equipment":[{"nombre":"Ibanez WH-10 Wah","tipo":"wah","posicion":"rítmico"}],
      "amplificador":{"marca":"Marshall","modelo":"Jubilee","configuracion":"crunch"},
      "guitarra":{"marca":"Fender","modelo":"Stratocaster","pastillas":"bridge"},
      "cadenaSenal":["guitarra","Ibanez WH-10 Wah","amplificador"],
      "techniques":["riff funk","wah groove"],
      "notes":"Ritmo marcado.",
      "nivelDistorsion":"crunch",
      "esTocadoLimpio":false,
      "researchedAt":"2026-03-23T00:00:00.000Z"
    }
  },

  {
    "musicBrainzId": "manual_cmon_girl",
    "title": "C'mon Girl",
    "artist": "Red Hot Chili Peppers",
    "coverUrl": "...",
    "toneResearch": {
      "equipment":[{"nombre":"MXR Micro Amp","tipo":"boost","posicion":"activo"}],
      "amplificador":{"marca":"Marshall","modelo":"Jubilee","configuracion":"crunch"},
      "guitarra":{"marca":"Fender","modelo":"Stratocaster","pastillas":"bridge"},
      "cadenaSenal":["guitarra","MXR Micro Amp","amplificador"],
      "techniques":["riff rock","ataque fuerte"],
      "notes":"Energía rock.",
      "nivelDistorsion":"crunch",
      "esTocadoLimpio":false,
      "researchedAt":"2026-03-23T00:00:00.000Z"
    }
  },

  {
    "musicBrainzId": "manual_torture_me",
    "title": "Torture Me",
    "artist": "Red Hot Chili Peppers",
    "coverUrl": "...",
    "toneResearch": {
      "equipment":[{"nombre":"Boss DS-2 Turbo Distortion","tipo":"distortion","posicion":"principal"}],
      "amplificador":{"marca":"Marshall","modelo":"Jubilee","configuracion":"gain alto"},
      "guitarra":{"marca":"Fender","modelo":"Stratocaster","pastillas":"bridge"},
      "cadenaSenal":["guitarra","Boss DS-2","amplificador"],
      "techniques":["riff agresivo","palm mute"],
      "notes":"Alta ganancia.",
      "nivelDistorsion":"high-gain",
      "esTocadoLimpio":false,
      "researchedAt":"2026-03-23T00:00:00.000Z"
    }
  },

  {
    "musicBrainzId": "manual_strip_my_mind",
    "title": "Strip My Mind",
    "artist": "Red Hot Chili Peppers",
    "coverUrl": "...",
    "toneResearch": {
      "equipment":[{"nombre":"Delay","tipo":"delay","posicion":"ambiente"}],
      "amplificador":{"marca":"Marshall","modelo":"Jubilee","configuracion":"clean-crunch"},
      "guitarra":{"marca":"Fender","modelo":"Stratocaster","pastillas":"neck"},
      "cadenaSenal":["guitarra","delay","amplificador"],
      "techniques":["melodía","solo expresivo"],
      "notes":"Gran sustain.",
      "nivelDistorsion":"edge",
      "esTocadoLimpio":false,
      "researchedAt":"2026-03-23T00:00:00.000Z"
    }
  },

  {
    "musicBrainzId": "manual_readymade",
    "title": "Readymade",
    "artist": "Red Hot Chili Peppers",
    "coverUrl": "...",
    "toneResearch": {
      "equipment":[{"nombre":"Boss DS-2 Turbo Distortion","tipo":"distortion","posicion":"principal"}],
      "amplificador":{"marca":"Marshall","modelo":"Jubilee","configuracion":"gain alto"},
      "guitarra":{"marca":"Fender","modelo":"Stratocaster","pastillas":"bridge"},
      "cadenaSenal":["guitarra","Boss DS-2","amplificador"],
      "techniques":["riff hard rock","palm mute"],
      "notes":"Sonido directo.",
      "nivelDistorsion":"high-gain",
      "esTocadoLimpio":false,
      "researchedAt":"2026-03-23T00:00:00.000Z"
    }
  },

  {
    "musicBrainzId": "manual_if",
    "title": "If",
    "artist": "Red Hot Chili Peppers",
    "coverUrl": "...",
    "toneResearch": {
      "equipment":[],
      "amplificador":{"marca":"Fender","modelo":"Twin Reverb","configuracion":"clean"},
      "guitarra":{"marca":"Fender","modelo":"Stratocaster","pastillas":"neck"},
      "cadenaSenal":["guitarra","amplificador"],
      "techniques":["fingerpicking","dinámica suave"],
      "notes":"Muy limpio.",
      "nivelDistorsion":"clean",
      "esTocadoLimpio":true,
      "researchedAt":"2026-03-23T00:00:00.000Z"
    }
  },

  {
    "musicBrainzId": "manual_make_you_feel_better",
    "title": "Make You Feel Better",
    "artist": "Red Hot Chili Peppers",
    "coverUrl": "...",
    "toneResearch": {
      "equipment":[{"nombre":"MXR Micro Amp","tipo":"boost","posicion":"leve"}],
      "amplificador":{"marca":"Marshall","modelo":"Jubilee","configuracion":"crunch ligero"},
      "guitarra":{"marca":"Fender","modelo":"Stratocaster","pastillas":"middle"},
      "cadenaSenal":["guitarra","MXR Micro Amp","amplificador"],
      "techniques":["riff pop rock","arpegios"],
      "notes":"Brillante.",
      "nivelDistorsion":"edge",
      "esTocadoLimpio":false,
      "researchedAt":"2026-03-23T00:00:00.000Z"
    }
  },

  {
    "musicBrainzId": "manual_animal_bar",
    "title": "Animal Bar",
    "artist": "Red Hot Chili Peppers",
    "coverUrl": "...",
    "toneResearch": {
      "equipment":[{"nombre":"Delay","tipo":"delay","posicion":"ambiente"}],
      "amplificador":{"marca":"Fender","modelo":"Twin Reverb","configuracion":"clean"},
      "guitarra":{"marca":"Fender","modelo":"Stratocaster","pastillas":"neck"},
      "cadenaSenal":["guitarra","delay","amplificador"],
      "techniques":["melodía","espacio"],
      "notes":"Atmosférico.",
      "nivelDistorsion":"clean",
      "esTocadoLimpio":true,
      "researchedAt":"2026-03-23T00:00:00.000Z"
    }
  },

  {
    "musicBrainzId": "manual_so_much_i",
    "title": "So Much I",
    "artist": "Red Hot Chili Peppers",
    "coverUrl": "...",
    "toneResearch": {
      "equipment":[{"nombre":"MXR Micro Amp","tipo":"boost","posicion":"activo"}],
      "amplificador":{"marca":"Marshall","modelo":"Jubilee","configuracion":"crunch"},
      "guitarra":{"marca":"Fender","modelo":"Stratocaster","pastillas":"bridge"},
      "cadenaSenal":["guitarra","MXR Micro Amp","amplificador"],
      "techniques":["riff funk","groove"],
      "notes":"Rítmico.",
      "nivelDistorsion":"crunch",
      "esTocadoLimpio":false,
      "researchedAt":"2026-03-23T00:00:00.000Z"
    }
  },

  {
    "musicBrainzId": "manual_storm_in_a_teacup",
    "title": "Storm in a Teacup",
    "artist": "Red Hot Chili Peppers",
    "coverUrl": "...",
    "toneResearch": {
      "equipment":[{"nombre":"Ibanez WH-10 Wah","tipo":"wah","posicion":"activo"}],
      "amplificador":{"marca":"Marshall","modelo":"Jubilee","configuracion":"crunch"},
      "guitarra":{"marca":"Fender","modelo":"Stratocaster","pastillas":"bridge"},
      "cadenaSenal":["guitarra","Ibanez WH-10 Wah","amplificador"],
      "techniques":["riff funk","wah dinámico"],
      "notes":"Groove.",
      "nivelDistorsion":"crunch",
      "esTocadoLimpio":false,
      "researchedAt":"2026-03-23T00:00:00.000Z"
    }
  },

  {
    "musicBrainzId": "manual_we_believe",
    "title": "We Believe",
    "artist": "Red Hot Chili Peppers",
    "coverUrl": "...",
    "toneResearch": {
      "equipment":[{"nombre":"Delay","tipo":"delay","posicion":"ambiente"}],
      "amplificador":{"marca":"Marshall","modelo":"Jubilee","configuracion":"clean-crunch"},
      "guitarra":{"marca":"Fender","modelo":"Stratocaster","pastillas":"middle"},
      "cadenaSenal":["guitarra","delay","amplificador"],
      "techniques":["riff limpio","dinámica"],
      "notes":"Textura.",
      "nivelDistorsion":"edge",
      "esTocadoLimpio":false,
      "researchedAt":"2026-03-23T00:00:00.000Z"
    }
  },

  {
    "musicBrainzId": "manual_turn_it_again",
    "title": "Turn It Again",
    "artist": "Red Hot Chili Peppers",
    "coverUrl": "...",
    "toneResearch": {
      "equipment":[{"nombre":"Boss DS-2 Turbo Distortion","tipo":"distortion","posicion":"principal"}],
      "amplificador":{"marca":"Marshall","modelo":"Jubilee","configuracion":"gain alto"},
      "guitarra":{"marca":"Fender","modelo":"Stratocaster","pastillas":"bridge"},
      "cadenaSenal":["guitarra","Boss DS-2","amplificador"],
      "techniques":["riff complejo","solo largo"],
      "notes":"Capas de guitarra.",
      "nivelDistorsion":"high-gain",
      "esTocadoLimpio":false,
      "estructura":[
        {"seccion":"intro","dinamica":"mf","nivel_distorsion":"crunch","efectos_clave":["Boss DS-2"],"tecnica":"riff complejo"},
        {"seccion":"verso","dinamica":"f","nivel_distorsion":"high-gain","efectos_clave":["Boss DS-2"],"tecnica":"riff agresivo"},
        {"seccion":"solo","dinamica":"ff","nivel_distorsion":"high-gain","efectos_clave":["Boss DS-2"],"tecnica":"solo largo multi-capa"}
      ],
      "researchedAt":"2026-03-23T00:00:00.000Z"
    }
  },

  {
    "musicBrainzId": "manual_death_of_a_martian",
    "title": "Death of a Martian",
    "artist": "Red Hot Chili Peppers",
    "coverUrl": "...",
    "toneResearch": {
      "equipment":[{"nombre":"Delay","tipo":"delay","posicion":"ambiente"}],
      "amplificador":{"marca":"Fender","modelo":"Twin Reverb","configuracion":"clean"},
      "guitarra":{"marca":"Fender","modelo":"Stratocaster","pastillas":"neck"},
      "cadenaSenal":["guitarra","delay","amplificador"],
      "techniques":["melodía final","ambiente"],
      "notes":"Cierre atmosférico.",
      "nivelDistorsion":"clean",
      "esTocadoLimpio":true,
      "researchedAt":"2026-03-23T00:00:00.000Z"
    }
  }
];

// Cargar JSONs de carpetas en scripts/data/
function loadSongsFromDataDir(dirName) {
  const dirPath = path.join(__dirname, 'data', dirName);
  if (!fs.existsSync(dirPath)) {
    console.warn(`⚠️ Directorio no encontrado: ${dirPath}`);
    return [];
  }
  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));
  const loaded = [];
  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(dirPath, file), 'utf-8');
      loaded.push(JSON.parse(content));
    } catch (err) {
      console.error(`❌ Error leyendo ${file}: ${err.message}`);
    }
  }
  console.log(`📂 ${dirName}: ${loaded.length} canciones cargadas`);
  return loaded;
}

// Agregar canciones de carpetas de datos
const californicationSongs = loadSongsFromDataDir('californication');
songs.push(...californicationSongs);


function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function run() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('❌ MONGO_URI no definida en las variables de entorno');
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoUri);
    console.log('✅ Conectado a MongoDB');

    let inserted = 0;
    let updated = 0;
    let unchanged = 0;

    for (const song of songs) {
      const existing = await Song.findOne({
        title: { $regex: `^${escapeRegex(song.title)}$`, $options: 'i' },
        artist: { $regex: `^${escapeRegex(song.artist)}$`, $options: 'i' }
      });

      if (!existing) {
        await Song.create(song);
        inserted++;
        console.log(`✨ Insertada: ${song.title} (${song.artist})`);
        continue;
      }

      let needsUpdate = false;
      const updateFields = {};

      if (existing.coverUrl !== song.coverUrl) {
        updateFields.coverUrl = song.coverUrl;
        needsUpdate = true;
      }
      if (existing.musicBrainzId !== song.musicBrainzId) {
        updateFields.musicBrainzId = song.musicBrainzId;
        needsUpdate = true;
      }

      const existingResearched = existing.toneResearch?.researchedAt ? new Date(existing.toneResearch.researchedAt).getTime() : 0;
      const newResearched = song.toneResearch?.researchedAt ? new Date(song.toneResearch.researchedAt).getTime() : 0;
      if (newResearched >= existingResearched && newResearched > 0) {
        updateFields.toneResearch = song.toneResearch;
        needsUpdate = true;
      }

      if (needsUpdate) {
        await Song.updateOne({ _id: existing._id }, { $set: updateFields });
        updated++;
        console.log(`🔄 Actualizada: ${song.title} (${song.artist})`);
      } else {
        unchanged++;
        console.log(`⏭️ Sin cambios: ${song.title} (${song.artist})`);
      }
    }

    console.log('\n📊 Resumen:');
    console.log(`   Insertadas: ${inserted}`);
    console.log(`   Actualizadas: ${updated}`);
    console.log(`   Sin cambios: ${unchanged}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Desconectado de MongoDB');
  }
}

run();
