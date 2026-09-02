import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../../lib/db.js";
import { requireAuth } from "../../lib/auth.js";
import { getSubcategoryInfo } from "../../lib/categories.js";
import { getMajorName } from "../../lib/category-defs.js";
import { appendRow, deleteRowByTransactionId } from "../../lib/sheets.js";
import { categoryNameToTag } from "../../lib/hayat-tags.js";

/**
 * Undoes a mistaken "Shared?" tap: clears the transaction's shared flags and
 * removes the row this endpoint's POST wrote to the Hayat sheet (matched by
 * the `ft:{transactionId}` marker in Notes). A `source = 'hayat'` row has no
 * real Plaid transaction behind it — it only exists to carry the share, so
 * once unshared it's deleted outright instead of left as an empty purchase.
 */
async function unshare(req: VercelRequest, res: VercelResponse) {
  const { transactionId } = req.body as { transactionId?: string };
  if (!transactionId) {
    return res.status(400).json({ error: "transactionId is required." });
  }

  const [txn] = await db<{ id: string; is_shared: boolean; source: string }>`
    select id, is_shared, source from transactions where id = ${transactionId}
  `;
  if (!txn) {
    return res.status(404).json({ error: "Transaction not found." });
  }
  if (!txn.is_shared) {
    return res.status(400).json({ error: "Transaction is not marked shared." });
  }

  if (txn.source === "hayat") {
    await db`delete from transactions where id = ${transactionId}`;
  } else {
    await db`
      update transactions
      set is_shared = false, shared_amount = null, hayat_logged = false, updated_at = now()
      where id = ${transactionId}
    `;
  }

  const sheetRowRemoved = await deleteRowByTransactionId(transactionId);
  return res.status(200).json({ ok: true, sheetRowRemoved });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "DELETE") {
    if (!(await requireAuth(req, res))) return;
    try {
      return await unshare(req, res);
    } catch (err) {
      console.error("hayat unshare error:", err);
      return res.status(500).json({ error: "Failed to unshare expense." });
    }
  }

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
      category_slug: string | null;
      subcategory_id: string | null;
    }>`
      select id, to_char(date, 'YYYY-MM-DD') as date, amount, category_slug, subcategory_id
      from transactions where id = ${transactionId}
    `;
    if (!txn) {
      return res.status(404).json({ error: "Transaction not found." });
    }

    let categoryName = "Other";
    if (txn.subcategory_id) {
      const subInfo = await getSubcategoryInfo(txn.subcategory_id);
      if (subInfo) categoryName = getMajorName(subInfo.parentSlug) ?? categoryName;
    } else if (txn.category_slug) {
      categoryName = getMajorName(txn.category_slug) ?? categoryName;
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
