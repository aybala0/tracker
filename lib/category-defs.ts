/**
 * The 10 default major categories, fully known in advance (see specs.md).
 * These are pure code constants — no database rows, ever. Slugs are the
 * stable machine id used in category_slug columns; names are the display
 * strings shown throughout the UI. Color lives only on the frontend's copy
 * of this list (src/constants/categories.ts) — color is a presentation
 * concern, not part of the backend data model.
 */
export const MAJOR_CATEGORIES: { slug: string; name: string }[] = [
  { slug: "food-drinks", name: "Food & Drinks" },
  { slug: "rent-bills", name: "Rent & Bills" },
  { slug: "groceries", name: "Groceries" },
  { slug: "shopping", name: "Shopping" },
  { slug: "home", name: "Home" },
  { slug: "car", name: "Car" },
  { slug: "fun", name: "Fun" },
  { slug: "transportation", name: "Transportation" },
  { slug: "travel", name: "Travel" },
  { slug: "other", name: "Other" },
];

/** Resolves a major category's display name to its slug (exact match). Returns null if unknown. */
export function resolveMajorSlug(name: string): string | null {
  return MAJOR_CATEGORIES.find((c) => c.name === name)?.slug ?? null;
}

/** Resolves a major category's slug to its display name. Returns null if unknown. */
export function getMajorName(slug: string): string | null {
  return MAJOR_CATEGORIES.find((c) => c.slug === slug)?.name ?? null;
}
