import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { ENV } from "./env";

async function startServer() {
  const app = express();
  const server = createServer(app);

  // 🔧 IMPORTANTE para Railway / proxies
  app.set("trust proxy", 1);

  // ✅ CORS SIMPLE Y ESTABLE (SIN FUNCIONES DINÁMICAS)
  const allowedOrigins = [
    "http://localhost:5173",
    "https://guitar-tone-ai.vercel.app",
  ];

  app.use(
    cors({
      origin: allowedOrigins,
      credentials: true,
    })
  );

  // 🔥 PREVENTIVO: manejar preflight correctamente
  app.options(
    "*",
    cors({
      origin: allowedOrigins,
      credentials: true,
    })
  );

  // Body parsers
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Health check
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // OAuth routes
  registerOAuthRoutes(app);

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  server.listen(ENV.port, () => {
    console.log(`[Server] Running on port ${ENV.port}`);
    console.log(`[CORS] Allowed origins:`, allowedOrigins);
  });
}

startServer().catch(console.error);
