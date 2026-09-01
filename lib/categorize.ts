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

export type PriorCategorization = {
  tier: "income" | "purchase" | "investment";
  categorySlug: string | null;
  subcategoryId: string | null;
};

/**
 * Looks up how the same exact transaction description was categorized last
 * time it appeared, so a new transaction can skip the inbox entirely instead
 * of asking again. Auto-applied silently on ingest — no confirmation step;
 * a mistaken match gets fixed later via the categorization review section.
 */
export async function findPriorCategorization(description: string): Promise<PriorCategorization | null> {
  const [row] = await db<{
    tier: "income" | "purchase" | "investment";
    category_slug: string | null;
    subcategory_id: string | null;
  }>`
    select tier, category_slug, subcategory_id
    from transactions
    where description = ${description} and tier is not null
    order by updated_at desc
    limit 1
  `;
  if (!row) return null;
  return { tier: row.tier, categorySlug: row.category_slug, subcategoryId: row.subcategory_id };
}

/**
 * Finds and tags credit-card-payment pairs: paying a card from checking
 * produces two real Plaid transactions — one on the credit account
 * ("Payment Thank You...", negative = debt reduced) and one on the checking
 * account ("Payment to [Bank] card ending in ####", positive = money left
 * checking) — for the exact same amount, usually the same day or one day
 * apart. Neither side is real spending, so both get tagged `tier =
 * 'transfer'` (excluded from spend totals and the inbox, same mechanism as
 * income/investment) instead of asking to be categorized.
 *
 * Deliberately conservative: only touches transactions where BOTH sides of
 * a pair are found by description pattern + exact matching amount + a tight
 * date window — a one-sided "Payment Thank You" (e.g. a bank-initiated
 * autopay with no separate checking-side transaction) is left alone rather
 * than guessed at.
 */
export async function matchCardPaymentTransfers(): Promise<{ matched: number }> {
  const creditSide = await db<{ id: string; amount: string; date: string }>`
    select t.id, t.amount, to_char(t.date, 'YYYY-MM-DD') as date
    from transactions t
    join accounts a on a.id = t.account_id
    where t.tier is null
      and a.type = 'credit'
      and t.description ~* '^payment thank you'
  `;

  let matched = 0;
  for (const credit of creditSide) {
    const [checking] = await db<{ id: string }>`
      select t.id
      from transactions t
      join accounts a on a.id = t.account_id
      where t.tier is null
        and a.type = 'depository'
        and t.description ~* '^payment to .* card ending in'
        and t.amount = ${Math.abs(Number(credit.amount))}
        and abs(t.date - ${credit.date}::date) <= 2
      limit 1
    `;
    if (!checking) continue; // no confirmed counterpart — leave both alone

    await db`update transactions set tier = 'transfer', updated_at = now() where id = ${credit.id}`;
    await db`update transactions set tier = 'transfer', updated_at = now() where id = ${checking.id}`;
    matched += 2;
  }

  return { matched };
}
