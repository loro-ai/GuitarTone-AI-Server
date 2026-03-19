import mongoose from "mongoose";

export interface ISong {
  _id?: string;
  musicBrainzId: string;
  title: string;
  artist: string;
  releaseDate?: string;
  coverUrl?: string;
  toneResearch?: {
    equipment: Array<{ nombre: string; tipo: string; posicion?: string }>;
    amplificador?: { marca?: string; modelo?: string; configuracion?: string };
    guitarra?: { marca?: string; modelo?: string; pastillas?: string };
    cadenaSenal?: string[];
    techniques: string[];
    notes: string;
    nivelDistorsion?: string;
    esTocadoLimpio?: boolean;
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
  },
  { timestamps: true }
);

export const Song = mongoose.model<ISong>("Song", songSchema);
