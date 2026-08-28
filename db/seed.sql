-- Default categories. Colors must stay in sync with CAT_COLOR in
-- src/constants/categories.ts and lib/categories.ts — the color is the
-- consistent shorthand for a category across pie slices, chips, and tags.
insert into categories (name, color) values
  ('Food & Drinks', '#F2188F'),
  ('Rent & Bills', '#17BEBB'),
  ('Groceries', '#78C247'),
  ('Shopping', '#F2DC5D'),
  ('Home', '#2196F3'),
  ('Car', '#548C2F'),
  ('Fun', '#A259D9'),
  ('Transportation', '#FF7A1A'),
  ('Travel', '#0E7C9B'),
  ('Other', '#111111')
on conflict (parent_id, name) do nothing;

-- Common recurring-transaction regexes (rent/electric/gas/wifi/uber), tied to
-- their default category by name lookup so this can run right after the
-- category insert above.
insert into regex_rules (pattern, category_id, label)
select 'uber', id, 'Rule "uber" → Transportation'
from categories where name = 'Transportation' and parent_id is null
on conflict do nothing;
