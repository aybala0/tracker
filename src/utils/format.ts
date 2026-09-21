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

/** Converts a "YYYY-MM" string to a short month label, e.g. "2026-03" -> "Mar". */
export function monthAbbrev(ym: string): string {
  const [year, month] = ym.split("-");
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("en-US", { month: "short" });
}

/** Formats a trend bucket key for its granularity: "2026-03" -> "Mar", "2026-03-09" -> "Mar 9". */
export function bucketLabel(bucket: string, granularity: "month" | "week" | "day"): string {
  if (granularity === "month") return monthAbbrev(bucket);
  const [year, month, day] = bucket.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
