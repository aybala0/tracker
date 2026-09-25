import { useEffect, useState } from "react";

export type Granularity = "month" | "week" | "day";
export type TrendPoint = { bucket: string; total: number };
/** `subcategoryId` narrows the line to one subcategory; when set, `category` is left null (the id alone identifies it). */
export type TrendSeries = { key: string; category: string | null; subcategoryId?: string; color: string };

/**
 * Fetches one spend-over-time series per entry in `series` (one per active
 * line on the trend chart) and keeps them keyed by `series[].key`, so a
 * chart can overlay several lines — e.g. "All" plus a couple of categories
 * — without each one owning its own hook call (series count changes as the
 * user toggles chips, and hook calls can't be conditional).
 */
export function useSpendTrends(
  series: TrendSeries[],
  months: number,
  granularity: Granularity
): { data: Record<string, TrendPoint[]>; loading: boolean } {
  const [data, setData] = useState<Record<string, TrendPoint[]>>({});
  const [loading, setLoading] = useState(false);
  const seriesKey = series.map((s) => `${s.key}:${s.category ?? ""}:${s.subcategoryId ?? ""}`).join(",");

  useEffect(() => {
    if (series.length === 0) {
      setData({});
      return;
    }
    setLoading(true);
    Promise.all(
      series.map((s) => {
        const qs = new URLSearchParams({ months: String(months), granularity });
        if (s.category) qs.set("category", s.category);
        if (s.subcategoryId) qs.set("subcategory", s.subcategoryId);
        return fetch(`/api/summary/trend?${qs}`)
          .then((res) => res.json())
          .then((points: TrendPoint[]) => [s.key, points] as const);
      })
    )
      .then((entries) => setData(Object.fromEntries(entries)))
      .catch(() => setData({}))
      .finally(() => setLoading(false));
  }, [seriesKey, months, granularity]);

  return { data, loading };
}
