import { useCallback, useMemo, useState } from "react";
import type { Transaction } from "../types";

// TODO(backend): replace with a fetch from the transactions API. Shape kept
// identical so callers don't need to change when that lands.
const MOCK_TX: Transaction[] = [
  {
    id: 1,
    date: "6 Jan",
    desc: "UBER *TRIP HELP.UBER.COM CA",
    amt: 55.81,
    rule: "Rule “uber” → Transportation · Uber",
    cat: "Transportation",
    sub: "Uber",
  },
  { id: 2, date: "6 Jan", desc: "TRADER JOE S #706 CHICAGO IL", amt: 47.43, rule: null },
  { id: 3, date: "6 Jan", desc: "GRUBHUB - U OF IL - CHICA CHICAGO IL", amt: 13.28, rule: null },
  { id: 4, date: "6 Jan", desc: "Uniqlo USA LLC New York NY", amt: 114.88, rule: null },
  { id: 5, date: "8 Jan", desc: "COURT THEATRE/UCA ONLINE 773-678-5594 IL", amt: 42.0, rule: null },
  { id: 6, date: "5 Jan", desc: "Amazon.com*YI9JY44W3 Amzn.com/bill WA", amt: 19.83, rule: null },
  { id: 7, date: "29 Dec", desc: "LinkedInPreF *33656606 855-6535653 CA", amt: 359.88, rule: null },
];

/**
 * Owns the transaction list and which ones are still uncategorized
 * ("inbox"). `categorize` assigns a category/subcategory and removes the
 * transaction from the inbox — mirrors what a real "label this transaction"
 * API call would do.
 */
export function useTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>(MOCK_TX);
  const [categorizedIds, setCategorizedIds] = useState<Set<number>>(new Set());

  const inbox = useMemo(
    () => transactions.filter((t) => !categorizedIds.has(t.id)),
    [transactions, categorizedIds]
  );

  const categorize = useCallback((id: number, cat: string, sub: string | null) => {
    setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, cat, sub: sub ?? undefined } : t)));
    setCategorizedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  return { transactions, inbox, categorize, loading: false };
}
