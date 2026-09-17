-- ============================================================================
-- PCF Portal — Supabase project setup
-- Run this ONCE in the Supabase SQL editor of the target project
-- (currently: https://soyxjaqshuunweqbvjzb.supabase.co).
--
-- Safe to re-run: every statement is idempotent and none of them touch
-- existing rows.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

-- Coarse whole-state blob: offline cache seed + rolling recovery snapshots.
create table if not exists public.pcp_state (
  key        text primary key,
  value      text,
  updated_at timestamptz not null default now()
);

-- Per-record store: one row per transaction, so concurrent users never
-- overwrite each other. This is the table the app actually relies on;
-- without it the portal shows a "Database setup incomplete" banner.
create table if not exists public.pcp_records (
  id         text primary key,
  collection text        not null,
  data       jsonb       not null,
  deleted    boolean     not null default false,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. Indexes
--    The loader pages through pcp_records filtered by `deleted` and ordered by
--    `id`, so give it an index that matches that access pattern.
-- ---------------------------------------------------------------------------
create index if not exists pcp_records_collection_idx
  on public.pcp_records (collection);

create index if not exists pcp_records_deleted_id_idx
  on public.pcp_records (deleted, id);

-- ---------------------------------------------------------------------------
-- 3. Row Level Security — signed-in users only
--    The publishable key in index.html is public by design; RLS is what
--    actually protects the data. Anonymous (not-signed-in) callers get nothing.
-- ---------------------------------------------------------------------------
alter table public.pcp_state   enable row level security;
alter table public.pcp_records enable row level security;

drop policy if exists "pcp_state authenticated"   on public.pcp_state;
drop policy if exists "pcp_records authenticated" on public.pcp_records;

create policy "pcp_state authenticated" on public.pcp_state
  for all to authenticated using (true) with check (true);

create policy "pcp_records authenticated" on public.pcp_records
  for all to authenticated using (true) with check (true);

-- Table-level privileges (Supabase normally grants these by default; explicit
-- here so the script also works on projects with tightened defaults).
grant select, insert, update, delete on public.pcp_state   to authenticated;
grant select, insert, update, delete on public.pcp_records to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Verify
-- ---------------------------------------------------------------------------
select tablename, rowsecurity
from pg_tables
where schemaname = 'public' and tablename in ('pcp_state', 'pcp_records');

select tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public' and tablename in ('pcp_state', 'pcp_records');
