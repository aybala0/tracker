import { useEffect, useState } from "react";

type MonthSummary = {
  thisMonth: number;
  average: number;
  percentBelow: number;
  dayOfMonth: number;
  /** % width, from the left, of the filled portion of the comparison bar. */
  fillPct: number;
  /** % from the left where the "avg" marker line sits. */
  avgLinePct: number;
};

const EMPTY: MonthSummary = {
  thisMonth: 0,
  average: 0,
  percentBelow: 0,
  dayOfMonth: 0,
  fillPct: 0,
  avgLinePct: 0,
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
