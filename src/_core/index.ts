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
      origin: function (origin, callback) {
        const permitidos = [
          "http://localhost:5173",
          "http://localhost:3000",
          "http://localhost",
        ];
        if (
          !origin ||
          origin.includes("vercel.app") ||
          origin.includes("railway.app") ||
          permitidos.includes(origin)
        ) {
          callback(null, true);
        } else {
          callback(new Error("Not allowed by CORS"));
        }
      },
      credentials: true,
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
