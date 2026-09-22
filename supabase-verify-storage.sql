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
-- What is in here, and how often it is worth running:
--
--   1-5    FILE HEALTH CHECK. Run after any change to uploads, or if a receipt
--          will not display. Section 4 is the one that matters — it must come
--          back empty.
--   6-7    HOUSEKEEPING. Orphaned files that nothing references: section 6 for
--          the Storage bucket, section 7 for the pcp_files rows in the
--          database. Once or twice a year is plenty. Both only LIST.
--   8-10   RECORD INTEGRITY, not files. Section 8 (duplicate document numbers)
--          is the one with real teeth — a duplicate voucher number reaches
--          Acumatica as a duplicate posting. Worth running monthly, and before
--          any month-end export.
--
-- Every section has a short "run this first" summary variant (5, 7b, 8b, 9b)
-- that answers the question in one row. Start there, and only read the
-- detailed listing if the summary says something is wrong.
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


-- ---------------------------------------------------------------------------
-- 7. HOUSEKEEPING — orphaned pcp_files rows.
--    The same idea as section 6, but for the migrated backlog that still lives
--    IN THE DATABASE. This is the one worth running: bucket objects sit in the
--    100 GB Storage quota, whereas every row here occupies the much smaller
--    database, is served without the CDN, and is base64 — about a third larger
--    than the file it represents.
--
--    Orphans arise the normal way: a PCF document was replaced (the replace
--    path clears fileId and points the record at a new bucket object, see
--    src/18b-pcf-documents.jsx), or the record that owned the attachment was
--    hard-deleted.
--
--    A row is "referenced" if ANY record points at it — including soft-deleted
--    records, exactly as section 6 treats bucket objects. That is deliberate:
--    a record marked deleted can still be inspected, and the cost of keeping a
--    file one cycle too long is far lower than destroying a receipt that an
--    audit later asks for.
--
--    This only LISTS. It deletes nothing.
-- ---------------------------------------------------------------------------
with referenced as (
  select a->>'fileId' as file_id
    from public.pcp_records r,
         lateral jsonb_array_elements(coalesce(r.data->'attachments','[]'::jsonb)) a
   where a ? 'fileId'
  union
  select data->>'fileId' from public.pcp_records where data ? 'fileId'
)
select f.id,
       pg_size_pretty(octet_length(f.data)::bigint) as bytes,
       f.created_at
  from public.pcp_files f
 where f.id not in (select file_id from referenced where file_id is not null)
 order by octet_length(f.data) desc;


-- ---------------------------------------------------------------------------
-- 7b. The same thing as a summary: how much is reclaimable, and how much is not.
--     Run this FIRST. If no "orphaned" row comes back there is nothing to clean
--     up, and the listing above is not worth reading.
-- ---------------------------------------------------------------------------
with referenced as (
  select a->>'fileId' as file_id
    from public.pcp_records r,
         lateral jsonb_array_elements(coalesce(r.data->'attachments','[]'::jsonb)) a
   where a ? 'fileId'
  union
  select data->>'fileId' from public.pcp_records where data ? 'fileId'
),
tagged as (
  select f.id,
         octet_length(f.data) as bytes,
         (f.id in (select file_id from referenced where file_id is not null)) as in_use
    from public.pcp_files f
)
select case when in_use then 'still referenced (keep)' else 'orphaned (safe to delete)' end as status,
       count(*)                                        as files,
       pg_size_pretty(coalesce(sum(bytes), 0)::bigint) as size
  from tagged
 group by in_use
 order by in_use;


-- ===========================================================================
-- SECTIONS 8-10 — DATA INTEGRITY, not storage.
--
-- Sections 1-7 answer "are the FILES healthy". These three answer "are the
-- RECORDS healthy". Same rules as everything above: read-only, safe to run at
-- any time with users working, and run ONE SECTION AT A TIME.
--
-- Worth knowing how pcp_records is shaped before reading them:
--   id          the record's own id (uid("req"), uid("dv"), ...)
--   collection  one of: funds, requests, disbursements, liquidations,
--               replenishments, reimbursements, documents, auditLog
--   data        the whole record, as jsonb
--   deleted     soft-delete flag. The portal still downloads these, then hides
--               them — they are not gone, only invisible.
--   updated_at  last write
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 8. DUPLICATE DOCUMENT NUMBERS — the one real integrity gap.
--
--    Why this can happen at all: four of the five series are generated from
--    the LENGTH of the list the browser happens to be holding —
--      PCV-2026-####     disbursements.length + 1   src/19-app.jsx
--      PCRP-2026-####    replenishments.length + 1  src/15-replenishment.jsx
--      REIM-2026-######  reimbursements.length + 1  src/22-reimbursement.jsx
--      PCFDOC-YYYY-##### documents.length + 1       src/18b-pcf-documents.jsx
--    Delete one record and the next number repeats one already issued. Two
--    people creating at the same moment both get the same number. Only
--    Request No. is safe: it uses nextSeriesNo(), which steps past every
--    number already taken (src/02-helpers.jsx).
--
--    The portal's own Data Integrity panel (System Settings) checks this too,
--    but only across the records that one browser has loaded. This query is
--    the whole database, which is the check that actually settles it.
--
--    EXPECTED RESULT: no rows.
--    Any row means two LIVE records share one official number. Renumber one of
--    them before either is exported to Acumatica — an accounting system will
--    treat the second as a duplicate posting.
-- ---------------------------------------------------------------------------
with numbered as (
  select r.collection,
         case r.collection
           when 'requests'       then r.data->>'requestNo'
           when 'disbursements'  then r.data->>'voucherNo'
           when 'replenishments' then r.data->>'replenishmentNo'
           when 'reimbursements' then r.data->>'reimbNo'
           when 'documents'      then r.data->>'refNo'
         end                                        as doc_no,
         r.id,
         r.data->>'branchCode'                      as branch,
         r.updated_at
    from public.pcp_records r
   where not r.deleted
     and r.collection in ('requests', 'disbursements', 'replenishments',
                          'reimbursements', 'documents')
)
select collection,
       doc_no,
       count(*)                                                    as times_used,
       string_agg(id, ', ' order by updated_at)                    as record_ids,
       string_agg(coalesce(branch, '-'), ', ' order by updated_at) as branches,
       min(updated_at)                                             as first_written,
       max(updated_at)                                             as last_written
  from numbered
 where doc_no is not null and doc_no <> ''
 group by collection, doc_no
having count(*) > 1
 order by count(*) desc, collection, doc_no;


-- ---------------------------------------------------------------------------
-- 8b. The same question, one line per series — so you can see at a glance
--     WHICH series is drifting instead of reading a list of clashes.
--     Run this first. `distinct_numbers` should equal `live_records` on every
--     row, and `missing_number` should be 0.
-- ---------------------------------------------------------------------------
with numbered as (
  select r.collection,
         case r.collection
           when 'requests'       then r.data->>'requestNo'
           when 'disbursements'  then r.data->>'voucherNo'
           when 'replenishments' then r.data->>'replenishmentNo'
           when 'reimbursements' then r.data->>'reimbNo'
           when 'documents'      then r.data->>'refNo'
         end as doc_no
    from public.pcp_records r
   where not r.deleted
     and r.collection in ('requests', 'disbursements', 'replenishments',
                          'reimbursements', 'documents')
)
select collection,
       count(*) filter (where doc_no is not null and doc_no <> '') as live_records,
       /* Blanks are filtered out of BOTH counts. count(distinct) drops NULL on
          its own but treats '' as a value, so without this an unnumbered
          record makes the two counts differ and the verdict cries duplicate
          when section 8 finds nothing. */
       count(distinct doc_no) filter (where doc_no is not null and doc_no <> '')
                                                                   as distinct_numbers,
       count(*) filter (where doc_no is null or doc_no = '')       as missing_number,
       case when count(*) filter (where doc_no is not null and doc_no <> '')
                 = count(distinct doc_no) filter (where doc_no is not null and doc_no <> '')
            then 'OK'
            else 'DUPLICATES - see section 8' end                  as verdict
  from numbered
 group by collection
 order by collection;


-- ---------------------------------------------------------------------------
-- 9. OVERSIZED RECORDS — guards the regression that caused the outage.
--
--    Every record is downloaded by EVERY signed-in browser on EVERY page load,
--    so one fat row slows the portal for everybody, not only its owner. Since
--    the receipts moved out to the bucket, no record should come near a
--    megabyte — a few KB each is normal.
--
--    `payload` is the serialised size, which is what actually crosses the
--    wire. Above ~100 KB deserves a look. Above 1 MB means file bytes have
--    found their way back into a record — cross-check against section 5,
--    whose inline count must be 0.
-- ---------------------------------------------------------------------------
select r.id,
       r.collection,
       pg_size_pretty(octet_length(r.data::text)::bigint)               as payload,
       jsonb_array_length(coalesce(r.data->'attachments', '[]'::jsonb)) as attachments,
       coalesce(r.data->>'requestNo', r.data->>'voucherNo',
                r.data->>'replenishmentNo', r.data->>'reimbNo',
                r.data->>'refNo', '-')                                  as doc_no,
       r.deleted,
       r.updated_at
  from public.pcp_records r
 order by octet_length(r.data::text) desc
 limit 20;


-- ---------------------------------------------------------------------------
-- 9b. The same picture per collection — row counts and total weight.
--     This is the one to write down and compare over time: if total_payload
--     climbs faster than live_rows, records are getting fatter, and that is
--     the early warning worth acting on.
-- ---------------------------------------------------------------------------
select collection,
       count(*)                                              as rows_total,
       count(*) filter (where not deleted)                   as live_rows,
       count(*) filter (where deleted)                       as deleted_rows,
       pg_size_pretty(sum(octet_length(data::text))::bigint) as total_payload,
       pg_size_pretty(avg(octet_length(data::text))::bigint) as avg_record,
       pg_size_pretty(max(octet_length(data::text))::bigint) as largest_record
  from public.pcp_records
 group by collection
 order by sum(octet_length(data::text)) desc;


-- ---------------------------------------------------------------------------
-- 10. SOFT-DELETED BUILD-UP.
--
--     Deleting in the portal sets deleted = true and leaves the row in place.
--     That is deliberate — it is what makes a deletion recoverable and keeps
--     the audit trail honest.
--
--     What these rows actually cost is SMALLER than it looks. The loader
--     fetches live records with their payload, but deleted ones as tombstones
--     only — "id,collection", no data column (see getAll in index.html). So
--     `stored_payload` below is DATABASE space, not egress: the bytes sit on
--     disk and in every backup, but they do not cross the wire on page load.
--     The per-load cost is a few dozen bytes per tombstone.
--
--     There is therefore very little to panic about. Watch the RATIO: if
--     pct_deleted climbs past roughly half, purging the oldest is worth
--     considering — for backup size and tidiness, not for speed.
--
--     Do NOT delete from here without copying to a backup table first. See
--     supabase-strip-inline-receipts.sql for the pattern this project uses:
--     copy into the pcf_backup schema, report what will change, verify, and
--     only then change anything.
-- ---------------------------------------------------------------------------
select collection,
       count(*) filter (where not deleted)                    as live,
       count(*) filter (where deleted)                        as soft_deleted,
       round(100.0 * count(*) filter (where deleted)
                   / nullif(count(*), 0), 1)                  as pct_deleted,
       pg_size_pretty(coalesce(sum(octet_length(data::text))
                      filter (where deleted), 0)::bigint)     as stored_payload,
       max(updated_at) filter (where deleted)                 as newest_deletion
  from public.pcp_records
 group by collection
 order by count(*) filter (where deleted) desc;
