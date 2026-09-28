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
    // Applied only after every page is in, so a pending transaction's posted
    // replacement has always been seen before the pending row is dropped.
    const removedIds: string[] = [];

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

        // When a pending transaction posts, Plaid removes the pending id and
        // adds the posted one under a new id, linked by pending_transaction_id.
        // Move the existing row onto the posted id instead of inserting a
        // fresh one: it keeps its labels, and its row id — which the Hayat
        // sheet's `ft:{id}` note points at — so it doesn't reappear in the
        // inbox to be labelled (and shared to the sheet) a second time. A
        // description the user already edited while labelling is kept.
        if (t.pending_transaction_id) {
          const moved = await db`
            update transactions
            set plaid_transaction_id = ${t.transaction_id}, date = ${t.date}, amount = ${t.amount},
                description = case when tier is null then ${description} else description end,
                raw = ${JSON.stringify(t)}, updated_at = now()
            where plaid_transaction_id = ${t.pending_transaction_id}
              and not exists (select 1 from transactions where plaid_transaction_id = ${t.transaction_id})
            returning id
          `;
          if (moved.length > 0) continue;
        }

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
        if (r.transaction_id) removedIds.push(r.transaction_id);
      }

      cursor = data.next_cursor;
      hasMore = data.has_more;
    }

    for (const id of removedIds) {
      await removeTransaction(id);
      removed++;
    }

    // Balances only ever got written once, at initial link (api/plaid/
    // [action].ts's exchange()) — nothing refreshed them again after that,
    // so net worth silently drifted from reality as cards got paid down or
    // charged up. Refresh every account on this item on every sync.
    const accountsResp = await plaidClient.accountsGet({ access_token: item.access_token });
    for (const a of accountsResp.data.accounts) {
      await db`
        update accounts
        set current_balance = ${a.balances.current ?? null},
            available_balance = ${a.balances.available ?? null},
            updated_at = now()
        where plaid_account_id = ${a.account_id}
      `;
    }

    await db`update plaid_items set cursor = ${cursor}, last_synced_at = now() where id = ${item.id}`;
  }

  // Re-scan (not just this batch) since a card payment's two sides can land
  // in different sync runs — one account's data may arrive a day after the
  // other's.
  await matchCardPaymentTransfers();

  return { added, modified, removed };
}

/**
 * Handles a transaction Plaid reports as removed. Usually that's a pending
 * transaction that has posted — and when Plaid linked the two, the posted
 * version already took over the row above, so there's nothing left to do.
 *
 * Some banks don't send that link. For an already-labelled pending row, look
 * for its unlinked posted version instead: an unlabelled, posted transaction
 * on the same account for the same amount, dated up to 10 days later. If one
 * is found, the labelled row takes over its Plaid data and the unlabelled
 * copy is dropped, in one statement. Otherwise (e.g. a cancelled hold) the
 * row is deleted as before.
 */
async function removeTransaction(plaidTransactionId: string): Promise<void> {
  const [row] = await db<{ id: string; description: string; amount: string; date: string; tier: string | null; hayat_logged: boolean }>`
    select id, description, amount, to_char(date, 'YYYY-MM-DD') as date, tier, hayat_logged
    from transactions
    where plaid_transaction_id = ${plaidTransactionId}
  `;
  if (!row) return;

  if (row.tier !== null) {
    const [taken] = await db<{ id: string }>`
      with posted as (
        delete from transactions
        where id = (
          select p.id from transactions p, transactions o
          where o.id = ${row.id}
            and p.id <> o.id
            and p.account_id = o.account_id
            and p.amount = o.amount
            and p.date between o.date and o.date + 10
            and p.tier is null
            and coalesce(p.raw->>'pending', 'false') = 'false'
            and p.raw->>'pending_transaction_id' is null
          order by p.date asc
          limit 1
        )
        returning plaid_transaction_id, date, raw
      )
      update transactions t
      set plaid_transaction_id = posted.plaid_transaction_id, date = posted.date, raw = posted.raw, updated_at = now()
      from posted
      where t.id = ${row.id}
      returning t.id
    `;
    if (taken) return;

    // Labelled but nothing posted to replace it. If it was shared, its row
    // on the Hayat sheet is now orphaned and needs removing by hand.
    console.warn(
      `plaid-sync: deleting labelled transaction with no posted replacement: ${row.date} ${row.description} ${row.amount}` +
        (row.hayat_logged ? ` — it's on the Hayat sheet as ft:${row.id}` : "")
    );
  }

  await db`delete from transactions where id = ${row.id}`;
}
