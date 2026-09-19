-- Keuangan Pintar security/performance hardening record
-- APPLIED directly to Supabase project evtkeyfjgqwarsmlzrkh on 2026-09-19.
-- This file is a reproducibility record; it is not an automatic deploy script.

revoke all on table public.kp_transactions from anon, authenticated;
revoke all on table public.kp_profiles from anon, authenticated;
grant select, insert, update, delete on table public.kp_transactions to authenticated;
grant select, insert, update on table public.kp_profiles to authenticated;

drop policy if exists kp_transactions_select_own on public.kp_transactions;
drop policy if exists kp_transactions_insert_own on public.kp_transactions;
drop policy if exists kp_transactions_update_own on public.kp_transactions;
drop policy if exists kp_transactions_delete_own on public.kp_transactions;
drop policy if exists kp_profiles_select_own on public.kp_profiles;
drop policy if exists kp_profiles_insert_own on public.kp_profiles;
drop policy if exists kp_profiles_update_own on public.kp_profiles;

create policy kp_transactions_select_own
on public.kp_transactions
for select
to authenticated
using (
  (select auth.uid()) = user_id
  and coalesce((select auth.jwt()->>'is_anonymous'),'false') <> 'true'
);

create policy kp_transactions_insert_own
on public.kp_transactions
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and coalesce((select auth.jwt()->>'is_anonymous'),'false') <> 'true'
);

create policy kp_transactions_update_own
on public.kp_transactions
for update
to authenticated
using (
  (select auth.uid()) = user_id
  and coalesce((select auth.jwt()->>'is_anonymous'),'false') <> 'true'
)
with check (
  (select auth.uid()) = user_id
  and coalesce((select auth.jwt()->>'is_anonymous'),'false') <> 'true'
);

create policy kp_transactions_delete_own
on public.kp_transactions
for delete
to authenticated
using (
  (select auth.uid()) = user_id
  and coalesce((select auth.jwt()->>'is_anonymous'),'false') <> 'true'
);

create policy kp_profiles_select_own
on public.kp_profiles
for select
to authenticated
using (
  (select auth.uid()) = user_id
  and coalesce((select auth.jwt()->>'is_anonymous'),'false') <> 'true'
);

create policy kp_profiles_insert_own
on public.kp_profiles
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and coalesce((select auth.jwt()->>'is_anonymous'),'false') <> 'true'
);

create policy kp_profiles_update_own
on public.kp_profiles
for update
to authenticated
using (
  (select auth.uid()) = user_id
  and coalesce((select auth.jwt()->>'is_anonymous'),'false') <> 'true'
)
with check (
  (select auth.uid()) = user_id
  and coalesce((select auth.jwt()->>'is_anonymous'),'false') <> 'true'
);

create index if not exists kp_transactions_user_scope_date_created_idx
on public.kp_transactions (user_id, scope, transaction_date desc, created_at desc);
