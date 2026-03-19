import mongoose from "mongoose";

let isConnected = false;

export async function connectDB(): Promise<void> {
  if (isConnected) return;

  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    console.warn("[MongoDB] MONGODB_URI no configurado. Modos de desarrollo sin DB activos.");
    return;
  }

  try {
    await mongoose.connect(mongoUri);
    isConnected = true;
    console.log("[MongoDB] Conectado exitosamente");
  } catch (error) {
    console.error("[MongoDB] Error de conexión:", error);
    throw error;
  }
}

export async function disconnectDB(): Promise<void> {
  if (!isConnected) return;

  try {
    await mongoose.disconnect();
    isConnected = false;
    console.log("[MongoDB] Desconectado");
  } catch (error) {
    console.error("[MongoDB] Error al desconectar:", error);
    throw error;
  }
}

export function isDBConnected(): boolean {
  return isConnected;
}
