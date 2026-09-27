-- ============================================================================
-- PCF Portal — SERIES GUARD: numbers are issued by the database, once, forever
--
-- Rule: once a series number has been issued it is NEVER issued to another
-- transaction — not after a delete, a rejection, an edit, a resubmission, a
-- plant move, or two people saving in the same instant.
--
-- How:
--   pcp_series_counters  One row per series (e.g. 'PCR-M-2026-'). A counter
--                        that only ever goes up. Issuing locks the row, so
--                        simultaneous callers are served one after the other
--                        and always get different numbers.
--   pcp_series_registry  Every number ever issued or used, with the record it
--                        belongs to. Primary key on the number = no duplicate
--                        can exist. Rows are never updated or deleted, so a
--                        deleted transaction's number stays retired.
--   pcp_issue_series_no  Issues the next free number of a series (app: new
--                        request, reimbursement, replenishment, plant move).
--   pcp_claim_series_no  Claims a specific number (app: a voucher taking its
--                        request's number; Accounting's typed Request No.).
--   pcp_series_guard     Trigger on pcp_records: refuses ANY write — from the
--                        app, the API or SQL — that would put a number
--                        registered to one record onto another.
--
-- The registry covers every module at once, so the same number string can
-- never belong to two transactions in different modules either. Each module
-- still counts separately per plant: PCR-M-2026-0001, RMB-M-2026-0001, …
--
-- ORDER OF WORK
--   1. PART A (below) ................ BEFORE deploying the app. The new app
--                                      asks these functions for every number
--                                      and refuses to save without them.
--   2. Deploy the app; everyone reloads (Ctrl+F5).
--   3. supabase-renumber-series-per-plant.sql (quiet window).
--   4. PART B (below) ................ turns on the trigger.
--
-- Parts A and B are each safe to re-run.
--
-- TO REMOVE THE TRIGGER:  drop trigger if exists pcp_series_guard on public.pcp_records;
-- (The registry and counters should be kept — they are the record of every
--  number ever issued.)
-- ============================================================================


-- ############################################################################
-- PART A — counters, registry, issuing functions, backfill   (run as one block)
-- ############################################################################

create table if not exists public.pcp_series_counters (
  prefix     text primary key,
  last_no    bigint not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.pcp_series_registry (
  no          text primary key,          -- upper(btrim(number)): the uniqueness key
  display_no  text not null,             -- the number as written
  collection  text not null,
  record_id   text not null,
  issued_at   timestamptz not null default now(),
  issued_by   text
);
create index if not exists pcp_series_registry_record on public.pcp_series_registry (record_id);

-- Reachable only through the functions below — never directly over the API.
alter table public.pcp_series_counters enable row level security;
alter table public.pcp_series_registry enable row level security;
revoke all on public.pcp_series_counters from anon, authenticated;
revoke all on public.pcp_series_registry from anon, authenticated;

-- The registry is append-only: an issued number can never be released.
create or replace function public.pcp_series_registry_lock()
returns trigger language plpgsql as $$
begin
  raise exception 'PCF_SERIES: the series registry is permanent; issued numbers cannot be changed or released.'
    using errcode = 'insufficient_privilege';
end;
$$;
drop trigger if exists pcp_series_registry_lock on public.pcp_series_registry;
create trigger pcp_series_registry_lock
  before update or delete on public.pcp_series_registry
  for each row execute function public.pcp_series_registry_lock();

-- Where each collection keeps its number. Keep in step with src/19-app.jsx.
create or replace function public.pcp_series_field(p_collection text)
returns text language sql immutable as $$
  select case p_collection
    when 'requests'       then 'requestNo'
    when 'disbursements'  then 'voucherNo'
    when 'reimbursements' then 'reimbNo'
    when 'replenishments' then 'replenishmentNo'
  end
$$;

-- Next free number of a series, bound to one record. Concurrency-safe: the
-- counter row is locked by the upsert until this transaction commits.
create or replace function public.pcp_issue_series_no(p_prefix text, p_collection text, p_record_id text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  n         bigint;
  candidate text;
  tries     int := 0;
begin
  if p_prefix is null or p_prefix !~ '^(PCR|RMB|RPL)-[A-Z0-9]+-[0-9]{4}-$' then
    raise exception 'PCF_SERIES: invalid series prefix %', p_prefix using errcode = 'invalid_parameter_value';
  end if;
  if public.pcp_series_field(p_collection) is null or coalesce(btrim(p_record_id), '') = '' then
    raise exception 'PCF_SERIES: invalid collection or record id' using errcode = 'invalid_parameter_value';
  end if;
  loop
    tries := tries + 1;
    if tries > 100000 then
      raise exception 'PCF_SERIES: could not find a free number in %', p_prefix;
    end if;
    insert into pcp_series_counters as c (prefix, last_no) values (p_prefix, 1)
      on conflict (prefix) do update set last_no = c.last_no + 1, updated_at = now()
      returning c.last_no into n;
    candidate := p_prefix || lpad(n::text, greatest(4, length(n::text)), '0');
    -- Skips any number already registered (e.g. typed by hand earlier).
    insert into pcp_series_registry (no, display_no, collection, record_id, issued_by)
      values (upper(candidate), candidate, p_collection, p_record_id, lower(coalesce(auth.jwt()->>'email', 'system')))
      on conflict (no) do nothing;
    if found then
      return candidate;
    end if;
  end loop;
end;
$$;

-- Claims a specific number for a record. Returns it when free or already this
-- record's; when owned by another record returns '' (p_exact) or tries
-- "<no>-1", "<no>-2", … until one is free.
create or replace function public.pcp_claim_series_no(p_no text, p_collection text, p_record_id text, p_exact boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  base      text := btrim(coalesce(p_no, ''));
  candidate text;
  owner     text;
  k         int := 0;
begin
  if base = '' or length(base) > 80 then
    raise exception 'PCF_SERIES: invalid number' using errcode = 'invalid_parameter_value';
  end if;
  if public.pcp_series_field(p_collection) is null or coalesce(btrim(p_record_id), '') = '' then
    raise exception 'PCF_SERIES: invalid collection or record id' using errcode = 'invalid_parameter_value';
  end if;
  candidate := base;
  loop
    insert into pcp_series_registry (no, display_no, collection, record_id, issued_by)
      values (upper(candidate), candidate, p_collection, p_record_id, lower(coalesce(auth.jwt()->>'email', 'system')))
      on conflict (no) do nothing;
    if found then
      return candidate;
    end if;
    select record_id into owner from pcp_series_registry where no = upper(candidate);
    if owner = p_record_id then
      return candidate;
    end if;
    if p_exact then
      return '';
    end if;
    k := k + 1;
    if k > 1000 then
      raise exception 'PCF_SERIES: could not find a free number near %', base;
    end if;
    candidate := base || '-' || k;
  end loop;
end;
$$;

revoke all on function public.pcp_issue_series_no(text, text, text) from public, anon;
revoke all on function public.pcp_claim_series_no(text, text, text, boolean) from public, anon;
grant execute on function public.pcp_issue_series_no(text, text, text) to authenticated;
grant execute on function public.pcp_claim_series_no(text, text, text, boolean) to authenticated;

-- ---- Backfill: register every number already in the database ----
-- Live records first, so where a live record and a deleted one share a
-- number, the live one keeps it. Deleted records' numbers are registered too:
-- they are retired and can never be issued again.
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

-- ---- Counters start after the highest number already used in each series ----
insert into public.pcp_series_counters (prefix, last_no)
select substring(display_no from '^(.*-)[0-9]+$'), max(substring(display_no from '([0-9]+)$')::bigint)
  from public.pcp_series_registry
 where display_no ~ '^(PCR|RMB|RPL)-[A-Z0-9]+-[0-9]{4}-[0-9]+$'
 group by 1
on conflict (prefix) do update set last_no = greatest(pcp_series_counters.last_no, excluded.last_no), updated_at = now();

-- RG & Co's letters change from RG to RGC. New RGC numbers must continue AFTER
-- the existing RG ones, so the migration can rename PCR-RG-2026-0005 to
-- PCR-RGC-2026-0005 without meeting a number issued in the meantime.
insert into public.pcp_series_counters (prefix, last_no)
select regexp_replace(prefix, '^(PCR|RMB|RPL)-RG-', '\1-RGC-'), last_no
  from public.pcp_series_counters
 where prefix ~ '^(PCR|RMB|RPL)-RG-'
on conflict (prefix) do update set last_no = greatest(pcp_series_counters.last_no, excluded.last_no), updated_at = now();

-- Make the new functions visible to the app's API immediately.
notify pgrst, 'reload schema';

-- Result: the counters, and any LIVE records sharing one number (these must be
-- resolved before Part B — the migration script resolves the vouchers).
select prefix, last_no from public.pcp_series_counters order by prefix;

select p.collection, btrim(p.data->>public.pcp_series_field(p.collection)) as number,
       p.id as record_id, r.record_id as registered_to
  from public.pcp_records p
  join public.pcp_series_registry r on r.no = upper(btrim(p.data->>public.pcp_series_field(p.collection)))
 where public.pcp_series_field(p.collection) is not null and not p.deleted
   and r.record_id <> p.id::text
 order by 1, 2;


-- ############################################################################
-- PART B — the enforcing trigger   (run as one block, AFTER the migration)
-- ############################################################################

-- Re-register anything written since Part A (idempotent).
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

-- Refuses to switch on while a live record carries a number registered to a
-- different record — every edit to that record would then be refused.
do $$
begin
  if exists (
    select 1
      from public.pcp_records p
      join public.pcp_series_registry r on r.no = upper(btrim(p.data->>public.pcp_series_field(p.collection)))
     where public.pcp_series_field(p.collection) is not null and not p.deleted
       and r.record_id <> p.id::text
  ) then
    raise exception 'Live records share a number with another record — see the last query of PART A. Run the migration script first. Trigger NOT created.';
  end if;
end $$;

drop trigger if exists pcp_series_guard on public.pcp_records;
create trigger pcp_series_guard
  before insert or update on public.pcp_records
  for each row execute function public.pcp_series_guard();

select 'Series guard is ON' as status,
       (select count(*) from public.pcp_series_registry) as numbers_registered;
