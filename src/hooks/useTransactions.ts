import { useCallback, useEffect, useState } from "react";
import type { Tier, Transaction } from "../types";

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

  // Categorizing one transaction also categorizes every other transaction
  // still uncategorized with the exact same description — the backend
  // propagates this server-side (see api/transactions/[id]/categorize.ts),
  // so the local optimistic removal mirrors it here: drop the whole
  // matching-description group from the inbox immediately, not just the
  // one row that was clicked.
  const removeMatchingDescription = (prev: Transaction[], id: string): Transaction[] => {
    const desc = prev.find((t) => t.id === id)?.desc;
    return prev.filter((t) => t.id !== id && t.desc !== desc);
  };

  const categorize = useCallback((id: string, cat: string, sub: string | null) => {
    setInbox((prev) => removeMatchingDescription(prev, id));
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
   * can't run before the category is actually saved. Sharing itself never
   * propagates to same-description siblings — that stays a one-at-a-time,
   * deliberate action since it writes to the real shared sheet.
   */
  const share = useCallback((id: string, cat: string, sub: string | null, description: string) => {
    setInbox((prev) => removeMatchingDescription(prev, id));
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

  /**
   * Labels a transaction as Income or Investment — these tiers aren't
   * broken down into the purchase category list, so there's nothing to
   * pick, just a tier to record.
   */
  const categorizeTier = useCallback((id: string, tier: Extract<Tier, "Income" | "Investment">) => {
    setInbox((prev) => removeMatchingDescription(prev, id));
    fetch(`/api/transactions/${id}/categorize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier: tier.toLowerCase() }),
    }).catch(() => {
      // Optimistic removal stays even on failure — no rollback UI for this pass.
    });
  }, []);

  return { transactions: inbox, inbox, categorize, share, categorizeTier, loading };
}
