import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAuth } from "../../lib/auth.js";
import { importOrders, matchAmazonOrders, type NewAmazonOrder } from "../../lib/amazon-match.js";

/**
 * Receives Amazon order history scraped locally (scripts/amazon_sync.py) —
 * Amazon has no order API, and the scraper needs a real login/2FA session
 * that can't run inside a Vercel serverless function, so this is a manual
 * push endpoint rather than something the daily cron calls.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!(await requireAuth(req, res))) return;

  const { orders } = req.body as { orders?: NewAmazonOrder[] };
  if (!Array.isArray(orders) || orders.length === 0) {
    return res.status(400).json({ error: "orders (non-empty array) is required." });
  }

  try {
    const imported = await importOrders(orders);
    const { matched, itemsCreated, skipped } = await matchAmazonOrders();
    return res.status(200).json({ ok: true, imported, matched, itemsCreated, skipped });
  } catch (err) {
    console.error("amazon import-orders error:", err);
    return res.status(500).json({ error: "Failed to import Amazon orders." });
  }
}
