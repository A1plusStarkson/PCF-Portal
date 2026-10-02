-- ===========================================================================
-- PCF Portal — 3 MB per-file upload limit on the receipts bucket
-- ===========================================================================
-- The portal already refuses files over 3 MB before uploading them
-- (MAX_UPLOAD_BYTES in src/02-helpers.jsx). This puts the same limit on the
-- bucket itself, so an oversized file is rejected by Supabase Storage even if
-- an old, un-refreshed browser tab skips the check.
--
-- Safe to run more than once. Existing files are not touched.
-- Run in: Supabase Dashboard → SQL Editor.
-- ===========================================================================

update storage.buckets
   set file_size_limit = 3145728   -- 3 MB = 3 * 1024 * 1024 bytes
 where id = 'pcf-receipts';

-- Check: should show 3145728.
select id, file_size_limit from storage.buckets where id = 'pcf-receipts';
