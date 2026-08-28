import type { VercelRequest, VercelResponse } from "@vercel/node";
import { CountryCode, Products } from "plaid";
import { plaidClient } from "../../lib/plaid.js";
import { requireAuth } from "../../lib/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!(await requireAuth(req, res))) return;

  try {
    const response = await plaidClient.linkTokenCreate({
      // Single-user app — one fixed client_user_id is fine.
      user: { client_user_id: "finance-tracker-owner" },
      client_name: "Finance Tracker",
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: "en",
    });
    return res.status(200).json({ linkToken: response.data.link_token });
  } catch (err) {
    console.error("linkTokenCreate error:", err);
    return res.status(500).json({ error: "Failed to create link token." });
  }
}
