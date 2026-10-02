-- Apply after migrations 001-005 on Neon or Supabase. Safe to rerun.
begin;
create table if not exists airtail_connections (
  user_id uuid primary key,
  token_ciphertext text not null,
  account_email text not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);
alter table airtail_connections enable row level security;
do $$ begin
  if not exists(select 1 from pg_constraint where conname='airtail_connections_owner') then
    if to_regclass('auth.users') is not null then
      alter table airtail_connections add constraint airtail_connections_owner foreign key(user_id) references auth.users(id) on delete cascade;
    elsif to_regclass('public.users') is not null then
      alter table airtail_connections add constraint airtail_connections_owner foreign key(user_id) references public.users(id) on delete cascade;
    end if;
  end if;
  if to_regprocedure('auth.uid()') is not null then
    drop policy if exists airtail_connections_owned on airtail_connections;
    create policy airtail_connections_owned on airtail_connections for all using (user_id=auth.uid()) with check (user_id=auth.uid());
  end if;
  if exists(select 1 from pg_roles where rolname='authenticated') then
    grant select,insert,update,delete on airtail_connections to authenticated;
  end if;
end $$;

-- The original MIME email retains all attachments and headers in a single
-- evidence payload. Downloads are served as .eml; HTML is never displayed.
do $$ declare definition text; begin
  select pg_get_functiondef(oid) into definition from pg_proc
    where proname='ledger_save_expense' and pronamespace='public'::regnamespace;
  if definition is null then raise exception 'Apply migration 005 first'; end if;
  if strpos(definition, '|message/rfc822')=0 then
    execute replace(definition, 'image/(png|jpeg|jpg|webp|gif)|application/pdf', 'image/(png|jpeg|jpg|webp|gif)|application/pdf|message/rfc822');
  end if;
end $$;
commit;
