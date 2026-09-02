import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../../lib/db.js";
import { requireAuth } from "../../lib/auth.js";
import { matchRegexRule, matchCardPaymentTransfers } from "../../lib/categorize.js";

/**
 * One-time manual catch-up for inbox auto-categorization: applies
 * `matchRegexRule` and `matchCardPaymentTransfers` to transactions already
 * sitting uncategorized (the ingest-time hooks in lib/plaid-sync.ts only
 * cover new inserts/syncs going forward). Not part of the daily cron —
 * deliberately a manual trigger, like /api/hayat/backfill. Only ever flags a
 * suggested category via matched_rule_id, never applies tier/category
 * directly — results land in the inbox's "already matched" review section
 * to be confirmed or edited, same as any other rule match.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!(await requireAuth(req, res))) return;

  try {
    const rows = await db<{ id: string; description: string }>`
      select id, description from transactions where tier is null and matched_rule_id is null order by date asc
    `;

    let matched = 0;
    for (const row of rows) {
      const rule = await matchRegexRule(row.description);
      if (!rule) continue;
      await db`
        update transactions set matched_rule_id = ${rule.ruleId}, updated_at = now() where id = ${row.id}
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
