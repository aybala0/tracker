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
