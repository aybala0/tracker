export type Tier = "Income" | "Purchase" | "Investment";

export type SplitOption = "I paid all" | "50 / 50" | "They paid";

export type Transaction = {
  id: number;
  date: string;
  desc: string;
  amt: number;
  /** Human-readable rule hint shown when a rule auto-matched this transaction, e.g. `Rule "uber" → Transportation · Uber`. */
  rule: string | null;
  cat?: string;
  sub?: string;
};

export type DrillItem = {
  desc: string;
  tag: string;
  amt: number;
  date: string;
  shared: boolean;
};

export type NavTarget = "Home" | "Inbox" | "Categories" | "Analysis";

export type DefineCategoryKind = "major" | "minor";
