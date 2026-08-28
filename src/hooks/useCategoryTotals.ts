import { useEffect, useState } from "react";

/** Converts a "August 2026" style month string to "YYYY-MM". */
function toYearMonth(month: string): string {
  const [monthName, year] = month.split(" ");
  const idx = new Date(`${monthName} 1, ${year}`).getMonth(); // 0-indexed
  return `${year}-${String(idx + 1).padStart(2, "0")}`;
}

export function useCategoryTotals(month: string): Record<string, number> {
  const [totals, setTotals] = useState<Record<string, number>>({});

  useEffect(() => {
    const ym = toYearMonth(month);
    fetch(`/api/summary/categories?month=${ym}`)
      .then((res) => res.json())
      .then((data: Record<string, number>) => setTotals(data))
      .catch(() => setTotals({}));
  }, [month]);

  return totals;
}
