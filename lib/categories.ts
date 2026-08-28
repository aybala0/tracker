import { db } from "./db.js";

const FALLBACK_COLOR = "#111111"; // Other's color, used as a last-resort fallback.

/** Looks up a top-level category (parent_id is null) by exact name match. */
export async function getCategoryIdByName(name: string): Promise<string | null> {
  const [row] = await db<{ id: string }>`
    select id from categories where name = ${name} and parent_id is null
  `;
  return row?.id ?? null;
}

/**
 * Looks up a subcategory row (name = subName, parent = parentName). Creates
 * it if it doesn't exist yet. Returns null if parentName itself doesn't
 * resolve to a top-level category.
 */
export async function findOrCreateSubcategoryId(
  parentName: string,
  subName: string
): Promise<string | null> {
  const parentId = await getCategoryIdByName(parentName);
  if (!parentId) return null;

  const [existing] = await db<{ id: string }>`
    select id from categories where name = ${subName} and parent_id = ${parentId}
  `;
  if (existing) return existing.id;

  const [created] = await db<{ id: string }>`
    insert into categories (name, parent_id, color)
    values (${subName}, ${parentId}, null)
    returning id
  `;
  return created?.id ?? null;
}

/**
 * Given any category id (major or minor), returns its own color if set,
 * else its parent's color, else the fallback color.
 */
export async function resolveCategoryColor(categoryId: string): Promise<string> {
  const [row] = await db<{ color: string | null; parent_color: string | null }>`
    select cat.color as color, parent.color as parent_color
    from categories cat
    left join categories parent on cat.parent_id = parent.id
    where cat.id = ${categoryId}
  `;
  if (!row) return FALLBACK_COLOR;
  return row.color ?? row.parent_color ?? FALLBACK_COLOR;
}

/**
 * Returns the category's own name plus its parent's name (null if it's
 * already top-level).
 */
export async function getCategoryName(
  categoryId: string
): Promise<{ name: string; parentName: string | null }> {
  const [row] = await db<{ name: string; parent_name: string | null }>`
    select cat.name as name, parent.name as parent_name
    from categories cat
    left join categories parent on cat.parent_id = parent.id
    where cat.id = ${categoryId}
  `;
  if (!row) return { name: "", parentName: null };
  return { name: row.name, parentName: row.parent_name };
}
