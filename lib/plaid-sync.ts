import { plaidClient } from "./plaid.js";
import { db } from "./db.js";
import { matchRegexRule, matchCardPaymentTransfers } from "./categorize.js";

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
        // Regex rules (including ones the user opted to create from the
        // inbox's "repeats? make it a rule" madlib — see createContainsRule)
        // only ever carry a suggested category/tier; they never auto-apply
        // it. Every new transaction lands in the inbox uncategorized, with
        // a suggestion to confirm or edit if a rule matched.
        const match = await matchRegexRule(description);

        await db`
          insert into transactions (
            plaid_transaction_id, plaid_item_id, account_id, date, description,
            amount, matched_rule_id, raw
          )
          values (
            ${t.transaction_id}, ${item.id}, ${account.id}, ${t.date}, ${description},
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

    await db`update plaid_items set cursor = ${cursor}, last_synced_at = now() where id = ${item.id}`;
  }

  // Re-scan (not just this batch) since a card payment's two sides can land
  // in different sync runs — one account's data may arrive a day after the
  // other's.
  await matchCardPaymentTransfers();

  return { added, modified, removed };
}
