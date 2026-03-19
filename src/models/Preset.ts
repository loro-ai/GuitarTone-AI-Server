import mongoose from "mongoose";

/** Configuración de un equipo específico dentro de un preset */
export interface GearConfig {
  gearId: string;
  gearNombre: string;
  gearTipo: string;
  /**
   * Parámetros con valores exactos.
   * Para multi-efectos, cada entrada es un módulo:
   *   "COMP": { "estado": "ON", "tipo": "Compressor", "valor": "C3" }
   *   "DRIVE": { "estado": "OFF" }
   *   "EQ": { "LO": 10, "MID": 12, "HI": 14 }
   * Para amplificadores y pedales simples, son valores planos:
   *   "Gain": 5, "Treble": 6
   */
  parametros: Record<string, unknown>;
}

export interface PresetConfig {
  nombre: string;
  momento_cancion: string;
  descripcion: string;
  /** Configuración individual por cada equipo del usuario */
  configuracion: GearConfig[];
  nota_tecnica?: string;
  consejos?: string[];
}

export interface IPreset {
  _id?: string;
  userId: string;
  songId: string;
  songTitle?: string;
  songArtist?: string;
  gearIds: string[];
  /** Configuración fija de amplificadores/guitarras (no varía por sección) */
  configuracion_base?: GearConfig[];
  presetsData: PresetConfig[];
  advertencia?: string;
  isFavorite: boolean;
  rating?: number;
  userNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const presetSchema = new mongoose.Schema<IPreset>(
  {
    userId: { type: String, required: true, index: true },
    songId: { type: String, required: true },
    songTitle: { type: String },
    songArtist: { type: String },
    gearIds: [String],
    configuracion_base: { type: mongoose.Schema.Types.Mixed },
    presetsData: [
      {
        nombre: String,
        momento_cancion: String,
        descripcion: String,
        configuracion: { type: mongoose.Schema.Types.Mixed },
        nota_tecnica: String,
        consejos: [String],
      },
    ],
    advertencia: { type: String },
    isFavorite: { type: Boolean, default: false },
    rating: { type: Number, min: 1, max: 5 },
    userNotes: { type: String },
  },
  { timestamps: true }
);

export const Preset = mongoose.model<IPreset>("Preset", presetSchema);
