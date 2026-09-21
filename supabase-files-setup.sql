-- ============================================================================
-- PCF Portal — pcp_files (receipt & document bytes)
-- Run ONCE in the Supabase SQL editor of the target project
-- (currently: https://soyxjaqshuunweqbvjzb.supabase.co).
--
-- Safe to re-run: every statement is idempotent and none of them touch
-- existing rows.
--
-- ----------------------------------------------------------------------------
-- WHY THIS EXISTS
--   Uploaded receipts were stored as base64 data URLs INSIDE the transaction
--   record (pcp_records.data -> attachments[].data, and dataUrl for PCF
--   documents). Ten liquidations came to 38 MB, fourteen reimbursements to
--   12 MB. The portal loads every record on sign-in, so each account had to
--   pull ~54 MB before it could show a single request. The read timed out, the
--   loader could not tell an empty result from an empty database, and every
--   user saw a working but completely blank portal.
--
--   A record should be small enough to list. Bytes belong somewhere you only
--   touch when someone actually opens a receipt.
--
--   The second reason is safety. While bytes lived in the record, ANY save
--   rewrote the whole `data` column from whatever the browser held — so the
--   moment the app stopped loading the bytes, the next save would have erased
--   them. Bytes outside the record cannot be destroyed by a record write.
--
-- ----------------------------------------------------------------------------
-- THIS TABLE IS FOR THE EXISTING BACKLOG ONLY
--   New uploads do NOT come here — they go to the `pcf-receipts` Storage
--   bucket (supabase-storage-setup.sql), which is the better long-term home:
--   100 GB included against 8 GB of database, scans kept out of database
--   backups, images served over the CDN.
--
--   The 60 files already inside pcp_records are a different problem. Moving
--   them to the bucket would mean pulling them into a browser and pushing
--   them back up; into this table it is one INSERT … SELECT that never leaves
--   the database host and takes about a second.
--
--   So: old bytes land here by SQL, new bytes go to the bucket, and
--   useFileUrl in src/02-helpers.jsx resolves either. The app only ever READS
--   this table — nothing in the portal writes to it.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. The table.
--    `id` IS the attachment id already stored in the record (att-…, ratt-…) or,
--    for a PCF document, the document's own record id. So the record needs no
--    new pointer invented for it — it already knows the key.
--
--    Deliberately NOT normalised further: no owner column. A file uploaded
--    into an unsaved liquidation has no owner yet, and a nullable column that
--    is usually null is worse than none. Orphans are found by comparing this
--    table's ids against the fileIds referenced in pcp_records (see section 4).
-- ---------------------------------------------------------------------------
create table if not exists public.pcp_files (
  id         text primary key,
  data       text        not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. Access — signed-in users only, exactly like pcp_records.
--    The publishable key in index.html is public by design; this is what
--    actually protects the receipts. Anonymous callers get nothing.
-- ---------------------------------------------------------------------------
alter table public.pcp_files enable row level security;

drop policy if exists "pcp_files authenticated" on public.pcp_files;
create policy "pcp_files authenticated" on public.pcp_files
  for all to authenticated using (true) with check (true);

grant select, insert, update, delete on public.pcp_files to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Verify.
-- ---------------------------------------------------------------------------
select tablename, rowsecurity
  from pg_tables
 where schemaname = 'public' and tablename = 'pcp_files';

select policyname, cmd, roles
  from pg_policies
 where schemaname = 'public' and tablename = 'pcp_files';

-- ---------------------------------------------------------------------------
-- 4. Orphan sweep — keep for later, not needed now.
--    Removing an attachment from a liquidation does not delete its bytes, on
--    purpose: deleting on removal risks destroying a file that an unsaved edit
--    would have kept. Run this occasionally to see what is no longer
--    referenced, and delete those ids once you are satisfied.
-- ---------------------------------------------------------------------------
-- with referenced as (
--   select a->>'fileId' as id
--     from public.pcp_records r,
--          lateral jsonb_array_elements(coalesce(r.data->'attachments','[]'::jsonb)) a
--    where a ? 'fileId'
--   union
--   select data->>'fileId' from public.pcp_records where data ? 'fileId'
-- )
-- select f.id, pg_size_pretty(length(f.data)::bigint) as bytes, f.created_at
--   from public.pcp_files f
--  where f.id not in (select id from referenced where id is not null)
--  order by f.created_at;
