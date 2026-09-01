import { createHash } from "node:crypto";
import { db } from "./db.js";
import { getRows, updateNotes, type HayatRow } from "./sheets.js";
import { resolveMajorSlug } from "./category-defs.js";
import { stripTagEmoji } from "./hayat-tags.js";

export type HayatSyncSummary = {
  processed: number;
  syntheticCreated: number;
  syntheticCreatedNoMatch: number;
  matchedToExisting: number;
  settlementsMatched: number;
  settlementsUnmatched: number;
  errors: { rowNumber: number; message: string }[];
};

const SYNCED_MARKER = "[ft-synced]";
const SELF_WRITE_PREFIX = "ft:"; // written by api/hayat/share.ts on its own appends

const AMOUNT_EPS = 0.01;

function isAlreadyProcessed(notes: string): boolean {
  return notes.includes(SYNCED_MARKER) || notes.trimStart().startsWith(SELF_WRITE_PREFIX);
}

function approxEquals(a: number, b: number, eps = AMOUNT_EPS): boolean {
  return Math.abs(a - b) < eps;
}

/** Deterministic synthetic plaid_transaction_id, stable across re-syncs of the same row. */
function syntheticTransactionId(row: HayatRow): string {
  const hash = createHash("sha256")
    .update(`${row.date}|${row.description}|${row.amount}|${row.paidBy}`)
    .digest("hex")
    .slice(0, 32);
  return `hayat:${hash}`;
}

async function markSynced(row: HayatRow): Promise<void> {
  const newNotes = row.notes ? `${row.notes} ${SYNCED_MARKER}` : SYNCED_MARKER;
  await updateNotes(row.rowNumber, newNotes);
}

/**
 * Creates a synthetic `source = 'hayat'` transaction for a shared-expense row
 * that has no corresponding real Plaid transaction (or one that couldn't be
 * matched). shared_amount is always Aybala's specific share — that's what
 * should count toward her spending totals, not the full bill amount.
 */
async function createSyntheticTransaction(row: HayatRow): Promise<void> {
  const categoryName = stripTagEmoji(row.tag);
  const categorySlug = resolveMajorSlug(categoryName);
  if (!categorySlug) {
    throw new Error(`Could not resolve category for tag "${row.tag}"`);
  }

  const plaidTransactionId = syntheticTransactionId(row);
  await db`
    insert into transactions (
      plaid_transaction_id, plaid_item_id, account_id, date, description,
      amount, tier, category_slug, is_shared, hayat_logged, source, shared_amount, raw
    )
    values (
      ${plaidTransactionId}, null, null, ${row.date}, ${row.description},
      ${row.amount}, 'purchase', ${categorySlug}, true, true, 'hayat', ${row.aylasShare},
      ${JSON.stringify(row)}
    )
    on conflict (plaid_transaction_id) do nothing
  `;
}

/** Bucket 1, Paid By Aybala: try to match an existing real transaction for the full amount. */
async function matchExpenseTransaction(row: HayatRow): Promise<string | null> {
  const [match] = await db<{ id: string }>`
    select id from transactions
    where source = 'plaid'
      and hayat_logged = false
      and abs(amount - ${row.amount}) < ${AMOUNT_EPS}
      and date between ${row.date}::date - interval '3 days' and ${row.date}::date + interval '3 days'
    order by abs(date - ${row.date}::date)
    limit 1
  `;
  return match?.id ?? null;
}

/** Bucket 2: try to match an existing real transaction that looks like the settlement transfer. */
async function matchSettlementTransaction(row: HayatRow, direction: "in" | "out"): Promise<string | null> {
  const lo = row.amount - AMOUNT_EPS;
  const hi = row.amount + AMOUNT_EPS;
  const rows =
    direction === "in"
      ? await db<{ id: string }>`
          select id from transactions
          where source = 'plaid'
            and hayat_logged = false
            and amount < 0
            and abs(amount) between ${lo} and ${hi}
            and date between ${row.date}::date - interval '3 days' and ${row.date}::date + interval '3 days'
          order by abs(date - ${row.date}::date)
          limit 1
        `
      : await db<{ id: string }>`
          select id from transactions
          where source = 'plaid'
            and hayat_logged = false
            and amount > 0
            and abs(amount) between ${lo} and ${hi}
            and date between ${row.date}::date - interval '3 days' and ${row.date}::date + interval '3 days'
          order by abs(date - ${row.date}::date)
          limit 1
        `;
  return rows[0]?.id ?? null;
}

function isTransfer(row: HayatRow): "toAybala" | "toErdem" | null {
  if (
    row.paidBy === "Erdem" &&
    approxEquals(row.aylasShare, row.amount) &&
    approxEquals(row.erdemsShare, 0)
  ) {
    return "toAybala";
  }
  if (
    row.paidBy === "Aybala" &&
    approxEquals(row.erdemsShare, row.amount) &&
    approxEquals(row.aylasShare, 0)
  ) {
    return "toErdem";
  }
  return null;
}

/**
 * Reads every row of the Hayat sheet, classifies each unprocessed row into
 * one of the two buckets described in the integration design, applies the DB
 * writes for it, and marks it `[ft-synced]` in the sheet so future runs skip
 * it. Backs both the daily cron sync and the manual one-time backfill.
 */
export async function syncHayat(): Promise<HayatSyncSummary> {
  const summary: HayatSyncSummary = {
    processed: 0,
    syntheticCreated: 0,
    syntheticCreatedNoMatch: 0,
    matchedToExisting: 0,
    settlementsMatched: 0,
    settlementsUnmatched: 0,
    errors: [],
  };

  const rows = await getRows();

  for (const row of rows) {
    if (isAlreadyProcessed(row.notes)) continue;
    if (!row.date || !row.description) continue; // blank trailing row

    try {
      const transfer = isTransfer(row);

      if (transfer) {
        const matchId = await matchSettlementTransaction(row, transfer === "toAybala" ? "in" : "out");
        if (matchId) {
          await db`
            update transactions set hayat_logged = true, tier = 'income', updated_at = now()
            where id = ${matchId}
          `;
          summary.settlementsMatched++;
          await markSynced(row);
        } else {
          summary.settlementsUnmatched++;
          // Leave unmarked — needs to stay visible for re-checking next sync.
        }
      } else {
        // Bucket 1: genuine shared expense.
        if (row.paidBy === "Erdem") {
          await createSyntheticTransaction(row);
          summary.syntheticCreated++;
          await markSynced(row);
        } else {
          const matchId = await matchExpenseTransaction(row);
          if (matchId) {
            await db`
              update transactions
              set is_shared = true, shared_amount = ${row.aylasShare}, hayat_logged = true, updated_at = now()
              where id = ${matchId}
            `;
            summary.matchedToExisting++;
            await markSynced(row);
          } else {
            await createSyntheticTransaction(row);
            summary.syntheticCreated++;
            summary.syntheticCreatedNoMatch++;
            await markSynced(row);
          }
        }
      }

      summary.processed++;
    } catch (err) {
      summary.errors.push({
        rowNumber: row.rowNumber,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return summary;
}
