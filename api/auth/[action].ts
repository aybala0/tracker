import type { VercelRequest, VercelResponse } from "@vercel/node";
import { safeEqual, setSessionCookie, clearSessionCookie, hasValidSession } from "../../lib/auth.js";

// Consolidated (login/logout/me) into one dynamic route to stay under
// Vercel Hobby's 12-Serverless-Function cap. URLs are unchanged.

async function login(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const expected = process.env.APP_PASSWORD;
  if (!expected) {
    return res.status(500).json({ error: "Server misconfigured: APP_PASSWORD not set." });
  }

  const { password } = req.body as { password?: string };
  if (!password || !safeEqual(password, expected)) {
    return res.status(401).json({ error: "Incorrect password." });
  }

  await setSessionCookie(res);
  return res.status(200).json({ ok: true });
}

async function logout(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  clearSessionCookie(res);
  return res.status(200).json({ ok: true });
}

async function me(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const authenticated = await hasValidSession(req);
  if (!authenticated) return res.status(401).json({ error: "Not authenticated." });
  return res.status(200).json({ ok: true });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { action } = req.query as { action?: string };
  switch (action) {
    case "login":
      return login(req, res);
    case "logout":
      return logout(req, res);
    case "me":
      return me(req, res);
    default:
      return res.status(404).json({ error: "Unknown auth action." });
  }
}
