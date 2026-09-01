export type Tier = "income" | "purchase" | "investment";

export type Subcategory = {
  id: string;
  parentSlug: string;
  name: string;
};

export type RegexRule = {
  id: string;
  pattern: string;
  categorySlug: string | null;
  subcategoryId: string | null;
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
  categorySlug: string | null;
  subcategoryId: string | null;
  isShared: boolean;
  hayatLogged: boolean;
  matchedRuleId: string | null;
};
