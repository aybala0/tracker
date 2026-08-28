import type { VercelRequest, VercelResponse } from "@vercel/node";
import { hasValidSession } from "../../lib/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const authenticated = await hasValidSession(req);
  if (!authenticated) return res.status(401).json({ error: "Not authenticated." });
  return res.status(200).json({ ok: true });
}
