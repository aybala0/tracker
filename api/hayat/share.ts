import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../../lib/db.js";
import { requireAuth } from "../../lib/auth.js";
import { getCategoryName } from "../../lib/categories.js";
import { appendRow } from "../../lib/sheets.js";
import { categoryNameToTag } from "../../lib/hayat-tags.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!(await requireAuth(req, res))) return;

  const { transactionId, description } = req.body as {
    transactionId?: string;
    description?: string;
  };
  if (!transactionId || !description) {
    return res.status(400).json({ error: "transactionId and description are required." });
  }

  try {
    const [txn] = await db<{
      id: string;
      date: string;
      amount: string;
      category_id: string | null;
    }>`
      select id, to_char(date, 'YYYY-MM-DD') as date, amount, category_id
      from transactions where id = ${transactionId}
    `;
    if (!txn) {
      return res.status(404).json({ error: "Transaction not found." });
    }

    let categoryName = "Other";
    if (txn.category_id) {
      const { name, parentName } = await getCategoryName(txn.category_id);
      categoryName = parentName ?? name;
    }
    const tag = categoryNameToTag(categoryName);

    const amount = Number(txn.amount);
    const half = Math.round((amount / 2) * 100) / 100;

    await appendRow({
      date: txn.date,
      description,
      tag,
      amount,
      paidBy: "Aybala",
      aylasShare: half,
      erdemsShare: half,
      notes: `ft:${transactionId}`,
    });

    await db`
      update transactions
      set is_shared = true, shared_amount = ${half}, hayat_logged = true, updated_at = now()
      where id = ${transactionId}
    `;

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("hayat share error:", err);
    return res.status(500).json({ error: "Failed to share expense with Hayat." });
  }
}
