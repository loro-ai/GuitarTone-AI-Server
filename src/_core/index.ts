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

  // 🔧 IMPORTANTE para proxies (Railway, etc.)
  app.set("trust proxy", 1);

  // ✅ Configuración CORS robusta
  const corsOptions: cors.CorsOptions = {
    origin: (origin, callback) => {
      const permitidos = [
        "http://localhost:5173",
        "https://localhost",
        "capacitor://localhost",
        "http://localhost",
      ];

      if (
        !origin || // permite Postman, curl, etc.
        permitidos.includes(origin) ||
        origin.endsWith(".vercel.app") // soporta todos los deploy previews
      ) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  };

  app.use(cors(corsOptions));

  // 🔥 CLAVE: manejar preflight correctamente
  app.options("*", cors(corsOptions));

  // Body parsers
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Health check para Railway
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
    console.log(`[CORS] Ready for Vercel, Capacitor y localhost`);
  });
}

startServer().catch(console.error);
