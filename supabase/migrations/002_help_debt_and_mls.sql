-- ============================================================
-- Adds the two flags the tax estimate needs: compulsory HELP/HECS
-- repayment and Medicare levy surcharge exposure.
-- Safe to re-run. Run against Neon (or Supabase) once.
-- ============================================================

alter table user_settings
  add column if not exists has_help_debt boolean not null default false,
  add column if not exists has_private_hospital_cover boolean not null default false;
