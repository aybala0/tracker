import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../../../lib/db.js";
import { requireAuth } from "../../../lib/auth.js";
import { findOrCreateSubcategoryId } from "../../../lib/categories.js";
import { resolveMajorSlug } from "../../../lib/category-defs.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!(await requireAuth(req, res))) return;

  const { id } = req.query as { id?: string };
  if (!id) {
    return res.status(400).json({ error: "Missing id." });
  }

  const { cat, sub, isShared, tier: tierRaw } = req.body as {
    cat?: string;
    sub?: string | null;
    isShared?: boolean;
    tier?: string;
  };
  const tier = tierRaw === "income" || tierRaw === "investment" ? tierRaw : "purchase";

  if (tier === "purchase" && !cat) {
    return res.status(400).json({ error: "cat is required for purchase transactions." });
  }

  try {
    const [existing] = await db<{ id: string }>`select id from transactions where id = ${id}`;
    if (!existing) {
      return res.status(404).json({ error: "Transaction not found." });
    }

    // Income/investment transactions aren't broken down into the purchase
    // category list — just record the tier, no category.
    if (tier !== "purchase") {
      await db`
        update transactions
        set tier = ${tier}, category_slug = null, subcategory_id = null, is_shared = false, updated_at = now()
        where id = ${id}
      `;
      return res.status(200).json({ ok: true });
    }

    const majorSlug = resolveMajorSlug(cat!);
    if (!majorSlug) {
      return res.status(400).json({ error: `Unknown category: ${cat}` });
    }

    const subcategoryId = sub ? await findOrCreateSubcategoryId(majorSlug, sub) : null;

    await db`
      update transactions
      set tier = 'purchase', category_slug = ${majorSlug}, subcategory_id = ${subcategoryId},
          is_shared = ${!!isShared}, updated_at = now()
      where id = ${id}
    `;

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("categorize transaction error:", err);
    return res.status(500).json({ error: "Failed to categorize transaction." });
  }
}
