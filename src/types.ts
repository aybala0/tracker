export type Tier = "Income" | "Purchase" | "Investment";

export type Transaction = {
  id: string;
  date: string;
  desc: string;
  amt: number;
  /** Human-readable rule hint shown when a rule auto-matched this transaction, e.g. `Rule "uber" → Transportation · Uber`. */
  rule: string | null;
  cat?: string;
  sub?: string;
  /** Set when the matched rule suggests Income/Investment instead of a purchase category. */
  ruleTier?: Extract<Tier, "Income" | "Investment">;
};

export type DrillItem = {
  id: string;
  desc: string;
  tag: string;
  amt: number;
  date: string;
  shared: boolean;
};

export type NavTarget = "Home" | "Inbox" | "Categories" | "Analysis";

export type DefineCategoryKind = "major" | "minor";
