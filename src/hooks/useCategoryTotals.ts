import { MONTH } from "../constants/categories";

// TODO(backend): fetch category totals for the given month; the mock ignores
// `month` and always returns the same distribution.
export function useCategoryTotals(_month: string): Record<string, number> {
  return MONTH;
}
