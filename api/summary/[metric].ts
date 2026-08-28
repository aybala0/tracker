import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../../lib/db.js";
import { requireAuth } from "../../lib/auth.js";
import { getRows } from "../../lib/sheets.js";
import { fmtDayMonth } from "../../lib/format-date.js";

// Consolidated into one dynamic route ([metric].ts handles net-worth,
// categories, month, drill) to stay under Vercel Hobby's 12-Serverless-
// Function-per-deployment cap — this file alone counts as one function
// instead of four. URLs the frontend calls are unchanged: Vercel matches
// `/api/summary/net-worth` etc. against this dynamic segment literally.

/**
 * Hayat balance from Aybala's fixed perspective, ported exactly from hayat's
 * own computeBalance formula (hayat/lib/sheets.ts): when Aybala paid, the
 * amount owed to her is Erdem's share; when Erdem paid, the amount she owes
 * is her own share.
 */
async function computeHayatBalance(): Promise<number> {
  const rows = await getRows();
  let balance = 0;
  for (const row of rows) {
    if (!row.date) continue; // blank trailing row
    if (row.paidBy === "Aybala") {
      balance += row.erdemsShare;
    } else {
      balance -= row.aylasShare;
    }
  }
  return Math.round(balance * 100) / 100;
}

async function netWorth(res: VercelResponse) {
  const [row] = await db<{ checking: string | null; cards_owed: string | null }>`
    select
      (select coalesce(sum(current_balance), 0) from accounts where type = 'depository') as checking,
      (select coalesce(sum(current_balance), 0) from accounts where type = 'credit') as cards_owed
  `;

  const checking = Number(row?.checking ?? 0);
  const cardsOwed = Number(row?.cards_owed ?? 0);
  const cards = -cardsOwed;
  const hayatBalance = await computeHayatBalance();
  const net = checking - cardsOwed + hayatBalance;

  return res.status(200).json({ net, checking, cards, hayatBalance });
}

async function categoriesSummary(req: VercelRequest, res: VercelResponse) {
  const { month } = req.query as { month?: string };
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: "month is required in YYYY-MM format." });
  }

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
}

async function drill(req: VercelRequest, res: VercelResponse) {
  const { month, category } = req.query as { month?: string; category?: string };
  if (!month || !/^\d{4}-\d{2}$/.test(month) || !category) {
    return res.status(400).json({ error: "month (YYYY-MM) and category are required." });
  }

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
}

function daysInMonth(year: number, month0: number): number {
  // month0 is 0-indexed; day 0 of the next month = last day of this month.
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function dateStr(year: number, month0: number, day: number): string {
  return `${year}-${pad(month0 + 1)}-${pad(day)}`;
}

async function monthSummary(res: VercelResponse) {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month0 = now.getUTCMonth(); // 0-indexed
  const dayOfMonth = now.getUTCDate();
  const daysInCurrentMonth = daysInMonth(year, month0);

  const monthStart = dateStr(year, month0, 1);
  const todayStr = dateStr(year, month0, dayOfMonth);

  const [thisMonthRow] = await db<{ total: string | null }>`
    select sum(amount) as total
    from transactions
    where tier = 'purchase' and date >= ${monthStart} and date <= ${todayStr}
  `;
  const thisMonth = Math.abs(Number(thisMonthRow?.total ?? 0));

  const priorSums: number[] = [];
  for (let i = 1; i <= 3; i++) {
    let targetYear = year;
    let targetMonth0 = month0 - i;
    while (targetMonth0 < 0) {
      targetMonth0 += 12;
      targetYear -= 1;
    }
    const daysInThatMonth = daysInMonth(targetYear, targetMonth0);
    const equivalentDay = Math.min(
      daysInThatMonth,
      Math.max(1, Math.round((dayOfMonth / daysInCurrentMonth) * daysInThatMonth))
    );
    const start = dateStr(targetYear, targetMonth0, 1);
    const end = dateStr(targetYear, targetMonth0, equivalentDay);

    const [row] = await db<{ total: string | null; cnt: string }>`
      select sum(amount) as total, count(*) as cnt
      from transactions
      where tier = 'purchase' and date >= ${start} and date <= ${end}
    `;
    const cnt = Number(row?.cnt ?? 0);
    if (cnt > 0) {
      priorSums.push(Math.abs(Number(row?.total ?? 0)));
    }
  }

  const average = priorSums.length > 0
    ? priorSums.reduce((a, b) => a + b, 0) / priorSums.length
    : thisMonth;

  const percentBelow = average > 0 ? Math.round((1 - thisMonth / average) * 100) : 0;
  const fillPct = average > 0 ? Math.min(100, Math.max(0, (thisMonth / average) * 100)) : 0;
  const avgLinePct = (dayOfMonth / daysInCurrentMonth) * 100;

  return res.status(200).json({ thisMonth, average, percentBelow, dayOfMonth, fillPct, avgLinePct });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!(await requireAuth(req, res))) return;

  const { metric } = req.query as { metric?: string };

  try {
    switch (metric) {
      case "net-worth":
        return await netWorth(res);
      case "categories":
        return await categoriesSummary(req, res);
      case "drill":
        return await drill(req, res);
      case "month":
        return await monthSummary(res);
      default:
        return res.status(404).json({ error: "Unknown summary metric." });
    }
  } catch (err) {
    console.error(`summary/${metric} error:`, err);
    return res.status(500).json({ error: "Failed to fetch summary." });
  }
}
