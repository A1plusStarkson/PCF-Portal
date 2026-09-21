-- ============================================================================
-- PCF Portal — STRIP INLINE RECEIPT BYTES  (final step of the file migration)
--
-- ⚠ RUN THIS LAST, AND ONLY WHEN ALL OF THESE ARE TRUE:
--     1. supabase-files-setup.sql has been run (pcp_files exists)
--     2. the app build that reads from pcp_files is DEPLOYED
--     3. supabase-migrate-receipts-to-files.sql reported an EMPTY "not copied"
--        list, and files_stored matched attachments_tagged + documents_tagged
--     4. you have opened the portal and confirmed receipts still display
--
--   Until this runs, every migrated record holds its bytes TWICE — once
--   inline, once in pcp_files — and the portal prefers the inline copy. That
--   redundancy is the whole safety net: up to this point the migration can be
--   abandoned by deleting the fileId tags. This script removes the net.
--
-- WHAT IT DOES
--   Removes attachments[].data and dataUrl, under TWO conditions that must
--   both hold: the item carries a `fileId`, AND a row actually exists in
--   pcp_files with that id AND non-empty bytes. A fileId is only a claim; this
--   statement deletes the last other copy of a scanned official receipt, so
--   the claim is checked against the data before anything is removed.
--
--   Anything unverified is left completely alone and reported in section 2.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Safety net — a complete copy of every row about to be rewritten.
--    Deliberately NOT in `public`: a table there is reachable through the REST
--    API and Supabase's defaults would hand every signed-in user a readable
--    copy of the receipts. PostgREST only exposes its configured schemas.
--
--    `if not exists` means a second run never overwrites the original pre-strip
--    copy with post-strip (already emptied) data.
-- ---------------------------------------------------------------------------
create schema if not exists pcf_backup;
revoke all on schema pcf_backup from anon, authenticated;

create table if not exists pcf_backup.pcp_records_preinline as
  select * from public.pcp_records
   where collection in ('liquidations', 'reimbursements', 'documents');

-- ---------------------------------------------------------------------------
-- 2. Report what will change and what will deliberately be skipped.
--    Read this BEFORE trusting the result. Any non-zero "INVESTIGATE" row
--    means a receipt whose bytes were never safely copied.
-- ---------------------------------------------------------------------------
select 'attachments — bytes confirmed in pcp_files (WILL be stripped)' as item, count(*) as files
  from public.pcp_records r,
       lateral jsonb_array_elements(coalesce(r.data->'attachments','[]'::jsonb)) a
 where not r.deleted and coalesce(a->>'data','') <> '' and a ? 'fileId'
   and exists (select 1 from public.pcp_files f
                where f.id = a->>'fileId' and coalesce(f.data,'') <> '')
union all
select 'attachments — fileId set but NO bytes found (left alone, INVESTIGATE)', count(*)
  from public.pcp_records r,
       lateral jsonb_array_elements(coalesce(r.data->'attachments','[]'::jsonb)) a
 where not r.deleted and coalesce(a->>'data','') <> '' and a ? 'fileId'
   and not exists (select 1 from public.pcp_files f
                    where f.id = a->>'fileId' and coalesce(f.data,'') <> '')
union all
select 'attachments — never migrated (left alone)', count(*)
  from public.pcp_records r,
       lateral jsonb_array_elements(coalesce(r.data->'attachments','[]'::jsonb)) a
 where not r.deleted and coalesce(a->>'data','') <> '' and not (a ? 'fileId')
union all
select 'documents — bytes confirmed in pcp_files (WILL be stripped)', count(*)
  from public.pcp_records r
 where not r.deleted and coalesce(r.data->>'dataUrl','') <> '' and r.data ? 'fileId'
   and exists (select 1 from public.pcp_files f
                where f.id = r.data->>'fileId' and coalesce(f.data,'') <> '')
union all
select 'documents — not migrated or bytes missing (left alone)', count(*)
  from public.pcp_records r
 where not r.deleted and coalesce(r.data->>'dataUrl','') <> ''
   and (not (r.data ? 'fileId')
        or not exists (select 1 from public.pcp_files f
                        where f.id = r.data->>'fileId' and coalesce(f.data,'') <> ''));

-- ---------------------------------------------------------------------------
-- 3. Strip attachment bytes.
--    Every other attachment field — name, size, type, receipt no., amount,
--    approval status and history — is preserved exactly. Only `data` goes.
--    `with ordinality` + `order by ord` keeps the receipts in their original
--    order.
-- ---------------------------------------------------------------------------
update public.pcp_records r
   set data = jsonb_set(
         r.data,
         '{attachments}',
         (select coalesce(jsonb_agg(
                   case when a ? 'fileId'
                         and exists (select 1 from public.pcp_files f
                                      where f.id = a->>'fileId' and coalesce(f.data,'') <> '')
                        then a - 'data'
                        else a
                   end
                   order by ord), '[]'::jsonb)
            from jsonb_array_elements(r.data->'attachments') with ordinality t(a, ord))
       ),
       updated_at = now()
 where not r.deleted
   -- Same set the backup in section 1 covers. Without this the statement could
   -- rewrite a row that has no backup, which is the one thing it must never do.
   and r.collection in ('liquidations', 'reimbursements', 'documents')
   and jsonb_typeof(r.data->'attachments') = 'array'
   and exists (
     select 1 from jsonb_array_elements(r.data->'attachments') a
      where a ? 'fileId' and coalesce(a->>'data','') <> ''
        and exists (select 1 from public.pcp_files f
                     where f.id = a->>'fileId' and coalesce(f.data,'') <> '')
   );

-- ---------------------------------------------------------------------------
-- 4. Strip PCF document bytes — same two conditions.
-- ---------------------------------------------------------------------------
update public.pcp_records r
   set data = r.data - 'dataUrl',
       updated_at = now()
 where not r.deleted
   and r.collection in ('liquidations', 'reimbursements', 'documents')
   and r.data ? 'fileId'
   and coalesce(r.data->>'dataUrl','') <> ''
   and exists (select 1 from public.pcp_files f
                where f.id = r.data->>'fileId' and coalesce(f.data,'') <> '');

commit;

-- ---------------------------------------------------------------------------
-- 5. Reclaim the disk. VACUUM cannot run inside a transaction, so these run on
--    their own, AFTER the commit above.
--
--    ⚠ `full` rewrites the table under an ACCESS EXCLUSIVE lock — the portal
--      cannot read or write pcp_records while it runs. Seconds on a table this
--      size, but use a quiet window all the same.
--
--    The plain form takes no disruptive lock but returns the freed space to
--    Postgres for reuse rather than to the operating system.
-- ---------------------------------------------------------------------------
-- vacuum (analyze) public.pcp_records;          -- safe any time
-- vacuum (analyze, full) public.pcp_records;    -- locks the table; quiet window only

-- ---------------------------------------------------------------------------
-- 6. Verify — pcp_records should now be kilobytes; pcp_files holds the bulk.
-- ---------------------------------------------------------------------------
select collection,
       count(*) as rows,
       pg_size_pretty(sum(pg_column_size(data))::bigint) as payload
  from public.pcp_records
 where not deleted
 group by collection
 order by sum(pg_column_size(data)) desc;

select count(*) as files, pg_size_pretty(sum(length(data))::bigint) as payload
  from public.pcp_files;

-- Anything still inline is a file that was never safely copied. Investigate
-- before assuming the migration is complete.
select r.id, r.collection, a->>'name' as file_name
  from public.pcp_records r,
       lateral jsonb_array_elements(coalesce(r.data->'attachments','[]'::jsonb)) a
 where not r.deleted and coalesce(a->>'data','') <> ''
union all
select r.id, r.collection, r.data->>'name'
  from public.pcp_records r
 where not r.deleted and coalesce(r.data->>'dataUrl','') <> '';
