-- ============================================================================
-- PCF Portal — CLEAR TRANSACTION DATA
--
-- Run ONCE in the Supabase SQL editor of the target project
-- (currently: https://soyxjaqshuunweqbvjzb.supabase.co).
--
-- ⚠ REQUIRES THE CLOUD-ONLY BUILD (PCP_SRC_VERSION 20260918a or later).
--   Deploy that first. On the older build a wipe could not be made to stick:
--   the app kept rolling snapshots in every browser and auto-restored them, and
--   the whole-state blob was union-merged with whatever any tab uploaded, so
--   one stale device re-seeded the database for everybody. Both mechanisms are
--   gone, which is why this script is now four plain statements with no
--   tombstones, no ordering tricks and no need to clear anyone's browser.
--
-- ----------------------------------------------------------------------------
-- WHAT IS CLEARED — data only
--   Petty Cash Requests   (requests)
--   Release Ledger        (disbursements)
--   Liquidation           (liquidations)
--   Reimbursement         (reimbursements)
--   Replenishment         (replenishments)
--   Audit Trail           (auditLog)
--   Transaction History   — derived from the above, so it empties with them
--
-- WHAT IS NOT TOUCHED
--   * the pcp_records / pcp_state TABLES, their indexes, RLS and grants
--   * Funds & Master Data, including all beginning balances  (funds)
--   * PCF Documents                                          (documents)
--   * every screen / tab / role in the portal — this is data, not code
--
-- ⚠ THIS CLEARS THE AUDIT TRAIL. Section 1 copies everything first.
-- ⚠ Anyone with the portal open keeps showing what they already loaded until
--   they refresh. With live sync working they converge within a second or two;
--   without it, on their next page load. Either way they cannot put the data
--   back — there is no second store left for a stale tab to write from.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Safety net — a complete pre-wipe copy.
--
--    Deliberately NOT in `public`: a table there is reachable through the REST
--    API, and Supabase's default privileges would hand every signed-in user a
--    readable copy of the data you just cleared. PostgREST only exposes the
--    schemas configured for it, so this schema is unreachable from the app.
--
--    IF NOT EXISTS means a second run never overwrites the original pre-wipe
--    copy with post-wipe (empty) data.
-- ---------------------------------------------------------------------------
create schema if not exists pcf_backup;
revoke all on schema pcf_backup from anon, authenticated;

create table if not exists pcf_backup.pcp_records_prewipe as
  select * from public.pcp_records;

create table if not exists pcf_backup.pcp_state_prewipe as
  select * from public.pcp_state;

-- ---------------------------------------------------------------------------
-- 2. Delete the records. This is the whole wipe — pcp_records is the only
--    store the portal reads. funds and documents are not in the list.
-- ---------------------------------------------------------------------------
delete from public.pcp_records
 where collection in (
         'requests', 'disbursements', 'liquidations',
         'reimbursements', 'replenishments', 'auditLog'
       );

-- ---------------------------------------------------------------------------
-- 3. Empty the legacy pcp_state table.
--
--    Nothing writes it any more, and it is read in exactly one case: a project
--    whose pcp_records table is completely empty, where it is treated as data
--    to migrate. Leave old rows here and that migration would fire the day
--    pcp_records is emptied — quietly restoring everything you just deleted.
--    This also drops the obsolete rolling snapshots from the old build.
-- ---------------------------------------------------------------------------
delete from public.pcp_state;

commit;

-- ---------------------------------------------------------------------------
-- 4. Reclaim the disk the base64 receipt images were using. VACUUM cannot run
--    inside a transaction, so run this line on its own.
-- ---------------------------------------------------------------------------
-- vacuum (analyze) public.pcp_records;


-- ---------------------------------------------------------------------------
-- 5. Verify — every cleared module reads 0. Funds keeps its rows.
-- ---------------------------------------------------------------------------
with modules(sort, collection, label) as (
  values
    (1, 'requests',       'Petty Cash Requests'),
    (2, 'disbursements',  'Release Ledger'),
    (3, 'liquidations',   'Liquidation'),
    (4, 'reimbursements', 'Reimbursement'),
    (5, 'replenishments', 'Replenishment'),
    (6, 'auditLog',       'Audit Trail'),
    (7, 'funds',          'Funds & Master Data'),
    (8, 'documents',      'PCF Documents')
)
select m.label                                   as module,
       count(r.id) filter (where not r.deleted)  as records,
       count(r.id) filter (where r.deleted)      as deleted_markers
  from modules m
  left join public.pcp_records r on r.collection = m.collection
 group by m.sort, m.label
 order by m.sort;

-- pcp_state should be empty.
select count(*) as legacy_state_rows from public.pcp_state;


-- ---------------------------------------------------------------------------
-- 6. What every account is seeing.
--
--    Worth keeping for any "I'm not seeing what they're seeing" report. With
--    one store there is nothing to reconcile: this IS what the portal shows,
--    filtered per account by plant access only. A count here that an account
--    cannot see means a scoping question, not a sync question.
-- ---------------------------------------------------------------------------
select collection, count(*) as records, max(updated_at) as newest_write
  from public.pcp_records
 where not deleted
 group by collection
 order by collection;


-- ============================================================================
-- 7. LATER — drop the pre-wipe copies, once you are certain none of the
--    cleared history is needed again. Until then they are the only way back.
-- ============================================================================
-- drop table if exists pcf_backup.pcp_records_prewipe;
-- drop table if exists pcf_backup.pcp_state_prewipe;
-- drop schema if exists pcf_backup;
