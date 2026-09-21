-- ============================================================================
-- PCF Portal — MIGRATE receipt bytes out of the records and into pcp_files
--
-- Runs entirely inside Postgres. Nothing is downloaded, nothing is uploaded,
-- nothing passes through a browser — which is the whole point, because the
-- connection that has to be trusted with ~108 MB of round-trip is the one that
-- could not manage a 54 MB download in the first place.
--
-- ⚠ PREREQUISITES
--     1. supabase-files-setup.sql has been run (the pcp_files table exists)
--     2. the app build that reads from pcp_files is DEPLOYED
--
-- THIS SCRIPT IS ADDITIVE AND REVERSIBLE.
--   It COPIES bytes into pcp_files and tags each attachment with a `fileId`.
--   The inline copy is LEFT IN PLACE. Every migrated record then holds its
--   bytes twice, and the portal prefers the inline copy — so until you run
--   supabase-strip-inline-receipts.sql, this can be undone by deleting the
--   fileId tags and nothing is at risk.
--
-- Expected on the current production data: 59 attachments + 1 document = 60.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Copy attachment bytes.
--    The attachment's own id becomes the file id, so no new identifier has to
--    be invented and the migration is idempotent: `on conflict do nothing`
--    means re-running this copies nothing twice.
-- ---------------------------------------------------------------------------
insert into public.pcp_files (id, data)
select a->>'id', a->>'data'
  from public.pcp_records r,
       lateral jsonb_array_elements(coalesce(r.data->'attachments', '[]'::jsonb)) a
 where not r.deleted
   and coalesce(a->>'id', '')   <> ''
   and coalesce(a->>'data', '') <> ''
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Copy PCF document bytes. Here the document's record id is the file id.
-- ---------------------------------------------------------------------------
insert into public.pcp_files (id, data)
select r.id, r.data->>'dataUrl'
  from public.pcp_records r
 where not r.deleted
   and coalesce(r.data->>'dataUrl', '') <> ''
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 3. Tag each attachment with its fileId — but ONLY where the bytes are
--    provably now in pcp_files. A tag is a promise the app will rely on once
--    the inline copy is gone, so it is never written on faith.
--
--    `with ordinality` + `order by ord` keeps the receipts in their original
--    order; a liquidation's attachments are listed in the order they were
--    added and the approval history reads against that order.
-- ---------------------------------------------------------------------------
update public.pcp_records r
   set data = jsonb_set(
         r.data,
         '{attachments}',
         (select coalesce(jsonb_agg(
                   case when exists (select 1 from public.pcp_files f where f.id = a->>'id')
                        then a || jsonb_build_object('fileId', a->>'id')
                        else a
                   end
                   order by ord), '[]'::jsonb)
            from jsonb_array_elements(r.data->'attachments') with ordinality t(a, ord))
       ),
       updated_at = now()
 where not r.deleted
   and jsonb_typeof(r.data->'attachments') = 'array'
   and exists (
     select 1
       from jsonb_array_elements(r.data->'attachments') a
       join public.pcp_files f on f.id = a->>'id'
      where not (a ? 'fileId')
   );

-- ---------------------------------------------------------------------------
-- 4. Tag PCF documents the same way.
-- ---------------------------------------------------------------------------
update public.pcp_records r
   set data = r.data || jsonb_build_object('fileId', r.id),
       updated_at = now()
 where not r.deleted
   and not (r.data ? 'fileId')
   and exists (select 1 from public.pcp_files f where f.id = r.id);

commit;

-- ---------------------------------------------------------------------------
-- 5. Verify. The two counts must agree, and nothing should be left untagged.
-- ---------------------------------------------------------------------------
select
  (select count(*) from public.pcp_files)                                as files_stored,
  (select count(*) from public.pcp_records r,
          lateral jsonb_array_elements(coalesce(r.data->'attachments','[]'::jsonb)) a
    where not r.deleted and a ? 'fileId')                                as attachments_tagged,
  (select count(*) from public.pcp_records
    where not deleted and data ? 'fileId')                               as documents_tagged;

-- Anything listed here still has inline bytes that were NOT copied. The list
-- should be empty. If it is not, do not run the strip script.
select r.id, r.collection, a->>'name' as file_name, 'attachment' as kind
  from public.pcp_records r,
       lateral jsonb_array_elements(coalesce(r.data->'attachments','[]'::jsonb)) a
 where not r.deleted and coalesce(a->>'data','') <> ''
   and not exists (select 1 from public.pcp_files f where f.id = a->>'id')
union all
select r.id, r.collection, r.data->>'name', 'document'
  from public.pcp_records r
 where not r.deleted and coalesce(r.data->>'dataUrl','') <> ''
   and not exists (select 1 from public.pcp_files f where f.id = r.id);

-- Size check: pcp_files should now hold the ~54 MB, and pcp_records still
-- holds its own copy until the strip script runs.
select 'pcp_files' as tbl, pg_size_pretty(sum(length(data))::bigint) as payload from public.pcp_files
union all
select 'pcp_records', pg_size_pretty(sum(pg_column_size(data))::bigint) from public.pcp_records where not deleted;
