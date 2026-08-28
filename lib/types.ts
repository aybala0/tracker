export type Tier = "income" | "purchase" | "investment";

export type Category = {
  id: string;
  name: string;
  parentId: string | null;
  /** Own color if this is a major category, else the parent's color. */
  color: string;
};

export type RegexRule = {
  id: string;
  pattern: string;
  categoryId: string;
  tier: Tier;
  label: string;
};

export type Account = {
  id: string;
  plaidAccountId: string;
  name: string;
  type: string;
  subtype: string | null;
  mask: string | null;
  currentBalance: number | null;
  availableBalance: number | null;
};

export type Transaction = {
  id: string;
  plaidTransactionId: string;
  accountId: string;
  date: string;
  description: string;
  amount: number;
  tier: Tier | null;
  categoryId: string | null;
  isShared: boolean;
  hayatLogged: boolean;
  matchedRuleId: string | null;
};
