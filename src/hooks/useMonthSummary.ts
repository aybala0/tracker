// TODO(backend): compute this month's spend vs. the day-of-month average from
// real transaction data instead of returning a fixed mock snapshot.
export function useMonthSummary() {
  return {
    thisMonth: 3450,
    average: 3921,
    percentBelow: 12,
    dayOfMonth: 27,
    /** % width, from the left, of the filled portion of the comparison bar. */
    fillPct: 77.6,
    /** % from the left where the "avg" marker line sits. */
    avgLinePct: 88,
  };
}
