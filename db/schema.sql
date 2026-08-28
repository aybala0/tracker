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
create index if not exists transactions_category_id_idx on transactions(category_id);
-- Uncategorized inbox is the hot query: tier is null until the user labels it.
create index if not exists transactions_uncategorized_idx on transactions(date) where tier is null;
