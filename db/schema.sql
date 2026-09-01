-- Finance tracker schema. Run against Vercel Postgres (Neon) via `npm run db:migrate`.

create table if not exists plaid_items (
  id uuid primary key default gen_random_uuid(),
  item_id text not null unique,
  -- Plaid access token for this item. Sensitive — never returned by any API route.
  access_token text not null,
  institution_name text,
  created_at timestamptz not null default now()
);
-- Cursor for Plaid's /transactions/sync, so each sync only pulls what changed.
-- Separate ALTER (not inline on the CREATE above) so this file stays safe to
-- re-run against a database that already has the table.
alter table plaid_items add column if not exists cursor text;
-- Drives the Home screen's real "Synced Xm ago" indicator.
alter table plaid_items add column if not exists last_synced_at timestamptz;

create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  plaid_item_id uuid not null references plaid_items(id) on delete cascade,
  plaid_account_id text not null unique,
  name text not null,
  -- Plaid account type, e.g. 'depository' or 'credit'. Drives the net-worth sign.
  type text not null,
  subtype text,
  mask text,
  current_balance numeric(12, 2),
  available_balance numeric(12, 2),
  updated_at timestamptz not null default now()
);

-- Self-referential: parent_id null = a default/major category (has its own color
-- and pie slice). parent_id set = a subcategory, inherits the parent's color.
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  parent_id uuid references categories(id) on delete cascade,
  -- Hex color. Only set on major categories (parent_id is null); subcategories
  -- look up their parent's color at read time.
  color text,
  created_at timestamptz not null default now(),
  unique (parent_id, name)
);
create index if not exists categories_parent_id_idx on categories(parent_id);

create table if not exists regex_rules (
  id uuid primary key default gen_random_uuid(),
  -- Matched against the transaction description (case-insensitive).
  pattern text not null unique,
  category_id uuid not null references categories(id) on delete cascade,
  tier text not null default 'purchase' check (tier in ('income', 'purchase', 'investment')),
  -- Shown to the user as the "Rule ... matched" hint, e.g. `uber` → "Rule “uber” → Transportation · Uber".
  label text not null,
  created_at timestamptz not null default now()
);

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  plaid_transaction_id text not null unique,
  plaid_item_id uuid not null references plaid_items(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  date date not null,
  description text not null,
  amount numeric(12, 2) not null,
  tier text check (tier in ('income', 'purchase', 'investment')),
  category_id uuid references categories(id),
  is_shared boolean not null default false,
  hayat_logged boolean not null default false,
  matched_rule_id uuid references regex_rules(id),
  -- Full Plaid transaction payload, kept for fields we don't model yet.
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists transactions_date_idx on transactions(date);
-- transactions_category_id_idx (on the now-retired category_id column) is
-- deliberately not created here anymore: category_id is dropped later in
-- this same file, and re-running this file against a database where that
-- drop already happened would fail trying to index a nonexistent column
-- (transactions already exists at that point, so `create table if not
-- exists` above is a no-op and doesn't recreate category_id). Postgres
-- drops the index automatically along with the column on a fresh apply.
-- Uncategorized inbox is the hot query: tier is null until the user labels it.
create index if not exists transactions_uncategorized_idx on transactions(date) where tier is null;

-- Hayat integration: rows can now originate from the shared expense sheet
-- instead of Plaid (synthetic transactions for expenses Erdem paid, or
-- expenses Aybala paid in cash/before Plaid's sync window).
alter table transactions add column if not exists source text not null default 'plaid' check (source in ('plaid', 'hayat'));
-- Aybala's specific share of a shared expense — what should count toward her
-- spending totals. Only meaningful when is_shared is true.
alter table transactions add column if not exists shared_amount numeric(12, 2);
-- Hayat-sourced rows have no real Plaid account behind them.
alter table transactions alter column account_id drop not null;
alter table transactions alter column plaid_item_id drop not null;
alter table transactions drop constraint if exists transactions_source_requires_account;
alter table transactions add constraint transactions_source_requires_account
  check (source = 'hayat' or (account_id is not null and plaid_item_id is not null));

-- Categories are now: majors live in code (src/constants/categories.ts,
-- lib/category-defs.ts), only subcategories are database rows.
create table if not exists subcategories (
  id uuid primary key default gen_random_uuid(),
  parent_slug text not null,
  name text not null,
  created_at timestamptz not null default now(),
  unique (parent_slug, name)
);

alter table transactions add column if not exists category_slug text;
alter table transactions add column if not exists subcategory_id uuid references subcategories(id);

alter table regex_rules add column if not exists category_slug text;
alter table regex_rules add column if not exists subcategory_id uuid references subcategories(id);

-- One-time data migration (db/migrate-categories.ts) moved every transaction
-- and regex_rule off the old categories table onto category_slug/
-- subcategory_id above before these final statements were run for real.
alter table transactions drop column if exists category_id;
alter table regex_rules drop column if exists category_id;
drop table if exists categories;

-- 'transfer' = an internal movement (e.g. a credit card payment appearing on
-- both the credit account and the checking account it was paid from) —
-- excluded from spend totals and the inbox the same way income/investment
-- are, but assigned programmatically, never chosen through the UI.
alter table transactions drop constraint if exists transactions_tier_check;
alter table transactions add constraint transactions_tier_check
  check (tier in ('income', 'purchase', 'investment', 'transfer'));
