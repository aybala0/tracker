import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../../lib/db.js";
import { requireAuth } from "../../lib/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!(await requireAuth(req, res))) return;

  try {
    const [row] = await db<{ id: string }>`select id from accounts limit 1`;
    const [syncRow] = await db<{ last_synced_at: string | null }>`
      select max(last_synced_at) as last_synced_at from plaid_items
    `;
    return res.status(200).json({ linked: !!row, lastSyncedAt: syncRow?.last_synced_at ?? null });
  } catch (err) {
    console.error("accounts status error:", err);
    return res.status(500).json({ error: "Failed to fetch account status." });
  }
}
