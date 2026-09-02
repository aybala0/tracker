import { db } from "./db.js";

export type RuleMatch = {
  ruleId: string;
  label: string;
};

/**
 * Tests a transaction description against every stored regex rule and
 * returns the first match, or null. Matched-rule transactions still land in
 * the uncategorized inbox (category/tier stay unset) — this only carries the
 * "Rule ... matched" hint the UI prefills when the user opens the row.
 */
export async function matchRegexRule(description: string): Promise<RuleMatch | null> {
  const rules = await db<{ id: string; pattern: string; label: string }>`
    select id, pattern, label from regex_rules
  `;

  for (const rule of rules) {
    let re: RegExp;
    try {
      re = new RegExp(rule.pattern, "i");
    } catch {
      continue; // invalid regex stored — skip rather than throw
    }
    if (re.test(description)) {
      return { ruleId: rule.id, label: rule.label };
    }
  }
  return null;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Creates (or updates) a regex rule from a plain "if description contains
 * ___" string the user typed while labeling a transaction — a deliberate,
 * opt-in action rather than something every categorization triggers. Kept
 * this way (instead of auto-learning a rule from every categorization) so
 * regex_rules only grows for merchants the user actually knows repeat, not
 * one row per one-off purchase. The text is escaped so it's matched
 * literally, as a plain substring — not compiled as real regex syntax, to
 * match the "madlib", no-regex-typing UI this is called from. Works for
 * both purchase rules (categorySlug set) and Income/Investment rules
 * (categorySlug/subcategoryId null, tier carries the whole suggestion).
 */
export async function createContainsRule(
  contains: string,
  tier: "income" | "purchase" | "investment",
  categorySlug: string | null,
  subcategoryId: string | null,
  label: string
): Promise<string> {
  const pattern = escapeRegExp(contains);
  const [row] = await db<{ id: string }>`
    insert into regex_rules (pattern, tier, category_slug, subcategory_id, label)
    values (${pattern}, ${tier}, ${categorySlug}, ${subcategoryId}, ${label})
    on conflict (pattern) do update
    set tier = excluded.tier, category_slug = excluded.category_slug, subcategory_id = excluded.subcategory_id, label = excluded.label
    returning id
  `;
  return row.id;
}

/**
 * Finds and tags credit-card-payment pairs: paying a card from checking
 * produces two real Plaid transactions — one on the credit account (debt
 * reduced, negative amount) and one on the checking account (money left,
 * positive amount). Two distinct real-world payment paths produce different
 * wording on both sides:
 *   - Manual (mobile/web) payment: credit side "Payment Thank You...",
 *     checking side "Payment to [Bank] card ending in ####" — typically
 *     posts 0-1 days apart.
 *   - Bank-initiated autopay: credit side often "AUTOMATIC PAYMENT - ..."
 *     (still contains "payment" + "thank"), checking side "[Bank] CREDIT
 *     CRD AUTOPAY PPD ID: ..." — settles slower, observed 3 days apart.
 * Neither side is real spending, so both get tagged `tier = 'transfer'`
 * (excluded from spend totals and the inbox, same mechanism as
 * income/investment) instead of asking to be categorized.
 *
 * The exact-amount match is the one non-negotiable requirement — it's what
 * makes a pair trustworthy even across loosely-matched description wording
 * and a several-day date gap. Deliberately conservative beyond that: only
 * touches transactions where BOTH sides of a pair are actually found; a
 * one-sided "Payment Thank You" with no real counterpart is left alone
 * rather than guessed at.
 */
export async function matchCardPaymentTransfers(): Promise<{ matched: number }> {
  const creditSide = await db<{ id: string; amount: string; date: string }>`
    select t.id, t.amount, to_char(t.date, 'YYYY-MM-DD') as date
    from transactions t
    join accounts a on a.id = t.account_id
    where t.tier is null
      and a.type = 'credit'
      and t.description ~* 'payment' and t.description ~* 'thank'
  `;

  let matched = 0;
  for (const credit of creditSide) {
    const [checking] = await db<{ id: string }>`
      select t.id
      from transactions t
      join accounts a on a.id = t.account_id
      where t.tier is null
        and a.type = 'depository'
        and (t.description ~* 'card ending in' or t.description ~* 'autopay')
        and t.amount = ${Math.abs(Number(credit.amount))}
        and abs(t.date - ${credit.date}::date) <= 5
      limit 1
    `;
    if (!checking) continue; // no confirmed counterpart — leave both alone

    await db`update transactions set tier = 'transfer', updated_at = now() where id = ${credit.id}`;
    await db`update transactions set tier = 'transfer', updated_at = now() where id = ${checking.id}`;
    matched += 2;
  }

  return { matched };
}
