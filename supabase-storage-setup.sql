-- ============================================================================
-- PCF Portal — Supabase Storage setup (bucket for NEW receipt uploads)
-- Run ONCE in the Supabase SQL editor of the target project
-- (currently: https://soyxjaqshuunweqbvjzb.supabase.co).
--
-- Safe to re-run: every statement is idempotent and none of them touch
-- existing rows or existing objects.
--
-- ----------------------------------------------------------------------------
-- WHERE FILES LIVE — three places, by design
--
--   1. INLINE in the record (attachments[].data, dataUrl)
--      How every receipt was stored originally. The portal loads every record
--      on sign-in, so ~54 MB had to arrive before it could show a single
--      request — the read timed out and every user saw a blank portal.
--      Read-only legacy now; nothing writes here any more.
--
--   2. public.pcp_files                       ← the 60 files already in the DB
--      Those legacy bytes move here by pure SQL, server-side, in about a
--      second (supabase-migrate-receipts-to-files.sql). No browser round trip
--      for a backlog that is already inside Postgres.
--
--   3. THIS BUCKET                            ← everything uploaded from now on
--      A new upload is already on the user's machine, so sending it here costs
--      nothing extra — in fact less, since base64 inflates a file by ~33% and
--      the bucket takes the raw bytes. Storage is 100 GB on Pro against 8 GB of
--      database, scans stay out of every database backup, and images come back
--      over the CDN.
--
--   useFileUrl in src/02-helpers.jsx resolves all three, so no record is ever
--   stranded by where its bytes happen to be.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. The bucket — PRIVATE.
--    Public buckets serve every object to anyone holding the URL. These are
--    scanned official receipts, so the portal signs a short-lived URL per view
--    instead (see window.storage.files.signedUrl in index.html).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('pcf-receipts', 'pcf-receipts', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Access — signed-in users only, exactly like pcp_records and pcp_files.
--    The publishable key in index.html is public by design; these policies are
--    what actually protect the files. Anonymous callers get nothing.
-- ---------------------------------------------------------------------------
drop policy if exists "pcf-receipts read"   on storage.objects;
drop policy if exists "pcf-receipts insert" on storage.objects;
drop policy if exists "pcf-receipts update" on storage.objects;
drop policy if exists "pcf-receipts delete" on storage.objects;

create policy "pcf-receipts read" on storage.objects
  for select to authenticated
  using (bucket_id = 'pcf-receipts');

create policy "pcf-receipts insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'pcf-receipts');

create policy "pcf-receipts update" on storage.objects
  for update to authenticated
  using (bucket_id = 'pcf-receipts')
  with check (bucket_id = 'pcf-receipts');

create policy "pcf-receipts delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'pcf-receipts');

-- ---------------------------------------------------------------------------
-- 3. Verify — the bucket exists, is PRIVATE, and has four policies.
--    `public` must read false. If it reads true, stop: every receipt would be
--    readable by anyone who guessed or kept a URL.
-- ---------------------------------------------------------------------------
select id, name, public, created_at
  from storage.buckets
 where id = 'pcf-receipts';

select policyname, cmd, roles
  from pg_policies
 where schemaname = 'storage' and tablename = 'objects'
   and policyname like 'pcf-receipts%'
 order by policyname;

-- ---------------------------------------------------------------------------
-- 4. Orphan sweep — keep for later, not needed now.
--    Removing an attachment does not delete its object, on purpose: deleting
--    on removal risks destroying a file an unsaved edit would have kept.
--    Anything listed here is no longer referenced by any record and is safe to
--    delete from Storage once you are satisfied.
-- ---------------------------------------------------------------------------
-- with referenced as (
--   select a->>'path' as path
--     from public.pcp_records r,
--          lateral jsonb_array_elements(coalesce(r.data->'attachments','[]'::jsonb)) a
--    where a ? 'path'
--   union
--   select data->>'path' from public.pcp_records where data ? 'path'
-- )
-- select o.name, pg_size_pretty((o.metadata->>'size')::bigint) as bytes, o.created_at
--   from storage.objects o
--  where o.bucket_id = 'pcf-receipts'
--    and o.name not in (select path from referenced where path is not null)
--  order by o.created_at;
