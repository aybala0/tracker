import type { VercelRequest, VercelResponse } from "@vercel/node";
import { syncAllPlaidItems } from "../../lib/plaid-sync.js";
import { syncHayat } from "../../lib/hayat-sync.js";

/**
 * Daily scheduled job (see vercel.json crons). Auth here is deliberately
 * NOT requireAuth — a cron invocation has no browser session. Vercel sends
 * `Authorization: Bearer $CRON_SECRET` automatically for cron-triggered
 * calls when CRON_SECRET is set in the project's env vars.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (req.headers.authorization !== expected) {
    return res.status(401).json({ error: "Not authenticated." });
  }

  try {
    const plaid = await syncAllPlaidItems();
    const hayat = await syncHayat();
    return res.status(200).json({ plaid, hayat });
  } catch (err) {
    console.error("cron sync error:", err);
    return res.status(500).json({ error: "Cron sync failed." });
  }
}
