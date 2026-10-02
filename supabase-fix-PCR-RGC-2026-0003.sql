-- =============================================================================
-- ONE-RECORD CHECK / CORRECTION: PCR-RGC-2026-0003 (was PCR-RG-2026-0003)
-- Alexander Franco · RG and Co. · request P3,800.00 · status "Disbursed"
--
-- Problem: the request reads DISBURSED, but no voucher (PCV) for it appears in
-- the RG Release Ledger or Liquidation. A release writes TWO records — the
-- voucher, and the request's status — and if the database refused the voucher
-- (for example the series guard: its number already belonged to another
-- record) the request still saved as Disbursed with no voucher behind it.
-- The voucher may also have been deleted, or saved under another plant.
--
-- Run in the Supabase SQL Editor, in two parts:
--   PART A — read-only. Run it alone and read the four results.
--   PART B — the fix. Run it ONLY if PART A says "NO VOUCHER".
--
-- What PART B changes, on this ONE request only:
--   * status  Disbursed -> Approved   (so the custodian can Release it again,
--                                     entering the amount actually given)
--   * statusCorrections  one entry added (who / when / why)
--   * audit trail        one "Request Status Corrected" entry
-- Kept exactly as is: the number, amount, approvals and every other field.
-- A full copy of the row is saved first in pcf_backup.
-- It refuses to change anything if ANY live voucher is linked to the request.
-- =============================================================================


-- ============================== PART A — PREVIEW ==============================

-- 1) The request (live or deleted), with the verdict.
select
  r.id                                              as request_id,
  r.deleted                                         as request_deleted,
  r.data->>'requestNo'                              as request_no,
  r.data->>'status'                                 as status_now,
  r.data->>'employee'                               as employee,
  r.data->>'branchCode'                             as branch,
  r.data->>'amount'                                 as amount,
  r.data->'numberHistory'                           as number_history,
  (select count(*) from public.pcp_records d
    where d.collection = 'disbursements' and not d.deleted
      and d.data->>'requestId' = r.id)              as live_vouchers,
  (select count(*) from public.pcp_records d
    where d.collection = 'disbursements' and d.deleted
      and d.data->>'requestId' = r.id)              as deleted_vouchers,
  case
    when exists (select 1 from public.pcp_records d
                  where d.collection = 'disbursements' and not d.deleted
                    and d.data->>'requestId' = r.id)
      then 'VOUCHER EXISTS — see result 2 (branch / number). PART B will change nothing'
    when exists (select 1 from public.pcp_records d
                  where d.collection = 'disbursements' and d.deleted
                    and d.data->>'requestId' = r.id)
      then 'VOUCHER WAS DELETED — see result 2 (who / why). Tell Claude before running PART B'
    else 'NO VOUCHER — the release never saved. OK to run PART B, then Release it again in the portal'
  end                                               as what_happens
from public.pcp_records r
where r.collection = 'requests'
  and (r.data->>'requestNo' in ('PCR-RGC-2026-0003', 'PCR-RG-2026-0003')
       or r.data->'numberHistory' @> '[{"from": "PCR-RG-2026-0003"}]');

-- 2) Every voucher linked to it, live or deleted.
select d.id, d.deleted, d.data->>'voucherNo' as voucher_no, d.data->>'date' as released,
       d.data->>'branchCode' as branch, d.data->>'amount' as amount, d.data->>'employee' as employee,
       d.data->>'deletedBy' as deleted_by, d.data->>'deletedAt' as deleted_at, d.data->>'deleteReason' as delete_reason
  from public.pcp_records d
 where d.collection = 'disbursements'
   and d.data->>'requestId' in (
         select r.id from public.pcp_records r
          where r.collection = 'requests'
            and (r.data->>'requestNo' in ('PCR-RGC-2026-0003', 'PCR-RG-2026-0003')
                 or r.data->'numberHistory' @> '[{"from": "PCR-RG-2026-0003"}]'));

-- 3) Every voucher for Alexander Franco in ANY plant (in case it was released
--    under another request or plant, e.g. a P3,000 release).
select d.id, d.deleted, d.data->>'voucherNo' as voucher_no, d.data->>'date' as released,
       d.data->>'branchCode' as branch, d.data->>'amount' as amount,
       d.data->>'requestId' as request_id,
       (select q.data->>'requestNo' from public.pcp_records q where q.id = d.data->>'requestId') as for_request
  from public.pcp_records d
 where d.collection = 'disbursements'
   and d.data->>'employee' ilike '%franco%'
 order by d.data->>'date';

-- 4) What the audit trail recorded around it.
select a.data->>'ts' as ts, a.data->>'user' as by_user, a.data->>'action' as action,
       a.data->>'entity' as entity, a.data->>'remarks' as remarks
  from public.pcp_records a
 where a.collection = 'auditLog'
   and (a.data::text ilike '%PCR-RGC-2026-0003%'
        or a.data::text ilike '%PCR-RG-2026-0003%'
        or a.data::text ilike '%PCV-RGC-2026-0003%'
        or a.data::text ilike '%PCV-RG-2026-0003%'
        or (a.data->>'action' = 'Released' and a.data->>'remarks' ilike '%Franco%'))
 order by a.data->>'ts';


-- =============================== PART B — FIX ================================
-- Run from here to the end together — ONLY when PART A said "NO VOUCHER".
begin;

create schema if not exists pcf_backup;
create table if not exists pcf_backup.pcp_records_fix_pcr_rgc_2026_0003 as
  select now() as backed_up_at, r.*
    from public.pcp_records r
   where r.collection = 'requests' and r.data->>'requestNo' = 'PCR-RGC-2026-0003';

with target as (
  select r.id, r.data
    from public.pcp_records r
   where r.collection = 'requests'
     and not r.deleted
     and r.data->>'requestNo' = 'PCR-RGC-2026-0003'
     and r.data->>'status' = 'Disbursed'
     -- Never touch it if a live voucher is linked: then it really was released.
     and not exists (select 1 from public.pcp_records d
                      where d.collection = 'disbursements' and not d.deleted
                        and d.data->>'requestId' = r.id)
),
fixed as (
  update public.pcp_records r
     set data = t.data || jsonb_build_object(
           'status', 'Approved',
           'statusCorrections',
             coalesce(t.data->'statusCorrections', '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
               'ts', to_char(now() at time zone 'Asia/Manila', 'YYYY-MM-DD HH24:MI'),
               'user', 'System correction',
               'from', 'Disbursed',
               'to', 'Approved',
               'reason', 'Read Disbursed but no voucher was ever saved for it; returned to Approved so it can be released again.'))),
         updated_at = now()
    from target t
   where r.id = t.id
  returning r.id
)
insert into public.pcp_records (id, collection, data, deleted, updated_at)
select 'aud-FIXRGC0003-' || to_char(now(), 'YYYYMMDDHH24MISS'),
       'auditLog',
       jsonb_build_object(
         'id', 'aud-FIXRGC0003-' || to_char(now(), 'YYYYMMDDHH24MISS'),
         'ts', to_char(now() at time zone 'Asia/Manila', 'YYYY-MM-DD"T"HH24:MI:SS'),
         'user', 'System correction',
         'action', 'Request Status Corrected',
         'entity', 'PCR-RGC-2026-0003',
         'remarks', 'Disbursed -> Approved · no voucher was ever saved · release it again in the portal'),
       false, now()
  from fixed;

-- Check: expect ONE row with status_now = Approved.
-- If it still says Disbursed, nothing was changed (see PART A's what_happens).
select r.data->>'requestNo' as request_no, r.data->>'status' as status_now
  from public.pcp_records r
 where r.collection = 'requests' and not r.deleted and r.data->>'requestNo' = 'PCR-RGC-2026-0003';

commit;
