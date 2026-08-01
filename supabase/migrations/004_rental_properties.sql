-- ============================================================
-- Rental properties and their FY-scoped income/expense ledger.
-- Safe to re-run on Neon or Supabase.
-- ============================================================

create table if not exists rental_properties (
  id uuid primary key,
  user_id uuid not null,
  address text not null,
  ownership_percent numeric not null default 100,
  acquired_date text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists rental_transactions (
  id uuid primary key,
  user_id uuid not null,
  property_id uuid not null references rental_properties(id) on delete cascade,
  date text not null,
  kind text not null, -- 'income' | 'expense'
  category text not null,
  description text not null,
  amount numeric not null default 0,
  deductible_percent numeric not null default 100,
  financial_year text not null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists rental_properties_user
  on rental_properties (user_id);

create index if not exists rental_transactions_user_fy_date
  on rental_transactions (user_id, financial_year, date);

create index if not exists rental_transactions_property
  on rental_transactions (property_id);

-- Supabase has an auth schema; Neon does not. Add RLS only where auth.uid()
-- exists so this migration remains portable across both supported backends.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'auth') then
    alter table rental_properties enable row level security;
    alter table rental_transactions enable row level security;

    if not exists (
      select 1 from pg_policies
      where tablename = 'rental_properties'
        and policyname = 'Users manage own rental properties'
    ) then
      create policy "Users manage own rental properties"
        on rental_properties for all
        using (auth.uid() = user_id)
        with check (auth.uid() = user_id);
    end if;

    if not exists (
      select 1 from pg_policies
      where tablename = 'rental_transactions'
        and policyname = 'Users manage own rental transactions'
    ) then
      create policy "Users manage own rental transactions"
        on rental_transactions for all
        using (auth.uid() = user_id)
        with check (auth.uid() = user_id);
    end if;
  end if;
end $$;
