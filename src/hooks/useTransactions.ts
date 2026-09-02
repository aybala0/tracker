import { useCallback, useEffect, useState } from "react";
import type { Tier, Transaction } from "../types";

/**
 * Owns the uncategorized transaction inbox. `categorize` assigns a
 * category/subcategory, optimistically removes just that transaction from
 * the local inbox, and refetches afterward — so if the user also filled in
 * the "repeats? make it a rule" madlib (ruleContains), any same-description
 * sibling now carrying that rule's suggestion (see createContainsRule)
 * shows up in the "already matched" review section.
 */
export function useTransactions() {
  const [inbox, setInbox] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInbox = useCallback(() => {
    return fetch("/api/transactions/inbox")
      .then((res) => res.json())
      .then((data: Transaction[]) => setInbox(data))
      .catch(() => setInbox([]));
  }, []);

  useEffect(() => {
    fetchInbox().finally(() => setLoading(false));
  }, [fetchInbox]);

  // Plain categorization only ever affects the one transaction being
  // labeled — no other row is touched unless the user explicitly filled in
  // the "repeats? make it a rule" madlib (ruleContains), in which case the
  // backend also flags any matching still-uncategorized siblings with the
  // new rule for review. Only the row actually being labeled is removed
  // optimistically; a refetch afterward picks up any siblings' new
  // suggestion.
  const categorize = useCallback(
    (id: string, cat: string, sub: string | null, ruleContains?: string) => {
      setInbox((prev) => prev.filter((t) => t.id !== id));
      fetch(`/api/transactions/${id}/categorize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cat, sub, isShared: false, ruleContains }),
      })
        .then(fetchInbox)
        .catch(() => {
          // Optimistic removal stays even on failure — no rollback UI for this pass.
        });
    },
    [fetchInbox]
  );

  /**
   * Categorizes a transaction AND logs it as a 50/50 shared expense to
   * Hayat. Categorize must complete first — `/api/hayat/share` reads the
   * transaction's already-set category to build the sheet row's tag, so it
   * can't run before the category is actually saved. Sharing itself is
   * always a one-at-a-time, deliberate action (it writes to the real
   * shared sheet) — the "make it a rule" madlib isn't offered on this path,
   * so it never touches other transactions.
   */
  const share = useCallback(
    (id: string, cat: string, sub: string | null, description: string) => {
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
        .then(fetchInbox)
        .catch(() => {
          // Optimistic removal stays even on failure — no rollback UI for this pass.
        });
    },
    [fetchInbox]
  );

  /**
   * Labels a transaction as Income or Investment — these tiers aren't
   * broken down into the purchase category list, so there's nothing to
   * pick, just a tier to record. Same opt-in rule model as categorize: only
   * this one transaction is touched unless the user filled in the "repeats?
   * make it a rule" madlib, in which case matching siblings get flagged for
   * review rather than silently re-tiered.
   */
  const categorizeTier = useCallback(
    (id: string, tier: Extract<Tier, "Income" | "Investment">, ruleContains?: string) => {
      setInbox((prev) => prev.filter((t) => t.id !== id));
      fetch(`/api/transactions/${id}/categorize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: tier.toLowerCase(), ruleContains }),
      })
        .then(fetchInbox)
        .catch(() => {
          // Optimistic removal stays even on failure — no rollback UI for this pass.
        });
    },
    [fetchInbox]
  );

  return { transactions: inbox, inbox, categorize, share, categorizeTier, loading };
}
