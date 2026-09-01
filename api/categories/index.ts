import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../../lib/db.js";
import { requireAuth } from "../../lib/auth.js";
import { MAJOR_CATEGORIES } from "../../lib/category-defs.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!(await requireAuth(req, res))) return;

  try {
    const subRows = await db<{ id: string; parent_slug: string; name: string }>`
      select id, parent_slug, name from subcategories order by parent_slug, name
    `;

    const result = MAJOR_CATEGORIES.map((major) => ({
      slug: major.slug,
      name: major.name,
      subcategories: subRows
        .filter((s) => s.parent_slug === major.slug)
        .map((s) => ({ id: s.id, name: s.name })),
    }));

    return res.status(200).json(result);
  } catch (err) {
    console.error("categories list error:", err);
    return res.status(500).json({ error: "Failed to fetch categories." });
  }
}
