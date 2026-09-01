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
