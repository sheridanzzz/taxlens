-- ============================================================
-- Capital gains: crypto and share trades.
-- Holdings, parcels and gains are all derived from these rows —
-- there is no holdings table to keep in sync.
-- Safe to re-run.
-- ============================================================

create table if not exists cgt_transactions (
  id uuid primary key,
  user_id uuid not null,
  kind text not null,               -- 'crypto' | 'share'
  asset text not null,              -- ticker, uppercased
  side text not null,               -- 'buy' | 'sell'
  date text not null,
  quantity numeric not null default 0,
  unit_price numeric not null default 0,
  fee numeric not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

-- FIFO matching always reads a user's whole history for one asset
create index if not exists cgt_transactions_user_asset_date
  on cgt_transactions (user_id, asset, date);
