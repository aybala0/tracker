export function money(n: number): string {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Formats a transaction amount using Plaid's sign convention (negative =
 * money entering the account) with a "+" prefix for incoming money, so
 * deposits/refunds read differently from ordinary spend in a mixed list
 * like the Inbox.
 */
export function moneySigned(n: number): string {
  return n < 0 ? "+" + money(-n) : money(n);
}

export function short(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-US");
}
