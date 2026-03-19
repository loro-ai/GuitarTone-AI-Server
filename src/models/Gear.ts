import mongoose from "mongoose";

/** Un efecto/tipo disponible dentro de un módulo */
export interface ModuleEffect {
  tipo: string;           // "Compressor", "Limiter", "Auto Wah", "TUBE PRE", etc.
  parametros: Array<{
    nombre: string;       // "valor", "GAIN", "MIX", "Prm1", "Prm2", "sensibilidad"
    rango: string;        // "C1-C9", "0-100", "L1-L9", "A1-A9"
    descripcion?: string;
  }>;
}

/** Un módulo del multi-efectos (COMP, EFX, DRIVE, EQ, ZNR, MOD_DELAY, REVERB_DELAY) */
export interface GearModule {
  nombre: string;         // "COMP", "EFX", "DRIVE", "EQ", "ZNR", "MOD_DELAY", "REVERB_DELAY"
  label: string;          // "Compressor/Limiter", "Effects", "Drive/Distortion", etc.
  puedeApagarse: boolean; // si el módulo tiene estado ON/OFF
  efectos: ModuleEffect[];
}

export interface IGear {
  _id?: string;
  userId: string;
  name: string;
  type: "pedalera" | "amplificador" | "guitarra" | "procesador" | "otro";
  brand?: string;
  model?: string;
  specs?: Record<string, unknown>;
  manualData?: {
    description: string;
    esMultiEfectos: boolean;
    /** Módulos del multi-efectos (solo para pedaleras/procesadores) */
    modules?: GearModule[];
    /** Parámetros planos (para amplificadores y pedales individuales) */
    parameters: Array<{
      name: string;
      range: string;
      defaultValue?: string;
      description: string;
    }>;
    /**
     * Learnings críticos del equipo — reglas derivadas del manual y experiencia real.
     * Ej: "ZNR debe estar OFF cuando DRIVE está alto — corta las notas en solos"
     * Ej: "MIX del módulo DRIVE va de 0-100, no de 0-10 como dice el manual"
     */
    learnings?: string[];
    imageUrl?: string;
    presetSlots?: number;
    notes: string;
    researchedAt: Date;
  };
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const gearSchema = new mongoose.Schema<IGear>(
  {
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    type: {
      type: String,
      enum: ["pedalera", "amplificador", "guitarra", "procesador", "otro"],
      required: true,
    },
    brand: { type: String },
    model: { type: String },
    specs: { type: mongoose.Schema.Types.Mixed },
    manualData: { type: mongoose.Schema.Types.Mixed },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Gear = mongoose.model<IGear>("Gear", gearSchema);
