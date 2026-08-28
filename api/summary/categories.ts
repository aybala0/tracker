import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../../lib/db.js";
import { requireAuth } from "../../lib/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!(await requireAuth(req, res))) return;

  const { month } = req.query as { month?: string };
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: "month is required in YYYY-MM format." });
  }

  try {
    const rows = await db<{ name: string; total: string }>`
      select
        coalesce(parent.name, cat.name) as name,
        sum(case when t.is_shared then coalesce(t.shared_amount, t.amount) else t.amount end) as total
      from transactions t
      join categories cat on cat.id = t.category_id
      left join categories parent on cat.parent_id = parent.id
      where t.tier = 'purchase'
        and to_char(t.date, 'YYYY-MM') = ${month}
      group by coalesce(parent.name, cat.name)
    `;

    const result: Record<string, number> = {};
    for (const r of rows) {
      result[r.name] = Math.abs(Number(r.total));
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error("summary categories error:", err);
    return res.status(500).json({ error: "Failed to fetch category summary." });
  }
}
