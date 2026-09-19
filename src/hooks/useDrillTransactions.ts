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
 * a row be fully edited: category, subcategory, description, shared
 * status, and an opt-in repeat rule.
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

  /**
   * Full edit for one drill-down row: category, subcategory, description,
   * shared status, and an opt-in "repeats? make it a rule" rule — all in
   * one save. `wasShared`/`shared` together decide whether to also call
   * /api/hayat/share: POST (write a new sheet row) when going false→true,
   * DELETE (remove the sheet row this app wrote, or the synthetic
   * `source = 'hayat'` transaction outright) when going true→false. No call
   * either way if shared status didn't change. Always refetches on success
   * rather than patching in place — a category change, an unshare on a
   * synthetic row, or a rule flagging siblings can all change which rows
   * belong in this list.
   */
  const editTransaction = useCallback(
    (
      id: string,
      opts: {
        cat: string;
        sub: string | null;
        description?: string;
        ruleContains?: string;
        shared: boolean;
        wasShared: boolean;
        hayatDescription?: string;
      }
    ) => {
      setItems((prev) => prev.filter((d) => d.id !== id));
      fetch(`/api/transactions/${id}/categorize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cat: opts.cat,
          sub: opts.sub,
          isShared: opts.shared,
          ruleContains: opts.ruleContains,
          description: opts.description,
        }),
      })
        .then(() => {
          if (opts.shared && !opts.wasShared) {
            return fetch(`/api/hayat/share`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ transactionId: id, description: opts.hayatDescription ?? "" }),
            });
          }
          if (!opts.shared && opts.wasShared) {
            return fetch(`/api/hayat/share`, {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ transactionId: id }),
            });
          }
        })
        .then(() => setReloadTick((t) => t + 1))
        .catch(() => {
          // Optimistic removal stays even on failure — no rollback UI for this pass.
        });
    },
    []
  );

  return { items, editTransaction, loading };
}
