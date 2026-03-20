import { Request, Response, NextFunction } from "express";

export function corsMiddleware(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin as string | undefined;

  if (
    !origin ||
    origin.includes("localhost:5173") ||
    origin.endsWith(".vercel.app") ||
    origin.startsWith("capacitor://")
  ) {
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
  }

  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,DELETE,OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
}
