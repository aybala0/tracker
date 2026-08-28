import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../../lib/db.js";
import { requireAuth } from "../../lib/auth.js";

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!(await requireAuth(req, res))) return;

  try {
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

    return res.status(200).json({
      thisMonth,
      average,
      percentBelow,
      dayOfMonth,
      fillPct,
      avgLinePct,
    });
  } catch (err) {
    console.error("summary month error:", err);
    return res.status(500).json({ error: "Failed to fetch month summary." });
  }
}
