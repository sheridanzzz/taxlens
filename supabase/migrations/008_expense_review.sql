-- Apply after 007 on Neon or Supabase. Legacy records remain undecided;
-- no expense, amount, work use, receipt or deduction is changed by migration.
begin;
alter table expenses add column if not exists review_status text;
do $$ begin
  if not exists(select 1 from pg_constraint where conname='expenses_review_status') then
    alter table expenses add constraint expenses_review_status check (review_status in ('pending','reviewed','personal'));
  end if;
end $$;
create or replace function ledger_save_asset(p_user uuid, p_asset jsonb)
returns void language plpgsql security invoker set search_path = public as $$
declare saved_id uuid; a_id uuid := (p_asset->>'id')::uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  perform ledger_assert_owner('assets', a_id, p_user);
  if coalesce((p_asset->>'purchasePrice')::numeric,0) <= 0
    or coalesce((p_asset->>'workUsePercent')::numeric,-1) not between 0 and 100
    or coalesce((p_asset->>'effectiveLifeYears')::numeric,0) not between 1 and 100
    or p_asset->>'depreciationMethod' not in ('diminishing','prime_cost')
    or coalesce(trim(p_asset->>'name'),'')='' then raise exception 'Invalid asset details'; end if;
  insert into assets(id, user_id, name, asset_type, purchase_date, purchase_price,
    effective_life_years, depreciation_method, work_use_percent, financial_year, created_at)
  values(a_id, p_user, p_asset->>'name', p_asset->>'assetType', p_asset->>'purchaseDate',
    (p_asset->>'purchasePrice')::numeric, (p_asset->>'effectiveLifeYears')::numeric,
    p_asset->>'depreciationMethod', (p_asset->>'workUsePercent')::numeric,
    p_asset->>'financialYear', (p_asset->>'createdAt')::timestamptz)
  on conflict(id) do update set name=excluded.name, asset_type=excluded.asset_type,
    purchase_date=excluded.purchase_date, purchase_price=excluded.purchase_price,
    effective_life_years=excluded.effective_life_years, depreciation_method=excluded.depreciation_method,
    work_use_percent=excluded.work_use_percent, financial_year=excluded.financial_year
    where assets.user_id = p_user returning id into saved_id;
  if saved_id is null then raise exception 'Not authorized'; end if;
  update expenses set description=p_asset->>'name', date=p_asset->>'purchaseDate',
    amount=(p_asset->>'purchasePrice')::numeric, work_use_percent=(p_asset->>'workUsePercent')::numeric,
    claimable_amount=0, financial_year=p_asset->>'financialYear',
    review_status=case when (p_asset->>'workUsePercent')::numeric=0 then 'personal' else 'reviewed' end
    where asset_id=a_id and user_id=p_user;
end $$;

create or replace function ledger_save_expense(p_user uuid, p_expense jsonb, p_asset jsonb default null)
returns void language plpgsql security invoker set search_path = public as $$
declare e_id uuid := (p_expense->>'id')::uuid;
  a_id uuid := nullif(p_expense->>'assetId','')::uuid;
  old_asset uuid; saved_id uuid; existing_asset jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  perform ledger_assert_owner('expenses', e_id, p_user);
  if coalesce((p_expense->>'amount')::numeric,0) <= 0
    or coalesce((p_expense->>'workUsePercent')::numeric,-1) not between 0 and 100
    or p_expense->>'claimType' not in ('full','depreciation')
    or coalesce(trim(p_expense->>'description'),'')='' then raise exception 'Invalid expense details'; end if;
  if p_expense ? 'receiptDataUrl' and (length(p_expense->>'receiptDataUrl')>20000000
    or p_expense->>'receiptDataUrl' !~ '^data:(image/(png|jpeg|jpg|webp|gif)|application/pdf|message/rfc822);base64,') then
    raise exception 'Invalid receipt format or size';
  end if;
  if p_expense->>'reviewStatus' is not null and p_expense->>'reviewStatus' not in ('pending','reviewed','personal') then
    raise exception 'Invalid receipt review status';
  end if;
  if p_expense->>'reviewStatus'='personal' and (p_expense->>'workUsePercent')::numeric<>0 then
    raise exception 'Personal receipts must have zero work use';
  end if;
  select asset_id into old_asset from expenses where id=e_id and user_id=p_user for update;
  if old_asset is null and a_id is not null and p_expense->>'claimType' = 'full'
    and exists (select 1 from expenses where id=e_id and user_id=p_user and claim_type='depreciation') then
    perform ledger_assert_owner('assets', a_id, p_user);
    if exists(select 1 from expenses where asset_id=a_id and id<>e_id) then
      raise exception 'This asset already has a receipt record';
    end if;
    old_asset := a_id;
  end if;
  if old_asset is not null then perform ledger_assert_owner('assets', old_asset, p_user); end if;
  if p_expense->>'claimType' = 'depreciation' then
    if a_id is null then raise exception 'Select the asset linked to this receipt'; end if;
    perform ledger_assert_owner('assets', a_id, p_user);
    if p_asset is null then
      select jsonb_build_object('id', id, 'name', p_expense->>'description', 'assetType', asset_type,
        'purchaseDate', p_expense->>'date', 'purchasePrice', (p_expense->>'amount')::numeric,
        'effectiveLifeYears', effective_life_years, 'depreciationMethod', depreciation_method,
        'workUsePercent', (p_expense->>'workUsePercent')::numeric,
        'financialYear', p_expense->>'financialYear', 'createdAt', created_at)
      into existing_asset from assets where id=a_id and user_id=p_user;
      if existing_asset is null then raise exception 'Linked asset was not found'; end if;
      p_asset := existing_asset;
    end if;
    if (p_asset->>'id')::uuid <> a_id or p_asset->>'name' is distinct from p_expense->>'description'
      or (p_asset->>'purchasePrice')::numeric <> (p_expense->>'amount')::numeric
      or p_asset->>'purchaseDate' is distinct from p_expense->>'date'
      or (p_asset->>'workUsePercent')::numeric <> (p_expense->>'workUsePercent')::numeric then
      raise exception 'Asset and receipt details must match';
    end if;
    perform ledger_save_asset(p_user, p_asset);
  else
    a_id := null;
  end if;
  insert into expenses(id,user_id,date,description,amount,category,claim_type,work_use_percent,
    claimable_amount,receipt_data_url,notes,financial_year,created_at,asset_id,car_id,kilometres,review_status)
  values(e_id,p_user,p_expense->>'date',p_expense->>'description',(p_expense->>'amount')::numeric,
    p_expense->>'category',p_expense->>'claimType',(p_expense->>'workUsePercent')::numeric,
    case when a_id is null then round((p_expense->>'amount')::numeric*(p_expense->>'workUsePercent')::numeric/100,2) else 0 end,
    p_expense->>'receiptDataUrl',p_expense->>'notes',p_expense->>'financialYear',
    (p_expense->>'createdAt')::timestamptz,a_id,p_expense->>'carId',(p_expense->>'kilometres')::numeric,p_expense->>'reviewStatus')
  on conflict(id) do update set date=excluded.date, description=excluded.description,
    amount=excluded.amount,category=excluded.category,claim_type=excluded.claim_type,
    work_use_percent=excluded.work_use_percent,claimable_amount=excluded.claimable_amount,
    receipt_data_url=case when not (p_expense ? 'receiptDataUrl') and coalesce((p_expense->>'hasReceipt')::boolean,false)
      then expenses.receipt_data_url else excluded.receipt_data_url end,
    notes=excluded.notes,financial_year=excluded.financial_year,asset_id=excluded.asset_id,
    car_id=excluded.car_id,kilometres=excluded.kilometres,
    review_status=case when p_expense ? 'reviewStatus' then excluded.review_status else expenses.review_status end
    where expenses.user_id=p_user returning id into saved_id;
  if saved_id is null then raise exception 'Not authorized'; end if;
  if old_asset is not null and old_asset is distinct from a_id then
    delete from assets where id=old_asset and user_id=p_user;
  end if;
end $$;

create or replace function ledger_delete_asset(p_user uuid, p_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  perform ledger_assert_owner('assets',p_id,p_user);
  update expenses set asset_id=null,claim_type='full',work_use_percent=0,claimable_amount=0,review_status='personal'
    where asset_id=p_id and user_id=p_user;
  delete from assets where id=p_id and user_id=p_user;
end $$;
commit;
