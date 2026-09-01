-- Major categories are now code constants (lib/category-defs.ts,
-- src/constants/categories.ts) — nothing to seed for them here.

-- Common recurring-transaction regexes (rent/electric/gas/wifi/uber), tied to
-- their default category by slug directly (majors aren't database rows
-- anymore, so no lookup is needed).
insert into regex_rules (pattern, category_slug, label)
values ('uber', 'transportation', 'Rule "uber" → Transportation')
on conflict do nothing;
