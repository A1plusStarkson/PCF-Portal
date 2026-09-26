-- ============================================================================
-- PCF Portal — PER-PLANT SERIES FOR EVERY MODULE (one-time migration)
--
-- Brings the records that already exist onto the numbering the app now
-- issues: one series per MODULE x PLANT x YEAR, each number issued ONCE.
--
--   Module               New format            Was
--   Petty Cash Request   PCR-M-2026-0001       PCR-M-2026-0001 (RG: PCR-RG-…)
--   Release Ledger       PCV-M-2026-0001       PCV-2026-0001   (one run, all plants)
--   Reimbursement        RMB-M-2026-0001       REIM-2026-000001 (one run, all plants)
--   Replenishment        RPL-M-2026-0001       PCRP-2026-0001  (one run, all plants)
--
--   Plant letters: Manila M · Disney D · Warner W · RG & Co RGC
--   (sub-branches file under their plant: Hasbro is Manila, D6 is Disney).
--
-- NO NUMBER IS EVER REUSED. This script never closes gaps and never hands a
-- number that was already issued — to a live OR a deleted record — to
-- anything else. Every new number is claimed in pcp_series_registry
-- (supabase-series-guard.sql); if any claim fails, the whole apply rolls back.
--
--   Requests         Only RG & Co changes: PCR-RG-2026-0005 -> PCR-RGC-2026-0005
--                    (same sequence). Every other request keeps its number,
--                    gaps and all.
--   Vouchers         Take their request's number: PCR-M-2026-0007 ->
--                    PCV-M-2026-0007. If that voucher number was already
--                    issued (a re-release after a delete), it gets a suffix:
--                    PCV-M-2026-0007-1.
--   Reimbursements,  Numbered per plant in their existing order, continuing
--   Replenishments   after anything the app has already issued in that series.
--
-- Every renumbered record keeps its old number in data.numberHistory (shown
-- as "was …" in the portal). The old number stays registered to it, retired.
--
-- NOT TOUCHED: deleted records (tombstones), liquidations (no number of their
-- own), hand-typed request numbers, vouchers whose request is missing.
--
-- PREREQUISITES
--   * supabase-series-guard.sql PART A has been run.
--   * The new app is deployed and everyone has reloaded.
--   * Quiet window: everyone OUT of the portal while this runs — an open,
--     stale tab that saves a record would write its old number back.
--
-- HOW TO RUN (Supabase SQL editor)
--   The editor does not hold a transaction open between Run clicks. Run each
--   section on its own, in order, and read its result before going on.
--     1. Backup   2. Plan   3. Preview + checks   4. Apply   5. Verify   6. Undo
--   Then run supabase-series-guard.sql PART B.
-- ============================================================================


-- ============================================================================
-- SECTION 1 — BACKUP  (run once; fails on purpose if the backup already exists,
--                      so a re-run can never overwrite the original copy)
-- ============================================================================
create schema if not exists pcp_backup;

create table pcp_backup.records_series_20260926 as
  select * from public.pcp_records
   where collection in ('requests', 'disbursements', 'reimbursements', 'replenishments');

select collection, count(*) as rows_backed_up,
       count(*) filter (where deleted) as of_which_deleted
  from pcp_backup.records_series_20260926
 group by collection order by collection;


-- ============================================================================
-- SECTION 2 — PLAN  (old -> new for every live record that changes)
--   This table IS what Section 4 applies. Safe to re-run: it is rebuilt from
--   scratch, reading the counters as they stand now.
-- ============================================================================
-- Plant letters. Keep in step with PLANT_FAMILIES / PLANT_SERIES_LETTER in
-- src/05-master-data.jsx.
create or replace function pcp_backup.series_plant(branch text)
returns text language sql immutable as $$
  select case
    when branch in ('A1+', 'EURASIA', 'HASBRO', 'SITIO', 'MATTEL', 'PERULANDIA') then 'M'
    when branch = 'WARNER'                                                      then 'W'
    when branch in ('ST', 'D1', 'D2', 'D3', 'D5', 'D6', 'D7', 'D8', 'D9')        then 'D'
    when branch = 'RG'                                                          then 'RGC'
    else coalesce(nullif(upper(regexp_replace(btrim(branch), '[^A-Za-z0-9]', '', 'g')), ''), 'UNKNOWN')
  end
$$;

create or replace function pcp_backup.series_pad(n bigint)
returns text language sql immutable as $$
  select lpad(n::text, greatest(4, length(n::text)), '0')
$$;

drop table if exists pcp_backup.series_plan_20260926;
create table pcp_backup.series_plan_20260926 (
  step       int  not null,     -- apply order: requests, then vouchers, then the rest
  collection text not null,
  id         text not null,
  old_no     text,
  new_no     text not null,
  exact      boolean not null,  -- false: a voucher may take a "-1" suffix
  primary key (collection, id)
);

-- 2a. RG & Co requests: RG -> RGC, same sequence.
insert into pcp_backup.series_plan_20260926
select 1, 'requests', id::text, data->>'requestNo',
       regexp_replace(data->>'requestNo', '^PCR-RG-', 'PCR-RGC-'), true
  from public.pcp_records
 where collection = 'requests' and not deleted
   and data->>'requestNo' ~ '^PCR-RG-[0-9]{4}-[0-9]+$';

-- 2b. Vouchers: their request's (new) number, PCR- -> PCV-.
insert into pcp_backup.series_plan_20260926
select 2, 'disbursements', d.id::text, d.data->>'voucherNo', target, false
  from (
    select d.id, d.data,
           case when coalesce(pl.new_no, r.data->>'requestNo') ~ '^PCR-'
                then 'PCV-' || substr(coalesce(pl.new_no, r.data->>'requestNo'), 5)
                else 'PCV-' || coalesce(pl.new_no, r.data->>'requestNo') end as target
      from public.pcp_records d
      join public.pcp_records r
        on r.collection = 'requests' and not r.deleted and r.id::text = d.data->>'requestId'
      left join pcp_backup.series_plan_20260926 pl
        on pl.collection = 'requests' and pl.id = r.id::text
     where d.collection = 'disbursements' and not d.deleted
       and btrim(coalesce(r.data->>'requestNo', '')) <> ''
  ) d
 where d.data->>'voucherNo' is distinct from d.target;

-- 2c/2d. Reimbursements and replenishments still on an old format: numbered
-- per plant + year in their existing order, AFTER the series' counter (so
-- nothing the app has issued since the deploy can be met).
insert into pcp_backup.series_plan_20260926
select 3, collection, id, old_no,
       prefix || pcp_backup.series_pad(
         coalesce((select c.last_no from public.pcp_series_counters c where c.prefix = s.prefix), 0)
         + row_number() over (partition by prefix order by seq, created, id)),
       true
  from (
    select collection, id::text as id,
           data->>public.pcp_series_field(collection) as old_no,
           (case collection when 'reimbursements' then 'RMB-' else 'RPL-' end)
             || pcp_backup.series_plant(data->>'branchCode') || '-'
             || coalesce(substring(data->>public.pcp_series_field(collection) from '-([0-9]{4})-[0-9]+$'),
                         substring(coalesce(data->>'createdAt', data->>'requestDate', data->>'date', '') from '^([0-9]{4})'),
                         '2026') || '-'                                             as prefix,
           coalesce(substring(data->>public.pcp_series_field(collection) from '([0-9]+)$')::bigint, 0) as seq,
           coalesce(data->>'createdAt', data->>'requestDate', data->>'date', '')      as created
      from public.pcp_records
     where collection in ('reimbursements', 'replenishments') and not deleted
       and coalesce(data->>public.pcp_series_field(collection), '') !~ '^(RMB|RPL)-[A-Z0-9]+-[0-9]{4}-[0-9]+$'
  ) s;

select collection, count(*) as will_change
  from pcp_backup.series_plan_20260926 group by collection order by collection;


-- ============================================================================
-- SECTION 3 — PREVIEW AND SAFETY CHECKS  (read-only)
--   3c MUST return 0 rows before you run Section 4.
-- ============================================================================

-- 3a. Per series: how many records, first and last new number.
select collection, substring(new_no from '^(.*-)[0-9]+$') as series,
       count(*) as records, min(new_no) as first_no, max(new_no) as last_no
  from pcp_backup.series_plan_20260926
 group by 1, 2 order by 1, 2;

-- 3b. The full old -> new list. EXPORT THIS — it is your paper trail.
select collection, old_no, new_no from pcp_backup.series_plan_20260926 order by step, new_no;

-- 3c. New numbers already issued to ANOTHER record (live or deleted), for the
--     records that need an exact number. MUST BE EMPTY.
select p.collection, p.new_no, r.record_id as already_issued_to, r.collection as in_collection
  from pcp_backup.series_plan_20260926 p
  join public.pcp_series_registry r on r.no = upper(p.new_no)
 where p.exact and r.record_id <> p.id;

-- 3d. Vouchers whose number is already issued elsewhere — informational: they
--     will be given the next free suffix (PCV-…-0007-1).
select p.old_no, p.new_no as wanted, r.record_id as already_issued_to
  from pcp_backup.series_plan_20260926 p
  join public.pcp_series_registry r on r.no = upper(p.new_no)
 where not p.exact and r.record_id <> p.id;

-- 3e. Live records this script leaves alone. Review; not an error by itself.
select p.collection, p.id, btrim(p.data->>public.pcp_series_field(p.collection)) as current_no,
       case p.collection when 'requests' then 'hand-typed request no.' else 'voucher without a live request' end as why
  from public.pcp_records p
 where not p.deleted
   and ((p.collection = 'requests' and coalesce(p.data->>'requestNo', '') !~ '^PCR-[A-Z0-9]+-[0-9]{4}-[0-9]+$')
     or (p.collection = 'disbursements' and not exists (
           select 1 from public.pcp_records r
            where r.collection = 'requests' and not r.deleted and r.id::text = p.data->>'requestId')))
 order by 1, 3;


-- ============================================================================
-- SECTION 4 — APPLY  (run as ONE block; it carries its own commit)
--   Every number is claimed in the registry before it is written. If any
--   exact claim fails, the whole block rolls back and nothing changes.
-- ============================================================================
begin;

do $$
declare
  p   record;
  got text;
begin
  for p in select * from pcp_backup.series_plan_20260926 order by step, new_no loop
    got := public.pcp_claim_series_no(p.new_no, p.collection, p.id, p.exact);
    if got = '' then
      raise exception '% is already issued to another record — see Section 3c. Nothing was changed.', p.new_no;
    end if;
    update public.pcp_records r
       set data = jsonb_set(r.data, array[public.pcp_series_field(p.collection)], to_jsonb(got))
                  || jsonb_build_object('numberHistory',
                       coalesce(r.data->'numberHistory', '[]'::jsonb)
                       || jsonb_build_array(jsonb_build_object(
                            'from', p.old_no, 'to', got,
                            'ts', to_char(now() at time zone 'Asia/Manila', 'YYYY-MM-DD"T"HH24:MI:SS'),
                            'user', 'Per-plant series migration',
                            'reason', 'Per-plant series migration'))),
           updated_at = now()
     where r.collection = p.collection and r.id::text = p.id and not r.deleted;
  end loop;

  -- Counters move past everything just claimed, so the app continues after it.
  insert into public.pcp_series_counters (prefix, last_no)
  select substring(display_no from '^(.*-)[0-9]+$'), max(substring(display_no from '([0-9]+)$')::bigint)
    from public.pcp_series_registry
   where display_no ~ '^(PCR|RMB|RPL)-[A-Z0-9]+-[0-9]{4}-[0-9]+$'
   group by 1
  on conflict (prefix) do update set last_no = greatest(pcp_series_counters.last_no, excluded.last_no), updated_at = now();
end $$;

commit;


-- ============================================================================
-- SECTION 5 — VERIFY  (read-only)
-- ============================================================================

-- 5a. No number is carried by two live records anywhere. MUST BE EMPTY.
select collection, no, count(*) as times
  from (
    select collection, upper(btrim(data->>public.pcp_series_field(collection))) as no
      from public.pcp_records
     where public.pcp_series_field(collection) is not null and not deleted
  ) n
 where coalesce(no, '') <> ''
 group by 1, 2 having count(*) > 1;

-- 5b. Every live record's number is registered to that record. MUST BE EMPTY.
select p.collection, p.id, btrim(p.data->>public.pcp_series_field(p.collection)) as number, r.record_id as registered_to
  from public.pcp_records p
  left join public.pcp_series_registry r on r.no = upper(btrim(p.data->>public.pcp_series_field(p.collection)))
 where public.pcp_series_field(p.collection) is not null and not p.deleted
   and coalesce(btrim(p.data->>public.pcp_series_field(p.collection)), '') <> ''
   and (r.record_id is null or r.record_id <> p.id::text);

-- 5c. Live vouchers that do not carry their request's number (a "-1" suffix
--     after a re-release is expected and fine).
select d.data->>'voucherNo' as voucher_no, r.data->>'requestNo' as request_no
  from public.pcp_records d
  join public.pcp_records r on r.collection = 'requests' and not r.deleted and r.id::text = d.data->>'requestId'
 where d.collection = 'disbursements' and not d.deleted
   and d.data->>'voucherNo' not like
       (case when r.data->>'requestNo' ~ '^PCR-' then 'PCV-' || substr(r.data->>'requestNo', 5)
             else 'PCV-' || (r.data->>'requestNo') end) || '%';

-- 5d. Per series: records, and the highest number issued so far. Gaps are
--     expected — every deleted number stays retired.
select s.series, count(*) as numbers_issued, c.last_no as counter
  from (select substring(display_no from '^(.*-)[0-9]+$') as series
          from public.pcp_series_registry
         where display_no ~ '^(PCR|RMB|RPL)-[A-Z0-9]+-[0-9]{4}-[0-9]+$') s
  left join public.pcp_series_counters c on c.prefix = s.series
 group by s.series, c.last_no order by s.series;

-- Next: run supabase-series-guard.sql PART B.


-- ============================================================================
-- SECTION 6 — UNDO  (commented out on purpose)
--   Restores every migrated row verbatim from the Section 1 backup. The NEW
--   numbers stay in the registry, retired — undo never frees a number.
--   Works before or after PART B: each old number is still registered to its
--   own record. Uncomment and run as one block.
-- ============================================================================
-- begin;
-- update public.pcp_records p
--    set data = b.data, deleted = b.deleted, updated_at = now()
--   from pcp_backup.records_series_20260926 b
--  where p.id = b.id and p.collection = b.collection
--    and exists (select 1 from pcp_backup.series_plan_20260926 s
--                 where s.collection = p.collection and s.id = p.id::text);
-- commit;
