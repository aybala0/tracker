import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../../lib/db.js";
import { requireAuth } from "../../lib/auth.js";
import { fmtDayMonth } from "../../lib/format-date.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!(await requireAuth(req, res))) return;

  const { month, category } = req.query as { month?: string; category?: string };
  if (!month || !/^\d{4}-\d{2}$/.test(month) || !category) {
    return res.status(400).json({ error: "month (YYYY-MM) and category are required." });
  }

  try {
    const rows = await db<{
      id: string;
      description: string;
      amount: string;
      date: string;
      is_shared: boolean;
      tag_name: string;
    }>`
      select
        t.id, t.description,
        case when t.is_shared then coalesce(t.shared_amount, t.amount) else t.amount end as amount,
        to_char(t.date, 'YYYY-MM-DD') as date, t.is_shared, cat.name as tag_name
      from transactions t
      join categories cat on cat.id = t.category_id
      left join categories parent on cat.parent_id = parent.id
      where t.tier = 'purchase'
        and to_char(t.date, 'YYYY-MM') = ${month}
        and (cat.name = ${category} or parent.name = ${category})
      order by t.date asc
    `;

    const result = rows.map((r) => ({
      id: r.id,
      desc: r.description,
      tag: r.tag_name,
      amt: Math.abs(Number(r.amount)),
      date: fmtDayMonth(r.date),
      shared: r.is_shared,
    }));

    return res.status(200).json(result);
  } catch (err) {
    console.error("summary drill error:", err);
    return res.status(500).json({ error: "Failed to fetch drill-down transactions." });
  }
}
