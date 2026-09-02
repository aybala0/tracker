import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../../../lib/db.js";
import { requireAuth } from "../../../lib/auth.js";
import { findOrCreateSubcategoryId } from "../../../lib/categories.js";
import { resolveMajorSlug } from "../../../lib/category-defs.js";
import { createContainsRule } from "../../../lib/categorize.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!(await requireAuth(req, res))) return;

  const { id } = req.query as { id?: string };
  if (!id) {
    return res.status(400).json({ error: "Missing id." });
  }

  const { cat, sub, isShared, tier: tierRaw, ruleContains } = req.body as {
    cat?: string;
    sub?: string | null;
    isShared?: boolean;
    tier?: string;
    /** Optional "if description contains ___" text from the madlib rule-creation UI. */
    ruleContains?: string;
  };
  const tier = tierRaw === "income" || tierRaw === "investment" ? tierRaw : "purchase";

  if (tier === "purchase" && !cat) {
    return res.status(400).json({ error: "cat is required for purchase transactions." });
  }

  try {
    const [existing] = await db<{ id: string }>`
      select id from transactions where id = ${id}
    `;
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

      // Rule creation is opt-in, same as the purchase path — only happens
      // when the user filled in the "if description contains ___" madlib.
      // No rule, no sibling touching otherwise: a single Income/Investment
      // label never silently applies to any other transaction.
      const tierContains = ruleContains?.trim();
      if (!tierContains) {
        return res.status(200).json({ ok: true });
      }

      const tierLabel = tier === "income" ? "Income" : "Investment";
      const ruleId = await createContainsRule(
        tierContains,
        tier,
        null,
        null,
        `Rule "${tierContains}" → ${tierLabel}`
      );

      // Every other still-uncategorized transaction whose description
      // matches now carries the rule as a suggested tier — it lands in the
      // inbox's "already matched" review section instead of being silently
      // re-tiered.
      const tierSiblingRows = await db<{ id: string }>`
        update transactions
        set matched_rule_id = ${ruleId}, updated_at = now()
        where tier is null and id != ${id} and description ilike ${"%" + tierContains + "%"}
        returning id
      `;

      return res.status(200).json({ ok: true, ruleCreated: true, siblingsFlagged: tierSiblingRows.length });
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

    // Rule creation is opt-in — only happens when the user explicitly filled
    // in the "if description contains ___" madlib while labeling. No rule
    // (and no sibling touching) otherwise, so regex_rules only grows for
    // merchants the user actually flags as repeating.
    const contains = ruleContains?.trim();
    if (!contains) {
      return res.status(200).json({ ok: true });
    }

    const ruleLabel = sub ? `Rule "${contains}" → ${cat} · ${sub}` : `Rule "${contains}" → ${cat}`;
    const ruleId = await createContainsRule(contains, "purchase", majorSlug, subcategoryId, ruleLabel);

    // Every other still-uncategorized transaction whose description matches
    // the new rule now carries it as a suggestion — it lands in the inbox's
    // "already matched" review section (Review all / Edit) rather than
    // being auto-applied.
    const siblingRows = await db<{ id: string }>`
      update transactions
      set matched_rule_id = ${ruleId}, updated_at = now()
      where tier is null and id != ${id} and description ilike ${"%" + contains + "%"}
      returning id
    `;

    return res.status(200).json({ ok: true, ruleCreated: true, siblingsFlagged: siblingRows.length });
  } catch (err) {
    console.error("categorize transaction error:", err);
    return res.status(500).json({ error: "Failed to categorize transaction." });
  }
}
