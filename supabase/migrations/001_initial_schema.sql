-- ============================================================
-- TaxLens Database Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- Expenses table
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date text not null,
  description text not null,
  amount numeric not null default 0,
  category text not null,
  claim_type text not null default 'full',
  work_use_percent numeric not null default 100,
  claimable_amount numeric not null default 0,
  receipt_data_url text,
  notes text,
  financial_year text not null,
  created_at timestamptz not null default now()
);

-- Depreciating assets table
create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  asset_type text not null,
  purchase_date text not null,
  purchase_price numeric not null default 0,
  effective_life_years numeric not null,
  depreciation_method text not null default 'diminishing',
  work_use_percent numeric not null default 100,
  financial_year text not null,
  created_at timestamptz not null default now()
);

-- WFH entries table
create table if not exists public.wfh_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date text not null,
  hours numeric not null default 0,
  financial_year text not null
);

-- WFH actual costs table
create table if not exists public.wfh_actual_costs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  annual_cost numeric not null default 0,
  work_use_percent numeric not null default 100,
  financial_year text not null
);

-- User settings table
create table if not exists public.user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null references auth.users(id) on delete cascade,
  financial_year text not null default '2025-26',
  annual_income numeric not null default 0,
  occupation text not null default '',
  tax_resident_status text not null default 'resident',
  default_work_use_percent numeric not null default 100,
  wfh_method text not null default 'fixed_rate',
  depreciation_method text not null default 'diminishing'
);

-- ============================================================
-- Row Level Security (users can only access their own data)
-- ============================================================

alter table public.expenses enable row level security;
alter table public.assets enable row level security;
alter table public.wfh_entries enable row level security;
alter table public.wfh_actual_costs enable row level security;
alter table public.user_settings enable row level security;

-- Expenses policies
create policy "Users can view own expenses" on public.expenses
  for select using (auth.uid() = user_id);
create policy "Users can insert own expenses" on public.expenses
  for insert with check (auth.uid() = user_id);
create policy "Users can update own expenses" on public.expenses
  for update using (auth.uid() = user_id);
create policy "Users can delete own expenses" on public.expenses
  for delete using (auth.uid() = user_id);

-- Assets policies
create policy "Users can view own assets" on public.assets
  for select using (auth.uid() = user_id);
create policy "Users can insert own assets" on public.assets
  for insert with check (auth.uid() = user_id);
create policy "Users can update own assets" on public.assets
  for update using (auth.uid() = user_id);
create policy "Users can delete own assets" on public.assets
  for delete using (auth.uid() = user_id);

-- WFH entries policies
create policy "Users can view own wfh entries" on public.wfh_entries
  for select using (auth.uid() = user_id);
create policy "Users can insert own wfh entries" on public.wfh_entries
  for insert with check (auth.uid() = user_id);
create policy "Users can update own wfh entries" on public.wfh_entries
  for update using (auth.uid() = user_id);
create policy "Users can delete own wfh entries" on public.wfh_entries
  for delete using (auth.uid() = user_id);

-- WFH actual costs policies
create policy "Users can view own wfh actual costs" on public.wfh_actual_costs
  for select using (auth.uid() = user_id);
create policy "Users can insert own wfh actual costs" on public.wfh_actual_costs
  for insert with check (auth.uid() = user_id);
create policy "Users can update own wfh actual costs" on public.wfh_actual_costs
  for update using (auth.uid() = user_id);
create policy "Users can delete own wfh actual costs" on public.wfh_actual_costs
  for delete using (auth.uid() = user_id);

-- User settings policies
create policy "Users can view own settings" on public.user_settings
  for select using (auth.uid() = user_id);
create policy "Users can insert own settings" on public.user_settings
  for insert with check (auth.uid() = user_id);
create policy "Users can update own settings" on public.user_settings
  for update using (auth.uid() = user_id);
create policy "Users can delete own settings" on public.user_settings
  for delete using (auth.uid() = user_id);

-- Indexes for performance
create index if not exists idx_expenses_user_fy on public.expenses(user_id, financial_year);
create index if not exists idx_assets_user_fy on public.assets(user_id, financial_year);
create index if not exists idx_wfh_entries_user_fy on public.wfh_entries(user_id, financial_year);
create index if not exists idx_wfh_actual_costs_user_fy on public.wfh_actual_costs(user_id, financial_year);
