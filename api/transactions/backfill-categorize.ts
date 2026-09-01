import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../../lib/db.js";
import { requireAuth } from "../../lib/auth.js";
import { findPriorCategorization, matchCardPaymentTransfers } from "../../lib/categorize.js";

/**
 * One-time manual catch-up for inbox auto-categorization: applies
 * `findPriorCategorization` and `matchCardPaymentTransfers` to transactions
 * already sitting uncategorized (the ingest-time hooks in lib/plaid-sync.ts
 * only cover new inserts/syncs going forward). Not part of the daily cron —
 * deliberately a manual trigger, like /api/hayat/backfill, so results can be
 * reviewed rather than silently mass-applied.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!(await requireAuth(req, res))) return;

  try {
    const rows = await db<{ id: string; description: string }>`
      select id, description from transactions where tier is null order by date asc
    `;

    let matched = 0;
    for (const row of rows) {
      const prior = await findPriorCategorization(row.description);
      if (!prior) continue;
      await db`
        update transactions
        set tier = ${prior.tier}, category_slug = ${prior.categorySlug}, subcategory_id = ${prior.subcategoryId}, updated_at = now()
        where id = ${row.id}
      `;
      matched++;
    }

    const { matched: transfersMatched } = await matchCardPaymentTransfers();

    return res.status(200).json({ checked: rows.length, matched, transfersMatched });
  } catch (err) {
    console.error("backfill-categorize error:", err);
    return res.status(500).json({ error: "Failed to backfill categorization." });
  }
}
