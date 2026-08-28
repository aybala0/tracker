import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../../../lib/db.js";
import { requireAuth } from "../../../lib/auth.js";
import { getCategoryIdByName, findOrCreateSubcategoryId } from "../../../lib/categories.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!(await requireAuth(req, res))) return;

  const { id } = req.query as { id?: string };
  if (!id) {
    return res.status(400).json({ error: "Missing id." });
  }

  const { cat, sub, isShared } = req.body as { cat?: string; sub?: string | null; isShared?: boolean };
  if (!cat) {
    return res.status(400).json({ error: "cat is required." });
  }

  try {
    const [existing] = await db<{ id: string }>`select id from transactions where id = ${id}`;
    if (!existing) {
      return res.status(404).json({ error: "Transaction not found." });
    }

    const majorId = await getCategoryIdByName(cat);
    if (!majorId) {
      return res.status(400).json({ error: `Unknown category: ${cat}` });
    }

    let categoryId = majorId;
    if (sub) {
      const subId = await findOrCreateSubcategoryId(cat, sub);
      if (subId) categoryId = subId;
    }

    await db`
      update transactions
      set tier = 'purchase', category_id = ${categoryId}, is_shared = ${!!isShared}, updated_at = now()
      where id = ${id}
    `;

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("categorize transaction error:", err);
    return res.status(500).json({ error: "Failed to categorize transaction." });
  }
}
