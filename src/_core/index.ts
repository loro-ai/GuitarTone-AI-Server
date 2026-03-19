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

  // CORS — permite requests desde el frontend en Vercel
  app.use(
    cors({
      origin: ENV.isProduction
        ? [ENV.frontendUrl]
        : ["http://localhost:5173", "http://localhost:3000", ENV.frontendUrl],
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  );

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Health check para Railway
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // OAuth callback
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
    console.log(`[CORS] Allowing origin: ${ENV.frontendUrl}`);
  });
}

startServer().catch(console.error);
