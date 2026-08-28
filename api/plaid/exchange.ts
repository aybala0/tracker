import type { VercelRequest, VercelResponse } from "@vercel/node";
import { CountryCode } from "plaid";
import { plaidClient } from "../../lib/plaid.js";
import { db } from "../../lib/db.js";
import { requireAuth } from "../../lib/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!(await requireAuth(req, res))) return;

  const { publicToken } = req.body as { publicToken?: string };
  if (!publicToken) {
    return res.status(400).json({ error: "publicToken is required." });
  }

  try {
    const exchange = await plaidClient.itemPublicTokenExchange({ public_token: publicToken });
    const accessToken = exchange.data.access_token;
    const itemId = exchange.data.item_id;

    const itemResp = await plaidClient.itemGet({ access_token: accessToken });
    const institutionId = itemResp.data.item.institution_id;
    let institutionName: string | null = null;
    if (institutionId) {
      const inst = await plaidClient.institutionsGetById({
        institution_id: institutionId,
        country_codes: [CountryCode.Us],
      });
      institutionName = inst.data.institution.name;
    }

    const [item] = await db<{ id: string }>`
      insert into plaid_items (item_id, access_token, institution_name)
      values (${itemId}, ${accessToken}, ${institutionName})
      on conflict (item_id) do update set access_token = excluded.access_token
      returning id
    `;

    const accountsResp = await plaidClient.accountsGet({ access_token: accessToken });
    for (const a of accountsResp.data.accounts) {
      await db`
        insert into accounts (
          plaid_item_id, plaid_account_id, name, type, subtype, mask,
          current_balance, available_balance
        )
        values (
          ${item.id}, ${a.account_id}, ${a.name}, ${a.type}, ${a.subtype ?? null}, ${a.mask ?? null},
          ${a.balances.current ?? null}, ${a.balances.available ?? null}
        )
        on conflict (plaid_account_id) do update set
          current_balance = excluded.current_balance,
          available_balance = excluded.available_balance,
          updated_at = now()
      `;
    }

    return res.status(200).json({ ok: true, institutionName });
  } catch (err) {
    console.error("itemPublicTokenExchange error:", err);
    return res.status(500).json({ error: "Failed to link account." });
  }
}
