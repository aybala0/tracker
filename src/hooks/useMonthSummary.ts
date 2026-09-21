import { useEffect, useState } from "react";

export type PaceLabel = "under" | "regular" | "over";

type MonthSummary = {
  thisMonth: number;
  average: number;
  /** Projected full-month typical total (average scaled up from "by today" to the whole month) — the shared denominator for both bars. */
  projectedMonthTotal: number;
  paceLabel: PaceLabel;
  dayOfMonth: number;
  daysInMonth: number;
  /** % width of the actual-spend bar, against projectedMonthTotal. */
  fillPct: number;
  /** % from the left where the "today" tick sits. */
  todayPct: number;
};

const EMPTY: MonthSummary = {
  thisMonth: 0,
  average: 0,
  projectedMonthTotal: 0,
  paceLabel: "regular",
  dayOfMonth: 0,
  daysInMonth: 30,
  fillPct: 0,
  todayPct: 0,
};

export function useMonthSummary() {
  const [data, setData] = useState<MonthSummary>(EMPTY);

  useEffect(() => {
    fetch("/api/summary/month")
      .then((res) => res.json())
      .then((d) => setData(d))
      .catch(() => {});
  }, []);

  return data;
}
