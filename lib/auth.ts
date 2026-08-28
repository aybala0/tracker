import { SignJWT, jwtVerify } from "jose";
import { timingSafeEqual } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const COOKIE_NAME = "ft_session";
const MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return new TextEncoder().encode(secret);
}

/** Constant-time string compare — avoids leaking the password via response timing. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

async function signToken(): Promise<string> {
  return new SignJWT({ sub: "owner" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(getSecret());
}

function parseCookie(cookieHeader: string, name: string): string | null {
  for (const part of cookieHeader.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k.trim() === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export async function hasValidSession(req: VercelRequest): Promise<boolean> {
  const cookieHeader = req.headers.cookie ?? "";
  const token = parseCookie(cookieHeader, COOKIE_NAME);
  if (!token) return false;
  try {
    await jwtVerify(token, getSecret());
    return true;
  } catch {
    return false;
  }
}

/**
 * Guard for API routes: responds 401 and returns false if there's no valid
 * session cookie. Call as the first line of every route that touches Plaid,
 * the database, or Hayat — usage: `if (!(await requireAuth(req, res))) return;`
 */
export async function requireAuth(req: VercelRequest, res: VercelResponse): Promise<boolean> {
  if (await hasValidSession(req)) return true;
  res.status(401).json({ error: "Not authenticated." });
  return false;
}

export async function setSessionCookie(res: VercelResponse): Promise<void> {
  const token = await signToken();
  const isProd = process.env.NODE_ENV === "production";
  const secure = isProd ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax${secure}`
  );
}

export function clearSessionCookie(res: VercelResponse): void {
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`);
}
