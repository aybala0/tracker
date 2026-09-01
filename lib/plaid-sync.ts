import { plaidClient } from "./plaid.js";
import { db } from "./db.js";
import { matchRegexRule, findPriorCategorization } from "./categorize.js";

export type PlaidSyncSummary = {
  added: number;
  modified: number;
  removed: number;
};

/**
 * Pulls every plaid_items' /transactions/sync delta and upserts into
 * `transactions`. Shared by the user-facing POST /api/plaid/sync route and
 * the daily cron job so both run the exact same logic.
 */
export async function syncAllPlaidItems(): Promise<PlaidSyncSummary> {
  const items = await db<{ id: string; access_token: string; cursor: string | null }>`
    select id, access_token, cursor from plaid_items
  `;

  let added = 0;
  let modified = 0;
  let removed = 0;

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

        const description = t.name ?? t.merchant_name ?? "";
        const match = await matchRegexRule(description);
        // If this exact description has been categorized before, apply the
        // same labeling now — the transaction skips the inbox entirely.
        // Only affects a fresh insert (see the `on conflict` below): an
        // already-existing transaction never gets its category clobbered
        // by a later sync.
        const prior = await findPriorCategorization(description);

        await db`
          insert into transactions (
            plaid_transaction_id, plaid_item_id, account_id, date, description,
            amount, matched_rule_id, raw, tier, category_slug, subcategory_id
          )
          values (
            ${t.transaction_id}, ${item.id}, ${account.id}, ${t.date}, ${description},
            ${t.amount}, ${match?.ruleId ?? null}, ${JSON.stringify(t)},
            ${prior?.tier ?? null}, ${prior?.categorySlug ?? null}, ${prior?.subcategoryId ?? null}
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

    await db`update plaid_items set cursor = ${cursor}, last_synced_at = now() where id = ${item.id}`;
  }

  return { added, modified, removed };
}
