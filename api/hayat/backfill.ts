import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAuth } from "../../lib/auth.js";
import { syncHayat } from "../../lib/hayat-sync.js";

/**
 * Manual, user-triggered one-time historical import of the Hayat sheet. Runs
 * the exact same logic as the daily cron job (lib/hayat-sync.ts) — this
 * route just lets the user kick it off on demand and see the full summary.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!(await requireAuth(req, res))) return;

  try {
    const summary = await syncHayat();
    return res.status(200).json(summary);
  } catch (err) {
    console.error("hayat backfill error:", err);
    return res.status(500).json({ error: "Failed to backfill from Hayat." });
  }
}
