// ONE-TIME data migration: moves the old `categories` table (majors as
// duplicated rows + genuine subcategory rows) onto the new slug-based model
// (majors as code constants, subcategories in a slimmer `subcategories`
// table). Run once manually:
//
//   node --env-file=.env --import tsx db/migrate-categories.ts
//
// Not folded into db/migrate.ts / schema.sql / seed.sql — this is a one-shot
// data transform against a specific historical state, not a repeatable
// schema apply. schema.sql already carries the final `drop table categories`
// etc. for a fresh database; this script is what gets a database that still
// has real data from the old shape to that same end state, without losing
// anything.
import { Client } from "pg";
import { MAJOR_CATEGORIES } from "../lib/category-defs.js";

function resolveSlug(name: string): string | null {
  return MAJOR_CATEGORIES.find((c) => c.name === name)?.slug ?? null;
}

async function main() {
  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) throw new Error("POSTGRES_URL is not set (check .env)");

  const client = new Client({ connectionString });
  await client.connect();

  try {
    // --- Preconditions: the new columns must already exist (schema.sql's
    // `alter table ... add column if not exists` statements applied), and
    // the old `categories` table must still exist (not yet dropped). ---
    const catsExist = await client.query(`select to_regclass('categories') as t`);
    if (!catsExist.rows[0].t) {
      console.log("categories table doesn't exist — migration already ran (or fresh db). Nothing to do.");
      return;
    }

    const colCheck = await client.query(`
      select column_name from information_schema.columns
      where table_name = 'transactions' and column_name in ('category_slug', 'subcategory_id')
    `);
    if (colCheck.rows.length < 2) {
      throw new Error("transactions.category_slug/subcategory_id columns are missing — apply schema.sql first.");
    }

    // --- Baseline counts, for the before/after verification at the end. ---
    const [{ count: baselineTxnCount }] = (
      await client.query(`select count(*) from transactions where category_id is not null`)
    ).rows;
    const [{ count: baselineRuleCount }] = (
      await client.query(`select count(*) from regex_rules where category_id is not null`)
    ).rows;
    console.log(`Baseline: ${baselineTxnCount} transactions with category_id, ${baselineRuleCount} regex_rules with category_id.`);

    // --- Step 1-3: majors (parent_id is null), possibly duplicated by name. ---
    const majors = (await client.query(`select id, name from categories where parent_id is null`)).rows as {
      id: string;
      name: string;
    }[];

    const majorNameToIds = new Map<string, string[]>();
    for (const m of majors) {
      const list = majorNameToIds.get(m.name) ?? [];
      list.push(m.id);
      majorNameToIds.set(m.name, list);
    }

    for (const [name, ids] of majorNameToIds) {
      const slug = resolveSlug(name);
      if (!slug) {
        throw new Error(
          `STOP: major category name "${name}" (ids: ${ids.join(", ")}) does not match any of the 10 fixed slugs. Refusing to guess.`
        );
      }
      for (const id of ids) {
        const txnRes = await client.query(`update transactions set category_slug = $1 where category_id = $2`, [
          slug,
          id,
        ]);
        const ruleRes = await client.query(`update regex_rules set category_slug = $1 where category_id = $2`, [
          slug,
          id,
        ]);
        console.log(
          `Major "${name}" (old id ${id}) -> slug "${slug}": ${txnRes.rowCount} transactions, ${ruleRes.rowCount} regex_rules updated.`
        );
      }
    }

    // --- Step 4: subcategories (parent_id is not null). ---
    const subs = (await client.query(`
      select c.id, c.name, p.name as parent_name
      from categories c
      join categories p on c.parent_id = p.id
      where c.parent_id is not null
    `)).rows as { id: string; name: string; parent_name: string }[];

    for (const sub of subs) {
      const parentSlug = resolveSlug(sub.parent_name);
      if (!parentSlug) {
        throw new Error(
          `STOP: subcategory "${sub.name}" has parent name "${sub.parent_name}" which does not match any of the 10 fixed slugs. Refusing to guess.`
        );
      }

      const [{ id: newSubId }] = (
        await client.query(
          `insert into subcategories (parent_slug, name) values ($1, $2)
           on conflict (parent_slug, name) do update set name = excluded.name
           returning id`,
          [parentSlug, sub.name]
        )
      ).rows;

      const txnRes = await client.query(`update transactions set subcategory_id = $1 where category_id = $2`, [
        newSubId,
        sub.id,
      ]);
      const ruleRes = await client.query(`update regex_rules set subcategory_id = $1 where category_id = $2`, [
        newSubId,
        sub.id,
      ]);
      console.log(
        `Subcategory "${sub.name}" (parent "${sub.parent_name}", old id ${sub.id}) -> new id ${newSubId}: ${txnRes.rowCount} transactions, ${ruleRes.rowCount} regex_rules updated.`
      );
    }

    // --- Step 5: verify. ---
    const [{ count: afterTxnCount }] = (
      await client.query(`select count(*) from transactions where category_slug is not null`)
    ).rows;
    const [{ count: afterRuleCount }] = (
      await client.query(`select count(*) from regex_rules where category_slug is not null`)
    ).rows;

    console.log(`After: ${afterTxnCount} transactions with category_slug, ${afterRuleCount} regex_rules with category_slug.`);

    if (Number(afterTxnCount) !== Number(baselineTxnCount)) {
      throw new Error(
        `VERIFICATION FAILED: transaction count mismatch. Before: ${baselineTxnCount}, after: ${afterTxnCount}. Not dropping old columns/table.`
      );
    }
    if (Number(afterRuleCount) !== Number(baselineRuleCount)) {
      throw new Error(
        `VERIFICATION FAILED: regex_rules count mismatch. Before: ${baselineRuleCount}, after: ${afterRuleCount}. Not dropping old columns/table.`
      );
    }

    console.log("Verification passed. Dropping old category_id columns and categories table...");

    await client.query(`alter table transactions drop column if exists category_id`);
    await client.query(`alter table regex_rules drop column if exists category_id`);
    await client.query(`drop table if exists categories`);

    const droppedCheck = await client.query(`select to_regclass('categories') as t`);
    console.log(`categories table now: ${droppedCheck.rows[0].t === null ? "dropped (null)" : "STILL EXISTS — something went wrong"}`);

    console.log("Migration complete.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
