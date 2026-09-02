import { db } from "./db.js";

export type AmazonOrderItem = {
  name: string;
  price: number;
  quantity: number;
};

export type NewAmazonOrder = {
  orderId: string;
  orderDate: string;
  items: AmazonOrderItem[];
  grandTotal: number | null;
};

/** Upserts imported orders. Amazon order contents don't change once placed, but
 * re-importing the same order (e.g. a re-run after a partial failure) should
 * just overwrite rather than error or duplicate. */
export async function importOrders(orders: NewAmazonOrder[]): Promise<number> {
  let imported = 0;
  for (const order of orders) {
    await db`
      insert into amazon_orders (order_id, order_date, items, grand_total)
      values (${order.orderId}, ${order.orderDate}, ${JSON.stringify(order.items)}, ${order.grandTotal})
      on conflict (order_id) do update
      set order_date = excluded.order_date, items = excluded.items, grand_total = excluded.grand_total
    `;
    imported++;
  }
  return imported;
}

function itemsSum(items: AmazonOrderItem[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

/** A charge posts within this many days of the order date — Amazon usually
 * charges at ship time, which can trail the order by several days. */
const DATE_WINDOW_DAYS = 10;

/** Tolerance for item-sum vs. charge amount: item prices don't include tax,
 * so the real charge is always a bit higher. 12% covers most US sales tax
 * rates with room to spare; the $1 floor covers tiny orders where 12% would
 * be too tight to matter. */
function withinTolerance(itemSum: number, chargeAmount: number): boolean {
  const tolerance = Math.max(1, itemSum * 0.12);
  return chargeAmount >= itemSum && chargeAmount - itemSum <= tolerance;
}

function daysBetween(a: string, b: string): number {
  const diffMs = new Date(a).getTime() - new Date(b).getTime();
  return Math.abs(diffMs) / (1000 * 60 * 60 * 24);
}

/**
 * Matches unmatched imported Amazon orders against uncategorized inbox
 * transactions whose description contains "amazon". V1 only matches a whole
 * order (all its items) to a single bank charge — it does not yet handle an
 * order that gets split across multiple separate charges. When matched, the
 * original charge is marked tier = 'split' (excluded from the inbox and
 * spend totals, like transfer/income/investment) and one new source =
 * 'amazon-item' row per item is inserted with tier left null so it lands in
 * the inbox to be labeled, carrying the real item name as its description.
 * Item amounts are scaled so they sum exactly to the real charge (absorbing
 * tax/shipping proportionally) rather than the pre-tax item price.
 */
export async function matchAmazonOrders(): Promise<{ matched: number; itemsCreated: number; skipped: number }> {
  const candidates = await db<{
    id: string;
    plaid_item_id: string;
    account_id: string;
    date: string;
    amount: string;
  }>`
    select id, plaid_item_id, account_id, to_char(date, 'YYYY-MM-DD') as date, amount
    from transactions
    where source = 'plaid' and tier is null and description ilike '%amazon%'
  `;

  const orders = await db<{
    id: string;
    order_id: string;
    order_date: string;
    items: AmazonOrderItem[];
  }>`
    select id, order_id, to_char(order_date, 'YYYY-MM-DD') as order_date, items
    from amazon_orders
    where matched = false
  `;

  let matched = 0;
  let itemsCreated = 0;
  let skipped = 0;
  const claimedOrderIds = new Set<string>();

  for (const txn of candidates) {
    const chargeAmount = Math.abs(Number(txn.amount));

    const candidateOrders = orders.filter(
      (o) =>
        !claimedOrderIds.has(o.id) &&
        daysBetween(o.order_date, txn.date) <= DATE_WINDOW_DAYS &&
        withinTolerance(itemsSum(o.items), chargeAmount)
    );

    // Ambiguous (multiple orders could explain this charge) — leave it for
    // manual labeling rather than guessing.
    if (candidateOrders.length !== 1) {
      if (candidateOrders.length > 1) skipped++;
      continue;
    }

    const order = candidateOrders[0];
    claimedOrderIds.add(order.id);

    const preTax = itemsSum(order.items);
    const scale = preTax > 0 ? chargeAmount / preTax : 1;

    for (const item of order.items) {
      const itemAmount = Math.round(item.price * item.quantity * scale * 100) / 100;
      const syntheticId = `amazon-item:${order.order_id}:${item.name}`;
      await db`
        insert into transactions (
          plaid_transaction_id, plaid_item_id, account_id, date, description,
          amount, tier, source, parent_transaction_id, raw
        )
        values (
          ${syntheticId}, ${txn.plaid_item_id}, ${txn.account_id}, ${txn.date}, ${item.name},
          ${itemAmount}, null, 'amazon-item', ${txn.id}, ${JSON.stringify(item)}
        )
        on conflict (plaid_transaction_id) do nothing
      `;
      itemsCreated++;
    }

    await db`update transactions set tier = 'split', updated_at = now() where id = ${txn.id}`;
    await db`update amazon_orders set matched = true where id = ${order.id}`;
    matched++;
  }

  return { matched, itemsCreated, skipped };
}
