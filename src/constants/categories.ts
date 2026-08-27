/**
 * One fixed color per category, used consistently everywhere a category
 * appears: chip background when selected, pie slice fill, drill-down tag
 * background. Keep this mapping verbatim — colors are the shorthand for a
 * category across the whole app.
 */
export const CAT_COLOR: Record<string, string> = {
  "Food & Drinks": "#F2188F",
  "Rent & Bills": "#17BEBB",
  Groceries: "#78C247",
  Shopping: "#F2DC5D",
  Home: "#2196F3",
  Car: "#548C2F",
  Fun: "#A259D9",
  Transportation: "#FF7A1A",
  Travel: "#0E7C9B",
  Other: "#111111",
};

export const CATS = Object.keys(CAT_COLOR);

/** Mock month-to-date totals per category, in dollars. */
export const MONTH: Record<string, number> = {
  "Rent & Bills": 1840,
  Groceries: 412,
  "Food & Drinks": 386,
  Shopping: 274,
  Fun: 168,
  Transportation: 121,
  Home: 96,
  Car: 64,
  Other: 89,
};

/** Known subcategories per category, offered as chips during labeling. */
export const SUBS: Record<string, string[]> = {
  "Food & Drinks": ["Coffee", "Delivery", "Dinner out"],
  Groceries: ["Trader Joe's"],
  "Rent & Bills": ["Rent", "Electric", "Internet"],
  Transportation: ["Uber", "CTA"],
  Shopping: ["Clothing", "Amazon"],
  Other: ["Theatre"],
};

export const MONTH_OPTIONS = [
  "August 2026",
  "July 2026",
  "June 2026",
  "May 2026",
  "April 2026",
  "March 2026",
];
