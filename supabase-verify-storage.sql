-- ============================================================================
-- PCF Portal — HEALTH CHECK: are uploads reaching the bucket?
--
-- Read-only. Nothing here writes, updates or deletes anything, so it is safe
-- to run at any time, as often as you like, with users working.
--
-- Run the sections ONE AT A TIME. The Supabase SQL editor only shows the
-- result of the LAST statement when several are run together, so pasting the
-- whole file at once will hide every answer but the final one.
--
-- Sections 1-5 are the health check. Section 6 is the housekeeping sweep and
-- is only worth running once or twice a year.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. Is the bucket there, and is it PRIVATE?
--    `public` MUST be false. If it is true, every scanned receipt is readable
--    by anyone who has, guesses, or keeps a URL — fix that before anything else.
-- ---------------------------------------------------------------------------
select id, public, created_at
  from storage.buckets
 where id = 'pcf-receipts';


-- ---------------------------------------------------------------------------
-- 2. Is it actually receiving uploads?
--    `newest_upload` is the real answer to "is this working": if it is recent
--    and moves each time somebody attaches a receipt, the path is live. A
--    stale timestamp means uploads stopped reaching the bucket.
-- ---------------------------------------------------------------------------
select count(*)                                              as objects,
       pg_size_pretty(sum((metadata->>'size')::bigint))      as total_size,
       min(created_at)                                       as first_upload,
       max(created_at)                                       as newest_upload
  from storage.objects
 where bucket_id = 'pcf-receipts';


-- ---------------------------------------------------------------------------
-- 3. The last 10 uploads, newest first.
--    Names should look like receipts/att-XXXXXXX/Filename.jpg and sizes should
--    be plausible for a scan. A size of 0 means an empty object was created —
--    the upload reported success but stored nothing.
-- ---------------------------------------------------------------------------
select name,
       (metadata->>'size')::bigint as bytes,
       metadata->>'mimetype'       as type,
       created_at
  from storage.objects
 where bucket_id = 'pcf-receipts'
 order by created_at desc
 limit 10;


-- ---------------------------------------------------------------------------
-- 4. BROKEN REFERENCES — the one that matters.
--    A record claiming a `path` with no object behind it is a receipt the
--    portal cannot show. This list MUST be empty.
-- ---------------------------------------------------------------------------
select r.id                as record_id,
       r.collection,
       a->>'name'          as file_name,
       a->>'path'          as missing_path
  from public.pcp_records r,
       lateral jsonb_array_elements(coalesce(r.data->'attachments','[]'::jsonb)) a
 where not r.deleted
   and a ? 'path'
   and not exists (select 1 from storage.objects o
                    where o.bucket_id = 'pcf-receipts' and o.name = a->>'path')
union all
select r.id, r.collection, r.data->>'name', r.data->>'path'
  from public.pcp_records r
 where not r.deleted
   and r.data ? 'path'
   and not exists (select 1 from storage.objects o
                    where o.bucket_id = 'pcf-receipts' and o.name = r.data->>'path');


-- ---------------------------------------------------------------------------
-- 5. Where every byte now lives.
--    `inline_in_records` MUST be 0 — anything else means a record is carrying
--    file bytes again, which is the condition that caused the original outage.
--    pcp_files holds the migrated backlog and never grows.
--    The bucket holds everything since, and is the only number that should rise.
-- ---------------------------------------------------------------------------
select 'inline in records (must be 0)' as location,
       (select count(*) from public.pcp_records r,
               lateral jsonb_array_elements(coalesce(r.data->'attachments','[]'::jsonb)) a
         where not r.deleted and coalesce(a->>'data','') <> '')
       + (select count(*) from public.pcp_records
           where not deleted and coalesce(data->>'dataUrl','') <> '')      as files,
       null                                                                as size
union all
select 'pcp_files (migrated backlog, static)',
       (select count(*) from public.pcp_files),
       (select pg_size_pretty(sum(length(data))::bigint) from public.pcp_files)
union all
select 'bucket (all new uploads, grows)',
       (select count(*) from storage.objects where bucket_id = 'pcf-receipts'),
       (select pg_size_pretty(sum((metadata->>'size')::bigint))
          from storage.objects where bucket_id = 'pcf-receipts');


-- ---------------------------------------------------------------------------
-- 6. HOUSEKEEPING — orphaned objects. Once or twice a year is plenty.
--    Removing an attachment does not delete its object, deliberately: deleting
--    on removal risks destroying a file that a still-unsaved edit would have
--    kept. Anything listed here is referenced by no record and is safe to
--    delete from Storage. This only LISTS — it deletes nothing.
-- ---------------------------------------------------------------------------
with referenced as (
  select a->>'path' as path
    from public.pcp_records r,
         lateral jsonb_array_elements(coalesce(r.data->'attachments','[]'::jsonb)) a
   where a ? 'path'
  union
  select data->>'path' from public.pcp_records where data ? 'path'
)
select o.name,
       pg_size_pretty((o.metadata->>'size')::bigint) as bytes,
       o.created_at
  from storage.objects o
 where o.bucket_id = 'pcf-receipts'
   and o.name not in (select path from referenced where path is not null)
 order by o.created_at;
