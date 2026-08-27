// TODO(backend): fetch real account balances (e.g. via Plaid) instead.
export function useNetWorth() {
  return { net: 6755.72, checking: 8742.16, cards: -1986.44 };
}
