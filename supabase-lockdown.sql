-- ============================================================================
-- PCF Portal — LOCKDOWN (no hard deletes, write-once receipts)
--
-- Every table was covered by one "for all to authenticated using (true)"
-- policy, so any signed-in account could DELETE rows straight through the
-- REST API — bypassing the soft-delete gate, which only sees updates — and
-- could overwrite or delete any receipt in the bucket.
--
-- This replaces those policies with the minimum the portal actually uses:
--
--   pcp_records, pcp_state   SELECT / INSERT / UPDATE   (no DELETE)
--   pcp_files                SELECT only  (only SQL ever writes it)
--   pcf-receipts bucket      SELECT / INSERT            (no UPDATE / DELETE)
--
-- Deleting a transaction still works: the portal soft-deletes (deleted = true),
-- which is an UPDATE and is still governed by pcp_delete_gate.
-- Scripts run from the SQL editor are unaffected — they bypass RLS.
--
-- ⚠ WHEN TO RUN
--   Only AFTER the index.html build with `upsert: false` on receipt upload is
--   deployed AND every user has reloaded the portal (Ctrl+F5). A stale tab
--   still uploading with upsert: true would have its uploads refused.
--
-- TO UNDO: re-run the "authenticated" policies from supabase-files-setup.sql
--          and supabase-storage-setup.sql, and recreate
--          "pcp_records authenticated" / "pcp_state authenticated" as
--          for all to authenticated using (true) with check (true).
-- ============================================================================

begin;

-- ---- pcp_records ----
drop policy if exists "pcp_records authenticated" on public.pcp_records;
drop policy if exists "pcp_records read"   on public.pcp_records;
drop policy if exists "pcp_records insert" on public.pcp_records;
drop policy if exists "pcp_records update" on public.pcp_records;
create policy "pcp_records read"   on public.pcp_records for select to authenticated using (true);
create policy "pcp_records insert" on public.pcp_records for insert to authenticated with check (true);
create policy "pcp_records update" on public.pcp_records for update to authenticated using (true) with check (true);
revoke delete on public.pcp_records from authenticated, anon;

-- ---- pcp_state ----
drop policy if exists "pcp_state authenticated" on public.pcp_state;
drop policy if exists "pcp_state read"   on public.pcp_state;
drop policy if exists "pcp_state insert" on public.pcp_state;
drop policy if exists "pcp_state update" on public.pcp_state;
create policy "pcp_state read"   on public.pcp_state for select to authenticated using (true);
create policy "pcp_state insert" on public.pcp_state for insert to authenticated with check (true);
create policy "pcp_state update" on public.pcp_state for update to authenticated using (true) with check (true);
revoke delete on public.pcp_state from authenticated, anon;

-- ---- pcp_files (read-only from the app) ----
drop policy if exists "pcp_files authenticated" on public.pcp_files;
drop policy if exists "pcp_files read" on public.pcp_files;
create policy "pcp_files read" on public.pcp_files for select to authenticated using (true);
revoke insert, update, delete on public.pcp_files from authenticated, anon;

-- ---- pcf-receipts bucket (write-once) ----
drop policy if exists "pcf-receipts update" on storage.objects;
drop policy if exists "pcf-receipts delete" on storage.objects;

commit;

-- ---- Verify ----
select tablename, policyname, cmd, roles
  from pg_policies
 where (schemaname = 'public' and tablename in ('pcp_records', 'pcp_state', 'pcp_files'))
    or (schemaname = 'storage' and policyname like 'pcf-receipts%')
 order by tablename, policyname;
