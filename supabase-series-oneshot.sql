-- ============================================================================
-- PCF Portal — SERIES MIGRATION + GUARD, IN ONE RUN
--
-- Combines supabase-renumber-series-per-plant.sql (Sections 1-5) with
-- supabase-series-guard.sql PART B, as a single all-or-nothing transaction.
--
-- PREREQUISITE: supabase-series-guard.sql PART A has already been run.
--
-- ALL OR NOTHING. Every check that the step-by-step scripts ask you to read
-- with your eyes is an assertion here. If any of them fails, the whole run
-- rolls back and the database is exactly as it was — no records renumbered,
-- no trigger created. Nothing is left half-done.
--
-- That means a failure ends with NOTHING applied. If it stops on the
-- POST-CHECK, some live records carry a number registered to a different
-- record and this script cannot know which one should keep it. Resolve those
-- by hand, then run this again.
--
-- Safe to re-run. The backup is made once and never overwritten.
--
-- QUIET WINDOW: everyone OUT of the portal. An open, stale tab that saves a
-- record writes its old number back and re-creates a collision.
--
-- The Supabase SQL editor does NOT show NOTICE output, so when a check fails
-- it names the offending records inside the error message itself. (Progress
-- notices are only visible if you run this through psql.)
-- ============================================================================

begin;

set local statement_timeout = '600s';

-- ---------------------------------------------------------------- PREFLIGHT
do $$
begin
  if to_regclass('public.pcp_series_registry') is null
     or to_regclass('public.pcp_series_counters') is null then
    raise exception 'PREFLIGHT: run supabase-series-guard.sql PART A first.';
  end if;
  if to_regproc('public.pcp_claim_series_no') is null then
    raise exception 'PREFLIGHT: pcp_claim_series_no is missing — run PART A first.';
  end if;
  raise notice 'PREFLIGHT ok — % numbers already registered.',
    (select count(*) from public.pcp_series_registry);
end $$;


-- ------------------------------------------------------------------ 1. BACKUP
-- Made once. If it already exists it is LEFT ALONE, so it always holds the
-- original pre-migration rows.
create schema if not exists pcp_backup;

create table if not exists pcp_backup.records_series_20260926 as
  select * from public.pcp_records
   where collection in ('requests', 'disbursements', 'reimbursements', 'replenishments');

do $$
begin
  raise notice 'BACKUP holds % rows.',
    (select count(*) from pcp_backup.records_series_20260926);
end $$;


-- -------------------------------------------------------------------- 2. PLAN
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
  step       int  not null,
  collection text not null,
  id         text not null,
  old_no     text,
  new_no     text not null,
  exact      boolean not null,
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
-- per plant + year in their existing order, AFTER the series' counter.
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

do $$
declare r record;
begin
  raise notice 'PLAN — % records will be renumbered:',
    (select count(*) from pcp_backup.series_plan_20260926);
  for r in select collection, count(*) as n
             from pcp_backup.series_plan_20260926 group by 1 order by 1 loop
    raise notice '    % : %', rpad(r.collection, 16), r.n;
  end loop;
end $$;


-- ------------------------------------------------------- 3. PRE-CHECK (was 3c)
-- A record needing an EXACT number whose number is already issued elsewhere.
do $$
declare
  r     record;
  n     int := 0;
  extra int := 0;
  lines text := '';
begin
  for r in
    select p.collection, p.new_no, p.id, g.record_id as issued_to
      from pcp_backup.series_plan_20260926 p
      join public.pcp_series_registry g on g.no = upper(p.new_no)
     where p.exact and g.record_id <> p.id
     order by 1, 2
  loop
    n := n + 1;
    if n <= 20 then
      lines := lines || chr(10) || '  ' || rpad(r.new_no, 22) || ' wanted by '
                     || rpad(r.collection, 15) || ' record ' || r.id
                     || '  but issued to ' || r.issued_to;
    else
      extra := extra + 1;
    end if;
  end loop;
  if n > 0 then
    if extra > 0 then
      lines := lines || chr(10) || '  … and ' || extra || ' more';
    end if;
    raise exception 'PRE-CHECK: % planned number(s) are already issued to another record. Nothing was changed.%',
      n, lines;
  end if;
  raise notice 'PRE-CHECK ok — every exact number is free.';
end $$;


-- ------------------------------------------------------------------- 4. APPLY
do $$
declare
  p   record;
  got text;
  n   int := 0;
begin
  for p in select * from pcp_backup.series_plan_20260926 order by step, new_no loop
    got := public.pcp_claim_series_no(p.new_no, p.collection, p.id, p.exact);
    if got = '' then
      raise exception '% is already issued to another record. Nothing was changed.', p.new_no;
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
    n := n + 1;
  end loop;

  -- Counters move past everything just claimed, so the app continues after it.
  insert into public.pcp_series_counters (prefix, last_no)
  select substring(display_no from '^(.*-)[0-9]+$'), max(substring(display_no from '([0-9]+)$')::bigint)
    from public.pcp_series_registry
   where display_no ~ '^(PCR|RMB|RPL)-[A-Z0-9]+-[0-9]{4}-[0-9]+$'
   group by 1
  on conflict (prefix) do update set last_no = greatest(pcp_series_counters.last_no, excluded.last_no), updated_at = now();

  raise notice 'APPLY ok — % records renumbered.', n;
end $$;


-- ------------------------------------------------------- 5. REGISTER STRAGGLERS
-- Anything written since PART A that is not yet in the registry (PART B's
-- re-backfill). Live records win over deleted ones on the same number.
insert into public.pcp_series_registry (no, display_no, collection, record_id, issued_by)
select distinct on (upper(btrim(data->>public.pcp_series_field(collection))))
       upper(btrim(data->>public.pcp_series_field(collection))),
       btrim(data->>public.pcp_series_field(collection)),
       collection, id::text, 'backfill'
  from public.pcp_records
 where public.pcp_series_field(collection) is not null
   and coalesce(btrim(data->>public.pcp_series_field(collection)), '') <> ''
 order by upper(btrim(data->>public.pcp_series_field(collection))), deleted, updated_at
on conflict (no) do nothing;


-- ----------------------------------------- 6. POST-CHECK (was 5a, 5b and the
--                                              PART B gate — one check, enforced)
-- The offenders are named IN THE ERROR MESSAGE, because the Supabase SQL
-- editor does not display NOTICE output.
do $$
declare
  r     record;
  n     int := 0;
  extra int := 0;
  lines text := '';
begin
  for r in
    with live as (
      select p.id::text as record_id, p.collection,
             btrim(p.data->>public.pcp_series_field(p.collection)) as number
        from public.pcp_records p
       where public.pcp_series_field(p.collection) is not null and not p.deleted
         and coalesce(btrim(p.data->>public.pcp_series_field(p.collection)), '') <> ''
    ),
    flagged as (
      select l.*,
             count(*) over (partition by upper(l.number)) as live_copies,
             g.record_id as registered_to
        from live l
        left join public.pcp_series_registry g on g.no = upper(l.number)
    )
    select case when live_copies > 1         then 'DUPLICATE   '
                when registered_to is null   then 'UNREGISTERED'
                else                              'CONFLICT    ' end as issue,
           number, collection, record_id,
           coalesce(registered_to, '-') as registered_to
      from flagged
     where live_copies > 1 or registered_to is distinct from record_id
     order by number, record_id
  loop
    n := n + 1;
    if n <= 20 then
      lines := lines || chr(10) || '  ' || r.issue || ' ' || rpad(r.number, 22)
                     || ' ' || rpad(r.collection, 15) || ' record ' || r.record_id
                     || '  registered to ' || r.registered_to;
    else
      extra := extra + 1;
    end if;
  end loop;

  if n > 0 then
    if extra > 0 then
      lines := lines || chr(10) || '  … and ' || extra || ' more';
    end if;
    raise exception 'POST-CHECK: % live record(s) still share a number. EVERYTHING HAS BEEN ROLLED BACK — nothing was renumbered and the guard was NOT created.%',
      n, lines;
  end if;
  raise notice 'POST-CHECK ok — every live record owns its number.';
end $$;


-- --------------------------------------------------------- 7. THE GUARD TRIGGER
create or replace function public.pcp_series_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  fld   text := public.pcp_series_field(new.collection);
  num   text;
  owner text;
begin
  if fld is null then
    return new;
  end if;
  num := btrim(coalesce(new.data->>fld, ''));
  if num = '' then
    return new;
  end if;
  insert into pcp_series_registry (no, display_no, collection, record_id, issued_by)
    values (upper(num), num, new.collection, new.id::text, lower(coalesce(auth.jwt()->>'email', 'system')))
    on conflict (no) do nothing;
  if not found then
    select record_id into owner from pcp_series_registry where no = upper(num);
    if owner is distinct from new.id::text then
      raise exception 'PCF_SERIES_DUPLICATE: % has already been issued to another transaction.', num
        using errcode = 'unique_violation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists pcp_series_guard on public.pcp_records;
create trigger pcp_series_guard
  before insert or update on public.pcp_records
  for each row execute function public.pcp_series_guard();

do $$ begin raise notice 'SERIES GUARD IS ON.'; end $$;

commit;


-- ============================================================================
-- RESULT  (read-only — runs after the commit)
-- ============================================================================
select 'Series guard is ON' as status,
       (select count(*) from public.pcp_series_registry)      as numbers_registered,
       (select count(*) from pcp_backup.series_plan_20260926) as records_renumbered;

-- Your paper trail. EXPORT THIS.
select collection, old_no, new_no
  from pcp_backup.series_plan_20260926 order by step, new_no;

-- Per series: numbers issued and where the counter stands. Gaps are expected —
-- every deleted number stays retired.
select s.series, count(*) as numbers_issued, c.last_no as counter
  from (select substring(display_no from '^(.*-)[0-9]+$') as series
          from public.pcp_series_registry
         where display_no ~ '^(PCR|RMB|RPL)-[A-Z0-9]+-[0-9]{4}-[0-9]+$') s
  left join public.pcp_series_counters c on c.prefix = s.series
 group by s.series, c.last_no order by s.series;

-- Live records this script leaves alone. Review; not an error by itself.
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
-- UNDO  (commented out on purpose; only after a SUCCESSFUL run)
--   Restores every migrated row verbatim from the backup. The new numbers stay
--   in the registry, retired — undo never frees a number. The guard does NOT
--   need to be dropped: each old number is still registered to its own record,
--   so writing it back passes.
-- ============================================================================
-- begin;
-- update public.pcp_records p
--    set data = b.data, deleted = b.deleted, updated_at = now()
--   from pcp_backup.records_series_20260926 b
--  where p.id = b.id and p.collection = b.collection
--    and exists (select 1 from pcp_backup.series_plan_20260926 s
--                 where s.collection = p.collection and s.id = p.id::text);
-- commit;
