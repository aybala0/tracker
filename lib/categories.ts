import { db } from "./db.js";

/**
 * Looks up/creates a subcategory row by (parent_slug, name). majorSlug must
 * already be a valid slug from lib/category-defs.ts's MAJOR_CATEGORIES —
 * callers are responsible for resolving/validating the major name first.
 */
export async function findOrCreateSubcategoryId(majorSlug: string, subName: string): Promise<string> {
  const [existing] = await db<{ id: string }>`
    select id from subcategories where parent_slug = ${majorSlug} and name = ${subName}
  `;
  if (existing) return existing.id;

  const [created] = await db<{ id: string }>`
    insert into subcategories (parent_slug, name)
    values (${majorSlug}, ${subName})
    on conflict (parent_slug, name) do update set name = excluded.name
    returning id
  `;
  return created!.id;
}

/** Returns a subcategory's own name plus its parent's slug, or null if the id doesn't exist. */
export async function getSubcategoryInfo(id: string): Promise<{ name: string; parentSlug: string } | null> {
  const [row] = await db<{ name: string; parent_slug: string }>`
    select name, parent_slug from subcategories where id = ${id}
  `;
  if (!row) return null;
  return { name: row.name, parentSlug: row.parent_slug };
}
