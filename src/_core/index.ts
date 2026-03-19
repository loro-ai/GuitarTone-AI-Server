import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { ENV } from "./env";
import superjson from "superjson";

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.set("trust proxy", 1);

  // 🔥 CORS MANUAL COMPLETO Y CORRECTO
  app.use((req, res, next) => {
    const origin = req.headers.origin;

    // ✅ permitir localhost y cualquier vercel.app
    if (
      origin &&
      (
        origin === "http://localhost:5173" ||
        origin.endsWith(".vercel.app")
      )
    ) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    }

    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET,POST,PUT,DELETE,OPTIONS"
    );

    // 🔥 CLAVE: headers dinámicos (fix para tRPC)
    const reqHeaders = req.headers["access-control-request-headers"];
    if (reqHeaders) {
      res.setHeader("Access-Control-Allow-Headers", reqHeaders);
    } else {
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization"
      );
    }

    // 🔥 responder preflight SIEMPRE
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }

    next();
  });

  // Body parsers
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Health check
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // OAuth
  registerOAuthRoutes(app);

  // tRPC
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
      transformer: superjson,
    })
  );

  server.listen(ENV.port, () => {
    console.log(`[Server] Running on port ${ENV.port}`);
    console.log(`[CORS] Fully working (Railway + Vercel + localhost)`);
  });
}

startServer().catch(console.error);
