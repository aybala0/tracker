/**
 * The 10 default major categories: slug (machine id, matches
 * lib/category-defs.ts on the backend), display name, and fixed color. Color
 * is a frontend-only presentation concern — see src/utils/category-color.ts
 * for how it's looked up/derived at render time. Keep colors verbatim —
 * they're the shorthand for a category across pie slices, chips, and tags,
 * and are already baked into the shipped UI.
 */
export const MAJOR_CATEGORIES: { slug: string; name: string; color: string }[] = [
  { slug: "food-drinks", name: "Food & Drinks", color: "#F2188F" },
  { slug: "rent-bills", name: "Rent & Bills", color: "#17BEBB" },
  { slug: "groceries", name: "Groceries", color: "#78C247" },
  { slug: "shopping", name: "Shopping", color: "#F2DC5D" },
  { slug: "home", name: "Home", color: "#2196F3" },
  { slug: "car", name: "Car", color: "#548C2F" },
  { slug: "fun", name: "Fun", color: "#A259D9" },
  { slug: "transportation", name: "Transportation", color: "#FF7A1A" },
  { slug: "travel", name: "Travel", color: "#0E7C9B" },
  { slug: "other", name: "Other", color: "#111111" },
];

/** Display names in fixed order, derived from MAJOR_CATEGORIES — kept as a small export since several components just need the name list. */
export const CATS = MAJOR_CATEGORIES.map((c) => c.name);

/**
 * Current month first, going back `count` months — computed from today's
 * date instead of a fixed list, so a new month shows up in the Categories
 * dropdown on its own instead of needing this file edited every month.
 */
function monthOptions(count = 12): string[] {
  const now = new Date();
  const months: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d.toLocaleDateString("en-US", { month: "long", year: "numeric" }));
  }
  return months;
}

export const MONTH_OPTIONS = monthOptions();
