import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../../lib/db.js";
import { requireAuth } from "../../lib/auth.js";
import { resolveCategoryColor } from "../../lib/categories.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!(await requireAuth(req, res))) return;

  try {
    const rows = await db<{ id: string; name: string; parent_id: string | null; color: string | null }>`
      select id, name, parent_id, color from categories order by name
    `;

    const result = await Promise.all(
      rows.map(async (r) => ({
        id: r.id,
        name: r.name,
        parentId: r.parent_id,
        color: r.parent_id === null ? (r.color ?? "#111111") : await resolveCategoryColor(r.id),
      }))
    );

    return res.status(200).json(result);
  } catch (err) {
    console.error("categories list error:", err);
    return res.status(500).json({ error: "Failed to fetch categories." });
  }
}
