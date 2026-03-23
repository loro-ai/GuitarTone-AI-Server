import 'dotenv/config';
import mongoose from 'mongoose';

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
    researchedAt: Date,
  },
}, { timestamps: true });

const Song = mongoose.model('Song', songSchema);

// Lista de canciones a insertar
const songs = [
  {
    musicBrainzId: "manual_around_world",
    title: "Around the World",
    artist: "Red Hot Chili Peppers",
    coverUrl: "https://cdn-images.dzcdn.net/images/cover/49b073f55550d41055e02c493f9a...",
    toneResearch: {
      equipment: [
        { nombre: "Ibanez WH-10 Wah", tipo: "wah", posicion: "inicio cadena" },
        { nombre: "Boss DS-2 Turbo Distortion", tipo: "distortion", posicion: "después del wah" },
        { nombre: "MXR Micro Amp", tipo: "boost", posicion: "después de la distorsión" },
        { nombre: "Boss CE-1 Chorus Ensemble", tipo: "chorus", posicion: "después del boost" },
        { nombre: "Line 6 DL4 Delay Modeler", tipo: "delay", posicion: "antes del amplificador" }
      ],
      amplificador: {
        marca: "Marshall",
        modelo: "JCM 800 (2203)",
        configuracion: "gain alto, presencia media, eq: bass 6, mid 5, treble 7"
      },
      guitarra: {
        marca: "Fender",
        modelo: "Stratocaster 1962",
        pastillas: "single coil"
      },
      cadenaSenal: [
        "guitarra",
        "Ibanez WH-10 Wah",
        "Boss DS-2 Turbo Distortion",
        "MXR Micro Amp",
        "Boss CE-1 Chorus Ensemble",
        "Line 6 DL4 Delay Modeler",
        "amplificador"
      ],
      techniques: [
        "riff funk con palm mute y ataque percusivo",
        "solo con wah abierto y barridos de filtro",
        "uso de double stops en el solo"
      ],
      notes: "El riff principal usa DS-2 en modo II (turbo) con ganancia alta. El solo combina wah y delay.",
      nivelDistorsion: "high-gain",
      esTocadoLimpio: false,
      researchedAt: new Date("2026-03-23T00:00:00.000Z")
    }
  },
  {
    musicBrainzId: "manual_parallel_universe",
    title: "Parallel Universe",
    artist: "Red Hot Chili Peppers",
    coverUrl: "https://cdn-images.dzcdn.net/images/cover/49b073f55550d41055e02c493f9a...",
    toneResearch: {
      equipment: [
        { nombre: "Ibanez WH-10 Wah", tipo: "wah", posicion: "inicio cadena" },
        { nombre: "Boss DS-2 Turbo Distortion", tipo: "distortion", posicion: "después del wah" },
        { nombre: "MXR Micro Amp", tipo: "boost", posicion: "después de la distorsión" },
        { nombre: "Line 6 DL4 Delay Modeler", tipo: "delay", posicion: "antes del amplificador" }
      ],
      amplificador: {
        marca: "Marshall",
        modelo: "JCM 800 (2203)",
        configuracion: "gain alto, eq: bass 6, mid 5, treble 7, presencia 6"
      },
      guitarra: {
        marca: "Fender",
        modelo: "Stratocaster 1962",
        pastillas: "single coil"
      },
      cadenaSenal: [
        "guitarra",
        "Ibanez WH-10 Wah",
        "Boss DS-2 Turbo Distortion",
        "MXR Micro Amp",
        "Line 6 DL4 Delay Modeler",
        "amplificador"
      ],
      techniques: [
        "riff de octavas con palm mute",
        "solo con wah y delay slap",
        "bending agresivos en el solo"
      ],
      notes: "El riff principal usa DS-2 con ganancia alta. El solo usa wah abierto y delay. No se usa chorus.",
      nivelDistorsion: "high-gain",
      esTocadoLimpio: false,
      researchedAt: new Date("2026-03-23T00:00:00.000Z")
    }
  },
  {
    musicBrainzId: "manual_scar_tissue",
    title: "Scar Tissue",
    artist: "Red Hot Chili Peppers",
    coverUrl: "https://cdn-images.dzcdn.net/images/cover/49b073f55550d41055e02c493f9a...",
    toneResearch: {
      equipment: [
        { nombre: "Ibanez WH-10 Wah", tipo: "wah", posicion: "inicio cadena" },
        { nombre: "Boss DS-2 Turbo Distortion", tipo: "distortion", posicion: "después del wah" },
        { nombre: "MXR Micro Amp", tipo: "boost", posicion: "después de la distorsión" },
        { nombre: "Boss CE-1 Chorus Ensemble", tipo: "chorus", posicion: "después del boost" },
        { nombre: "Line 6 DL4 Delay Modeler", tipo: "delay", posicion: "antes del amplificador" }
      ],
      amplificador: {
        marca: "Marshall",
        modelo: "JCM 800 (2203)",
        configuracion: "gain medio-bajo, eq: bass 5, mid 6, treble 6, presencia 5"
      },
      guitarra: {
        marca: "Fender",
        modelo: "Stratocaster 1962",
        pastillas: "single coil"
      },
      cadenaSenal: [
        "guitarra",
        "Ibanez WH-10 Wah",
        "Boss DS-2 Turbo Distortion",
        "MXR Micro Amp",
        "Boss CE-1 Chorus Ensemble",
        "Line 6 DL4 Delay Modeler",
        "amplificador"
      ],
      techniques: [
        "intro con slide en cuerda alta (slide de vidrio)",
        "riff principal con fingerstyle y ataque suave",
        "solo con wah y delay"
      ],
      notes: "Tono crunch suave. El DS-2 se usa en modo I (overdrive) o apagado. MXR Micro Amp como boost.",
      nivelDistorsion: "crunch",
      esTocadoLimpio: false,
      researchedAt: new Date("2026-03-23T00:00:00.000Z")
    }
  },
  {
    musicBrainzId: "manual_otherside",
    title: "Otherside",
    artist: "Red Hot Chili Peppers",
    coverUrl: "https://cdn-images.dzcdn.net/images/cover/49b073f55550d41055e02c493f9a...",
    toneResearch: {
      equipment: [
        { nombre: "Boss CE-1 Chorus Ensemble", tipo: "chorus", posicion: "después de la guitarra" },
        { nombre: "Line 6 DL4 Delay Modeler", tipo: "delay", posicion: "antes del amplificador" }
      ],
      amplificador: {
        marca: "Marshall",
        modelo: "JCM 800 (2203)",
        configuracion: "clean, gain bajo, EQ: bass 5, mid 6, treble 6"
      },
      guitarra: {
        marca: "Fender",
        modelo: "Stratocaster 1962",
        pastillas: "single coil"
      },
      cadenaSenal: ["guitarra", "Boss CE-1 Chorus Ensemble", "Line 6 DL4 Delay Modeler", "amplificador"],
      techniques: [
        "riff principal con fingerstyle y palm mute",
        "uso de delay slap (approx 380ms, 2 repeticiones)",
        "chorus sutil para dar profundidad"
      ],
      notes: "Canción completamente limpia. Sin wah ni distorsión. Delay slap.",
      nivelDistorsion: "clean",
      esTocadoLimpio: true,
      researchedAt: new Date("2026-03-23T00:00:00.000Z")
    }
  },
  {
    musicBrainzId: "manual_californication",
    title: "Californication",
    artist: "Red Hot Chili Peppers",
    coverUrl: "https://cdn-images.dzcdn.net/images/cover/49b073f55550d41055e02c493f9a...",
    toneResearch: {
      equipment: [
        { nombre: "Boss CE-1 Chorus Ensemble", tipo: "chorus", posicion: "después de la guitarra" },
        { nombre: "Line 6 DL4 Delay Modeler", tipo: "delay", posicion: "antes del amplificador" }
      ],
      amplificador: {
        marca: "Marshall",
        modelo: "JCM 800 (2203)",
        configuracion: "clean, gain bajo, EQ: bass 5, mid 6, treble 6"
      },
      guitarra: {
        marca: "Fender",
        modelo: "Stratocaster 1962",
        pastillas: "single coil"
      },
      cadenaSenal: ["guitarra", "Boss CE-1 Chorus Ensemble", "Line 6 DL4 Delay Modeler", "amplificador"],
      techniques: [
        "arpegios con fingerpicking",
        "uso de chorus suave para dar textura",
        "delay slap (380ms) en el estribillo"
      ],
      notes: "Tono completamente limpio. Chorus con tasa baja y profundidad media.",
      nivelDistorsion: "clean",
      esTocadoLimpio: true,
      researchedAt: new Date("2026-03-23T00:00:00.000Z")
    }
  },
  {
    musicBrainzId: "manual_road_trippin",
    title: "Road Trippin'",
    artist: "Red Hot Chili Peppers",
    coverUrl: "https://cdn-images.dzcdn.net/images/cover/49b073f55550d41055e02c493f9a...",
    toneResearch: {
      equipment: [
        { nombre: "Ningún pedal", tipo: "clean", posicion: "no aplica" }
      ],
      amplificador: {
        marca: "Ninguno",
        modelo: "Grabación directa",
        configuracion: "Sin amplificador; grabación acústica directa"
      },
      guitarra: {
        marca: "Martin",
        modelo: "000-28EC (acústica)",
        pastillas: "acústica, sin pastillas eléctricas"
      },
      cadenaSenal: ["guitarra acústica", "microfono", "grabadora"],
      techniques: [
        "fingerpicking",
        "rasgueo suave con dedos",
        "uso de cejilla en el traste 2"
      ],
      notes: "Canción completamente acústica. Martin 000-28EC. Sin efectos.",
      nivelDistorsion: "clean",
      esTocadoLimpio: true,
      researchedAt: new Date("2026-03-23T00:00:00.000Z")
    }
  }
];

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

      const existingResearched = existing.toneResearch?.researchedAt;
      const newResearched = song.toneResearch?.researchedAt;
      if ((!existingResearched && newResearched) || (newResearched && existingResearched && newResearched > existingResearched)) {
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
