import type { VercelRequest, VercelResponse } from "@vercel/node";
import { plaidClient } from "../../lib/plaid.js";
import { db } from "../../lib/db.js";
import { matchRegexRule } from "../../lib/categorize.js";
import { requireAuth } from "../../lib/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!(await requireAuth(req, res))) return;

  const items = await db<{ id: string; access_token: string; cursor: string | null }>`
    select id, access_token, cursor from plaid_items
  `;

  let added = 0;
  let modified = 0;
  let removed = 0;

  try {
    for (const item of items) {
      let cursor = item.cursor ?? undefined;
      let hasMore = true;

      while (hasMore) {
        const resp = await plaidClient.transactionsSync({
          access_token: item.access_token,
          cursor,
        });
        const data = resp.data;

        for (const t of [...data.added, ...data.modified]) {
          const [account] = await db<{ id: string }>`
            select id from accounts where plaid_account_id = ${t.account_id}
          `;
          if (!account) continue; // account not yet synced via exchange — skip until it is

          const match = await matchRegexRule(t.name ?? t.merchant_name ?? "");

          await db`
            insert into transactions (
              plaid_transaction_id, plaid_item_id, account_id, date, description,
              amount, matched_rule_id, raw
            )
            values (
              ${t.transaction_id}, ${item.id}, ${account.id}, ${t.date}, ${t.name ?? ""},
              ${t.amount}, ${match?.ruleId ?? null}, ${JSON.stringify(t)}
            )
            on conflict (plaid_transaction_id) do update set
              amount = excluded.amount,
              description = excluded.description,
              raw = excluded.raw,
              updated_at = now()
          `;
        }
        added += data.added.length;
        modified += data.modified.length;

        for (const r of data.removed) {
          if (!r.transaction_id) continue;
          await db`delete from transactions where plaid_transaction_id = ${r.transaction_id}`;
          removed++;
        }

        cursor = data.next_cursor;
        hasMore = data.has_more;
      }

      await db`update plaid_items set cursor = ${cursor} where id = ${item.id}`;
    }

    return res.status(200).json({ added, modified, removed });
  } catch (err) {
    console.error("transactionsSync error:", err);
    return res.status(500).json({ error: "Failed to sync transactions." });
  }
}
