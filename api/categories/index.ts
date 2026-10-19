import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../../lib/db.js";
import { requireAuth } from "../../lib/auth.js";
import { findOrCreateMajor, loadMajors } from "../../lib/category-defs.js";

// GET lists every major (built-in + custom) with its subcategories; POST
// creates a custom major. Both live in this one file to stay under Vercel
// Hobby's 12-Serverless-Function cap.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!(await requireAuth(req, res))) return;

  if (req.method === "POST") {
    const { name } = (req.body ?? {}) as { name?: string };
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "name is required." });
    }
    try {
      const major = await findOrCreateMajor(name);
      if (!major) {
        return res.status(400).json({ error: "name needs at least one letter or number." });
      }
      return res.status(200).json(major);
    } catch (err) {
      console.error("category create error:", err);
      return res.status(500).json({ error: "Failed to create category." });
    }
  }

  try {
    const [majors, subRows] = await Promise.all([
      loadMajors(),
      db<{ id: string; parent_slug: string; name: string }>`
        select id, parent_slug, name from subcategories order by parent_slug, name
      `,
    ]);

    const result = majors.map((major) => ({
      slug: major.slug,
      name: major.name,
      custom: major.custom,
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
