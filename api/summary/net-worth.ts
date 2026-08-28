import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../../lib/db.js";
import { requireAuth } from "../../lib/auth.js";
import { getRows } from "../../lib/sheets.js";

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!(await requireAuth(req, res))) return;

  try {
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
  } catch (err) {
    console.error("net-worth error:", err);
    return res.status(500).json({ error: "Failed to fetch net worth." });
  }
}
