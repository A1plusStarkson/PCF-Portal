-- ============================================================================
-- PCF Portal — MFA GATE (admin accounts must pass the 6-digit code)
--
-- The portal asks the accounts in window.PCP_MFA_EMAILS for an authenticator
-- code after their password. That screen is a browser-side control: with only
-- the password, anyone could still call the REST API directly. This makes the
-- database refuse those accounts — read AND write — unless the session has
-- passed the code check (JWT claim aal = 'aal2').
--
-- Every other account is unaffected. The policies are RESTRICTIVE, so they are
-- ANDed with the existing ones from supabase-lockdown.sql; nothing is widened.
--
-- ⚠ WHEN TO RUN
--   Only AFTER the portal build with the two-step sign-in screen is deployed
--   AND all three admin accounts have signed in once and set up their
--   authenticator app. An admin tab still open from before (password-only
--   session) will have its saves refused until it signs out and back in.
--
-- TO REMOVE:
--   drop policy if exists "pcp_records mfa" on public.pcp_records;
--   drop policy if exists "pcp_state mfa"   on public.pcp_state;
--   drop policy if exists "pcp_files mfa"   on public.pcp_files;
--   drop policy if exists "pcf-receipts mfa" on storage.objects;
--   drop function if exists public.pcp_mfa_ok();
-- ============================================================================

begin;

-- True unless the signed-in account is one that requires MFA and this
-- session has not passed it. Keep the list in step with PCP_MFA_EMAILS
-- (= PCP_ADMIN_EMAILS) in index.html.
create or replace function public.pcp_mfa_ok()
returns boolean
language sql
stable
as $$
  select not (lower(coalesce(auth.jwt()->>'email', '')) = any (array[
           'accounting@a1plus.com',
           'a1plusadmin@a1plus.com',
           'superuser@a1plus.com'
         ]))
      or coalesce(auth.jwt()->>'aal', '') = 'aal2';
$$;

drop policy if exists "pcp_records mfa" on public.pcp_records;
create policy "pcp_records mfa" on public.pcp_records
  as restrictive for all to authenticated
  using (public.pcp_mfa_ok()) with check (public.pcp_mfa_ok());

drop policy if exists "pcp_state mfa" on public.pcp_state;
create policy "pcp_state mfa" on public.pcp_state
  as restrictive for all to authenticated
  using (public.pcp_mfa_ok()) with check (public.pcp_mfa_ok());

drop policy if exists "pcp_files mfa" on public.pcp_files;
create policy "pcp_files mfa" on public.pcp_files
  as restrictive for all to authenticated
  using (public.pcp_mfa_ok()) with check (public.pcp_mfa_ok());

-- Scoped to the receipts bucket so no other bucket is affected.
drop policy if exists "pcf-receipts mfa" on storage.objects;
create policy "pcf-receipts mfa" on storage.objects
  as restrictive for all to authenticated
  using (bucket_id <> 'pcf-receipts' or public.pcp_mfa_ok())
  with check (bucket_id <> 'pcf-receipts' or public.pcp_mfa_ok());

commit;

-- ---- Verify ----
select tablename, policyname, permissive, cmd
  from pg_policies
 where policyname like '%mfa'
 order by tablename;
