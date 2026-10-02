-- Neon/Auth.js only: additive and safe to rerun. Supabase manages its own recovery.
begin;
alter table public.users add column if not exists session_version integer not null default 0;
create table if not exists public.password_reset_tokens (
  token_hash text primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists password_reset_tokens_user on public.password_reset_tokens(user_id);
create index if not exists password_reset_tokens_expiry on public.password_reset_tokens(expires_at);
create table if not exists public.password_reset_limits (
  key_hash text primary key,
  window_start timestamptz not null,
  attempts integer not null check(attempts > 0)
);
alter table public.password_reset_tokens enable row level security;
alter table public.password_reset_limits enable row level security;
-- These tables have no browser policies; only the server database role uses them.
revoke all on public.password_reset_tokens, public.password_reset_limits from public;
commit;
