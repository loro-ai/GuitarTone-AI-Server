import { COOKIE_NAME, ONE_YEAR_MS } from "../shared/const";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";

import * as db from "../db";
import { ENV } from "./env";
import { ForbiddenError } from "../shared/errors";

// ─── Utilidades de contraseña ─────────────────────────────────────────────────

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 12);
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
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
