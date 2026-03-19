import { COOKIE_NAME, ONE_YEAR_MS } from "../shared/const";
import { parse as parseCookieHeader } from "cookie";
import { randomBytes, pbkdf2Sync } from "crypto";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";

import * as db from "../db";
import { ENV } from "./env";
import { ForbiddenError } from "../shared/errors";

// ─── Utilidades de contraseña ─────────────────────────────────────────────────

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const verify = pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return verify === hash;
}

// ─── JWT de sesión ────────────────────────────────────────────────────────────

export type SessionPayload = {
  openId: string;
  name: string;
};

function getSessionSecret() {
  return new TextEncoder().encode(ENV.cookieSecret);
}

export async function createSessionToken(
  openId: string,
  name: string
): Promise<string> {
  const expirationSeconds = Math.floor((Date.now() + ONE_YEAR_MS) / 1000);
  return new SignJWT({ openId, name })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(expirationSeconds)
    .sign(getSessionSecret());
}

export async function verifySession(
  cookieValue: string | undefined | null
): Promise<SessionPayload | null> {
  if (!cookieValue) return null;
  try {
    const { payload } = await jwtVerify(cookieValue, getSessionSecret(), {
      algorithms: ["HS256"],
    });
    const { openId, name } = payload as Record<string, unknown>;
    if (typeof openId !== "string" || !openId) return null;
    return { openId, name: typeof name === "string" ? name : "" };
  } catch {
    return null;
  }
}

// ─── Autenticación de request ─────────────────────────────────────────────────

export async function authenticateRequest(req: Request) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) throw ForbiddenError("No session cookie");

  const cookies = new Map(Object.entries(parseCookieHeader(cookieHeader)));
  const sessionCookie = cookies.get(COOKIE_NAME);
  const session = await verifySession(sessionCookie);

  if (!session) throw ForbiddenError("Invalid session");

  const user = await db.getUserByOpenId(session.openId);
  if (!user) throw ForbiddenError("User not found");

  return user;
}
