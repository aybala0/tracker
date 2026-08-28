import { useCallback, useEffect, useState } from "react";
import type { Transaction } from "../types";

/**
 * Owns the uncategorized transaction inbox. `categorize` assigns a
 * category/subcategory, optimistically removes the transaction from the
 * local inbox (so the row disappears immediately), and persists it via the
 * categorize API.
 */
export function useTransactions() {
  const [inbox, setInbox] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/transactions/inbox")
      .then((res) => res.json())
      .then((data: Transaction[]) => setInbox(data))
      .catch(() => setInbox([]))
      .finally(() => setLoading(false));
  }, []);

  const categorize = useCallback((id: string, cat: string, sub: string | null) => {
    setInbox((prev) => prev.filter((t) => t.id !== id));
    fetch(`/api/transactions/${id}/categorize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cat, sub, isShared: false }),
    }).catch(() => {
      // Optimistic removal stays even on failure — no rollback UI for this pass.
    });
  }, []);

  /**
   * Categorizes a transaction AND logs it as a 50/50 shared expense to
   * Hayat. Categorize must complete first — `/api/hayat/share` reads the
   * transaction's already-set category to build the sheet row's tag, so it
   * can't run before the category is actually saved.
   */
  const share = useCallback((id: string, cat: string, sub: string | null, description: string) => {
    setInbox((prev) => prev.filter((t) => t.id !== id));
    fetch(`/api/transactions/${id}/categorize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cat, sub, isShared: true }),
    })
      .then(() =>
        fetch(`/api/hayat/share`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transactionId: id, description }),
        })
      )
      .catch(() => {
        // Optimistic removal stays even on failure — no rollback UI for this pass.
      });
  }, []);

  return { transactions: inbox, inbox, categorize, share, loading };
}
