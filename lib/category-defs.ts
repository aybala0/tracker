import { db } from "./db.js";

/**
 * The 10 default major categories, fully known in advance (see specs.md).
 * These are pure code constants — no database rows, ever. Slugs are the
 * stable machine id used in category_slug columns; names are the display
 * strings shown throughout the UI. Color lives only on the frontend's copy
 * of this list (src/constants/categories.ts) — color is a presentation
 * concern, not part of the backend data model.
 *
 * User-defined majors live in the custom_categories table instead — use
 * loadMajors() for the full list.
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

export type Major = { slug: string; name: string; custom: boolean };

/**
 * Every major category: the built-in nine, then custom ones in creation
 * order, then Other last. Creation order matters — the frontend derives a
 * custom major's color from its position among the custom ones.
 */
export async function loadMajors(): Promise<Major[]> {
  const custom = await db<{ slug: string; name: string }>`
    select slug, name from custom_categories order by created_at, slug
  `;
  const builtIn = MAJOR_CATEGORIES.map((c) => ({ ...c, custom: false }));
  const other = builtIn.filter((c) => c.slug === "other");
  return [
    ...builtIn.filter((c) => c.slug !== "other"),
    ...custom.map((c) => ({ ...c, custom: true })),
    ...other,
  ];
}

/** Resolves a major category's display name to its slug (exact match). Returns null if unknown. */
export async function resolveMajorSlug(name: string): Promise<string | null> {
  return (await loadMajors()).find((c) => c.name === name)?.slug ?? null;
}

/** Resolves a major category's slug to its display name. Returns null if unknown. */
export async function getMajorName(slug: string): Promise<string | null> {
  return (await loadMajors()).find((c) => c.slug === slug)?.name ?? null;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Creates a custom major category, or returns the existing major (built-in
 * or custom) whose name matches case-insensitively — so "theatre" after
 * "Theatre" doesn't create a near-duplicate. Returns null if the name has
 * nothing to build a slug from (e.g. only emoji/punctuation).
 */
export async function findOrCreateMajor(rawName: string): Promise<Major | null> {
  const name = rawName.trim();
  const majors = await loadMajors();
  const existing = majors.find((c) => c.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing;

  const base = slugify(name);
  if (!base) return null;
  let slug = base;
  for (let i = 2; majors.some((c) => c.slug === slug); i++) slug = `${base}-${i}`;

  const [created] = await db<{ slug: string; name: string }>`
    insert into custom_categories (slug, name) values (${slug}, ${name})
    on conflict (name) do update set name = excluded.name
    returning slug, name
  `;
  return { ...created!, custom: true };
}
