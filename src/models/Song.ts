import mongoose from "mongoose";

// ─── Nuevos tipos para toneResearch v2 ──────────────────────────────────────

export interface IAmpReference {
  marca: string;
  modelo: string;
  caracter: "bright" | "dark" | "neutral";
  gainBase: number;
  eqBase: {
    bass: number;
    mid: number;
    treble: number;
  };
  notes: string;
}

export interface ISongStructureSection {
  section: "intro" | "verso" | "coro" | "pre-coro" | "solo" | "bridge" | "outro" | "riff" | "breakdown";
  intensity: number; // 1–10
  texture: "clean" | "crunch" | "heavy";
  keyEffects: string[];
  eqAdjust?: {
    bass: number;
    mid: number;
    treble: number;
  };
  gainDelta?: number; // ±offset sobre gainBase del amp
  technique?: string;
}

export interface IBaseTone {
  nivelDistorsion: string;
  esTocadoLimpio: boolean;
}

// ─── ISong interface ────────────────────────────────────────────────────────

export interface ISong {
  _id?: string;
  musicBrainzId: string;
  title: string;
  artist: string;
  releaseDate?: string;
  coverUrl?: string;
  toneResearch?: {
    // ── Nuevos campos v2 ──
    ampReference?: IAmpReference;
    songStructure?: ISongStructureSection[];
    baseTone?: IBaseTone;

    // ── Campos legacy (mantener retrocompatibilidad) ──
    equipment: Array<{ nombre: string; tipo: string; posicion?: string }>;
    amplificador?: { marca?: string; modelo?: string; configuracion?: string };
    guitarra?: { marca?: string; modelo?: string; pastillas?: string };
    cadenaSenal?: string[];
    techniques: string[];
    notes: string;
    nivelDistorsion?: string;
    esTocadoLimpio?: boolean;
    descripcion_tono?: string;
    tecnica?: string;
    estructura?: Array<{
      seccion: string;
      dinamica?: string;
      nivel_distorsion?: string;
      efectos_clave?: string[];
      tecnica?: string;
    }>;
    researchedAt: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const songSchema = new mongoose.Schema<ISong>(
  {
    musicBrainzId: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    artist: { type: String, required: true },
    releaseDate: { type: String },
    coverUrl: { type: String },
    toneResearch: {
      // ── v2 ──
      ampReference: {
        marca: String,
        modelo: String,
        caracter: String,
        gainBase: Number,
        eqBase: {
          bass: Number,
          mid: Number,
          treble: Number,
        },
        notes: String,
      },
      songStructure: [
        {
          section: String,
          intensity: Number,
          texture: String,
          keyEffects: [String],
          eqAdjust: {
            bass: Number,
            mid: Number,
            treble: Number,
          },
          gainDelta: Number,
          technique: String,
        },
      ],
      baseTone: {
        nivelDistorsion: String,
        esTocadoLimpio: Boolean,
      },

      // ── legacy ──
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
      descripcion_tono: String,
      tecnica: String,
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
  },
  { timestamps: true }
);

export const Song = mongoose.model<ISong>("Song", songSchema);
