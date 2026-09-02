import { useCallback, useEffect, useState } from "react";
import type { DrillItem } from "../types";

/** Converts a "August 2026" style month string to "YYYY-MM". */
function toYearMonth(month: string): string {
  const [monthName, year] = month.split(" ");
  const idx = new Date(`${monthName} 1, ${year}`).getMonth(); // 0-indexed
  return `${year}-${String(idx + 1).padStart(2, "0")}`;
}

/**
 * Owns the drill-down transaction list for a single category+month and lets
 * a transaction be relabeled (moved) to a different category.
 */
export function useDrillTransactions(category: string | null, month: string) {
  const [items, setItems] = useState<DrillItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    if (!category) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ym = toYearMonth(month);
    fetch(`/api/summary/drill?month=${ym}&category=${encodeURIComponent(category)}`)
      .then((res) => res.json())
      .then((data: DrillItem[]) => setItems(data))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [category, month, reloadTick]);

  // Note: the item's own `id` is needed to relabel the right row, so this
  // takes (id, toCategory) rather than toCategory alone — the call site
  // (DrillRow via CategoriesScreen) closes over the item to supply `id`.
  const relabel = useCallback(
    (id: string, toCategory: string, shared: boolean) => {
      if (toCategory === category) return;
      setItems((prev) => prev.filter((d) => d.id !== id));
      fetch(`/api/transactions/${id}/categorize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cat: toCategory, sub: null, isShared: shared }),
      }).catch(() => {
        // Optimistic removal stays even on failure — no rollback UI for this pass.
      });
    },
    [category]
  );

  /**
   * Undoes a mistaken "shared" label: clears the shared flags on the
   * transaction and removes the row this app wrote to the Hayat sheet.
   * Refetches on success rather than patching in place, since a
   * `source = 'hayat'` row (synthetic, no real Plaid transaction) gets
   * deleted server-side and should just disappear from this list.
   */
  const unshare = useCallback((id: string) => {
    fetch(`/api/hayat/share`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactionId: id }),
    })
      .then(() => setReloadTick((t) => t + 1))
      .catch(() => {
        // Leave the row as-is on failure — no rollback/error UI for this pass.
      });
  }, []);

  return { items, relabel, unshare, loading };
}
