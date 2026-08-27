import { useCallback, useState } from "react";
import type { DrillItem } from "../types";

// TODO(backend): replace with a fetch of transactions for the selected
// category/month, keyed the same way.
const MOCK_DRILL: Record<string, DrillItem[]> = {
  Groceries: [
    { desc: "TRADER JOE S #706 CHICAGO IL", tag: "Trader Joe's", amt: 47.43, date: "6 Aug", shared: true },
    { desc: "MARIANO'S #8517 CHICAGO IL", tag: "Groceries", amt: 88.12, date: "11 Aug", shared: true },
    { desc: "WHOLEFDS HYP #10145", tag: "Groceries", amt: 61.4, date: "18 Aug", shared: false },
    { desc: "H MART CHICAGO IL", tag: "Groceries", amt: 52.77, date: "22 Aug", shared: true },
  ],
  "Rent & Bills": [
    { desc: "ZELLE PAYMENT TO GRANVILLE MGMT", tag: "Rent", amt: 1620.0, date: "1 Aug", shared: true },
    { desc: "COMED BILL PAYMENT 800-334-7661", tag: "Electric", amt: 74.31, date: "9 Aug", shared: true },
    { desc: "XFINITY MOBILE 855-4-XFINITY", tag: "Internet", amt: 70.0, date: "12 Aug", shared: false },
    { desc: "PEOPLES GAS BILL PAY", tag: "Rent & Bills", amt: 41.2, date: "14 Aug", shared: true },
  ],
  "Food & Drinks": [
    { desc: "GRUBHUB - U OF IL - CHICA", tag: "Delivery", amt: 13.28, date: "6 Aug", shared: false },
    { desc: "SP HOXTON BAKERY CHICAGO", tag: "Coffee", amt: 7.15, date: "7 Aug", shared: false },
    { desc: "KASAMA CHICAGO IL", tag: "Dinner out", amt: 96.4, date: "16 Aug", shared: true },
  ],
  Shopping: [
    { desc: "Uniqlo USA LLC New York NY", tag: "Clothing", amt: 114.88, date: "6 Aug", shared: false },
    { desc: "Amazon.com*YI9JY44W3", tag: "Amazon", amt: 19.83, date: "5 Aug", shared: false },
    { desc: "MUJI 555 N MICHIGAN", tag: "Shopping", amt: 38.4, date: "19 Aug", shared: false },
  ],
};

/**
 * Owns the per-category drill-down transaction lists and lets a transaction
 * be relabeled (moved) to a different category.
 */
export function useDrillTransactions() {
  const [drill, setDrill] = useState<Record<string, DrillItem[]>>(MOCK_DRILL);

  const relabel = useCallback((fromCategory: string, desc: string, toCategory: string) => {
    if (fromCategory === toCategory) return;
    setDrill((prev) => {
      const items = prev[fromCategory] || [];
      const item = items.find((d) => d.desc === desc);
      if (!item) return prev;
      const relabeled: DrillItem = { ...item, tag: toCategory };
      return {
        ...prev,
        [fromCategory]: items.filter((d) => d.desc !== desc),
        [toCategory]: [...(prev[toCategory] || []), relabeled],
      };
    });
  }, []);

  return { drill, relabel };
}
