import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../../lib/db.js";
import { requireAuth } from "../../lib/auth.js";
import { getSubcategoryInfo } from "../../lib/categories.js";
import { getMajorName } from "../../lib/category-defs.js";
import { fmtDayMonth } from "../../lib/format-date.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!(await requireAuth(req, res))) return;

  try {
    const rows = await db<{
      id: string;
      date: string;
      description: string;
      amount: string;
      matched_rule_id: string | null;
      rule_label: string | null;
      rule_category_slug: string | null;
      rule_subcategory_id: string | null;
    }>`
      select t.id, to_char(t.date, 'YYYY-MM-DD') as date, t.description, t.amount, t.matched_rule_id,
             r.label as rule_label, r.category_slug as rule_category_slug, r.subcategory_id as rule_subcategory_id
      from transactions t
      left join regex_rules r on r.id = t.matched_rule_id
      where t.tier is null
      order by t.date asc
    `;

    const result = await Promise.all(
      rows.map(async (row) => {
        let cat: string | undefined;
        let sub: string | undefined;
        if (row.matched_rule_id && row.rule_category_slug) {
          cat = getMajorName(row.rule_category_slug) ?? undefined;
          if (row.rule_subcategory_id) {
            const subInfo = await getSubcategoryInfo(row.rule_subcategory_id);
            sub = subInfo?.name;
          }
        }
        return {
          id: row.id,
          date: fmtDayMonth(row.date),
          desc: row.description,
          amt: Number(row.amount),
          rule: row.matched_rule_id ? row.rule_label : null,
          cat,
          sub,
        };
      })
    );

    return res.status(200).json(result);
  } catch (err) {
    console.error("transactions inbox error:", err);
    return res.status(500).json({ error: "Failed to fetch inbox." });
  }
}
