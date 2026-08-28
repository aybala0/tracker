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
export function useDrillTransactions(category: string, month: string) {
  const [items, setItems] = useState<DrillItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const ym = toYearMonth(month);
    fetch(`/api/summary/drill?month=${ym}&category=${encodeURIComponent(category)}`)
      .then((res) => res.json())
      .then((data: DrillItem[]) => setItems(data))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [category, month]);

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

  return { items, relabel, loading };
}
