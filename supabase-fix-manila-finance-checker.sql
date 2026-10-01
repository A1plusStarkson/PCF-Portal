-- =============================================================================
-- CORRECTION: Finance Checker = AYESSA MILOSANTOS on existing Manila records
--
-- Owner's instruction (Oct 2026): every Manila transaction that the Finance
-- Department account approved at custodian level was checked by Ayessa
-- Milosantos. Records approved before the Finance Checker dropdown existed
-- carry no checker name, so Grace Gan sees only "Finance Department".
--
-- Run in the Supabase SQL Editor, in two parts:
--   PART A — read-only preview. Run it alone and read the result.
--   PART B — the fix. Run it only if PART A looks right.
--
-- Which records (all must hold):
--   * a liquidation or reimbursement, not deleted
--   * in the Manila plant: branch A1+, EURASIA, HASBRO, SITIO, MATTEL or
--     PERULANDIA (a liquidation's branch is its release voucher's)
--   * its CURRENT custodian approval (review.checkedBy) is the Finance
--     Department account
--   * no Finance Checker on it yet (one picked in the dropdown is never
--     overwritten)
--
-- What PART B changes, on those records only:
--   * review.financeChecker      set to "Ayessa Milosantos"
--   * review.financeCheckerNote  who set it and when ("System correction")
--   * audit trail                one "Finance Checker Assigned" entry each
-- Kept exactly as is: amounts, lines, receipts and attachments, status, the
-- custodian / Accounting / final approval stamps (checkedBy stays "Finance
-- Department", so the two-person rule on final approval is unaffected),
-- batch numbers and every history entry. Nothing is deleted.
-- A full copy of every touched row is saved first in pcf_backup.
-- The portal then shows: "Finance Department (Finance Checker: Ayessa Milosantos)".
-- =============================================================================


-- ============================== PART A — PREVIEW ==============================
with manila as (
  select unnest(array['A1+', 'EURASIA', 'HASBRO', 'SITIO', 'MATTEL', 'PERULANDIA']) as branch
),
candidates as (
  select r.id, r.collection,
         coalesce(r.data->>'reimbNo', d.data->>'voucherNo')              as series_no,
         coalesce(r.data->>'employee', d.data->>'employee')              as employee,
         coalesce(r.data->>'branchCode', d.data->>'branchCode')          as branch,
         coalesce(r.data->>'status', r.data->>'submissionStatus')        as status,
         r.data->'review'->>'checkedBy'                                  as custodian_approved_by,
         r.data->'review'->>'checkedAt'                                  as approved_at,
         coalesce(r.data->'review'->>'financeChecker', '')               as finance_checker_now
    from public.pcp_records r
    left join public.pcp_records d
      on r.collection = 'liquidations' and d.collection = 'disbursements'
     and d.id = r.data->>'disbursementId' and not d.deleted
   where r.collection in ('liquidations', 'reimbursements')
     and not r.deleted
     and lower(btrim(coalesce(r.data->'review'->>'checkedBy', ''))) = 'finance department'
)
select c.*,
       case when c.finance_checker_now <> '' then 'SKIP — already has a Finance Checker'
            else 'WILL SET — Ayessa Milosantos' end as what_happens
  from candidates c
 where c.branch in (select branch from manila)
 order by c.collection, c.series_no;

-- Finance-approved records OUTSIDE Manila (should be none — finance@ has no
-- access to Warner, Disney or RG and Co.). PART B never touches these.
select r.collection, coalesce(r.data->>'reimbNo', d.data->>'voucherNo') as series_no,
       coalesce(r.data->>'branchCode', d.data->>'branchCode') as branch
  from public.pcp_records r
  left join public.pcp_records d
    on r.collection = 'liquidations' and d.collection = 'disbursements'
   and d.id = r.data->>'disbursementId' and not d.deleted
 where r.collection in ('liquidations', 'reimbursements') and not r.deleted
   and lower(btrim(coalesce(r.data->'review'->>'checkedBy', ''))) = 'finance department'
   and coalesce(r.data->>'branchCode', d.data->>'branchCode', '')
       not in ('A1+', 'EURASIA', 'HASBRO', 'SITIO', 'MATTEL', 'PERULANDIA');


-- =============================== PART B — FIX ================================
-- Run from here to the end together.
begin;

create schema if not exists pcf_backup;
create table if not exists pcf_backup.pcp_records_fix_manila_finance_checker as
  select now() as backed_up_at, r.*
    from public.pcp_records r
   where false;

with target as (
  select r.id, r.collection, r.data,
         coalesce(r.data->>'reimbNo', d.data->>'voucherNo') as series_no
    from public.pcp_records r
    left join public.pcp_records d
      on r.collection = 'liquidations' and d.collection = 'disbursements'
     and d.id = r.data->>'disbursementId' and not d.deleted
   where r.collection in ('liquidations', 'reimbursements')
     and not r.deleted
     and lower(btrim(coalesce(r.data->'review'->>'checkedBy', ''))) = 'finance department'
     and coalesce(r.data->'review'->>'financeChecker', '') = ''
     and coalesce(r.data->>'branchCode', d.data->>'branchCode', '')
         in ('A1+', 'EURASIA', 'HASBRO', 'SITIO', 'MATTEL', 'PERULANDIA')
),
backup as (
  insert into pcf_backup.pcp_records_fix_manila_finance_checker
  select now(), r.* from public.pcp_records r where r.id in (select id from target)
  returning id
),
fixed as (
  update public.pcp_records r
     set data = jsonb_set(
                  r.data, '{review}',
                  coalesce(r.data->'review', '{}'::jsonb) || jsonb_build_object(
                    'financeChecker', 'Ayessa Milosantos',
                    'financeCheckerNote', 'Set by system correction on '
                      || to_char(now() at time zone 'Asia/Manila', 'YYYY-MM-DD HH24:MI')
                      || ' (owner''s instruction: Manila Finance approvals were checked by Ayessa Milosantos)')),
         updated_at = now()
    from target t
   where r.id = t.id
  returning r.id, t.collection, t.series_no
)
insert into public.pcp_records (id, collection, data, deleted, updated_at)
select 'aud-FINCHK-' || f.id,
       'auditLog',
       jsonb_build_object(
         'id', 'aud-FINCHK-' || f.id,
         'ts', to_char(now() at time zone 'Asia/Manila', 'YYYY-MM-DD"T"HH24:MI:SS'),
         'user', 'System correction',
         'action', case when f.collection = 'liquidations' then 'Liquidation' else 'Reimbursement' end
                   || ' Finance Checker Assigned',
         'entity', coalesce(f.series_no, f.id),
         'remarks', 'Finance Checker: Ayessa Milosantos · Manila · custodian approval by Finance Department (no other field changed)'),
       false, now()
  from fixed f
on conflict (id) do nothing;

-- Check: every Manila Finance-approved record now names Ayessa Milosantos.
-- Expect still_missing = 0.
select count(*) filter (where coalesce(r.data->'review'->>'financeChecker', '') = '')  as still_missing,
       count(*) filter (where r.data->'review'->>'financeChecker' = 'Ayessa Milosantos') as ayessa
  from public.pcp_records r
  left join public.pcp_records d
    on r.collection = 'liquidations' and d.collection = 'disbursements'
   and d.id = r.data->>'disbursementId' and not d.deleted
 where r.collection in ('liquidations', 'reimbursements') and not r.deleted
   and lower(btrim(coalesce(r.data->'review'->>'checkedBy', ''))) = 'finance department'
   and coalesce(r.data->>'branchCode', d.data->>'branchCode', '')
       in ('A1+', 'EURASIA', 'HASBRO', 'SITIO', 'MATTEL', 'PERULANDIA');

commit;

-- TO UNDO (only if needed): restore the saved copies.
--   update public.pcp_records r set data = b.data, updated_at = now()
--     from pcf_backup.pcp_records_fix_manila_finance_checker b where r.id = b.id;
