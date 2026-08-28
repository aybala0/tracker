import type { VercelRequest, VercelResponse } from "@vercel/node";
import { safeEqual, setSessionCookie } from "../../lib/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

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
