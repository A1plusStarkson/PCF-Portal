-- ============================================================================
-- PCF Portal — DELETE GATE (server-side enforcement)
--
-- The portal shows the Delete button, and runs every transaction delete, for
-- ONE account only: superuser@a1plus.com (canDeleteTxn in src/19-app.jsx).
-- That is a browser-side control; anyone with a valid session could still
-- mark a record deleted straight through the REST API. This trigger enforces
-- the same rule inside the database:
--
--   A Petty Cash Request, Release Ledger voucher, Liquidation, Reimbursement
--   or Replenishment may only BECOME deleted (deleted going false -> true)
--   when the signed-in user is on the delete list below.
--
-- A delete in the portal is a soft delete: the row stays, with deleted = true
-- (a "tombstone"), and now also carries deletedNo / deletedPlant /
-- deleteReason / deletedBy / deletedAt inside data.
--
-- EXISTING DATA IS NOT TOUCHED. The trigger reads nothing and rewrites
-- nothing; it only rejects a write that newly deletes one of those records.
-- Edits, restores (deleted true -> false) and every other collection pass
-- unchanged. Statements run in the Supabase SQL editor carry no user session
-- and are allowed, so an administrator can still repair data by hand.
--
-- ⚠ WHEN TO RUN
--   Only AFTER the app build with the superuser-only Delete is deployed AND
--   every user has reloaded the portal (Ctrl+F5). A stale tab still running
--   the old build lets any SuperAdmin delete; its delete would be refused
--   here, and because the app saves changes in batches, that tab's other
--   unsaved edits would not land until it is reloaded.
--
-- TO REMOVE:  drop trigger if exists pcp_delete_gate on public.pcp_records;
--             drop function if exists public.pcp_delete_gate();
-- ============================================================================

create or replace function public.pcp_delete_gate()
returns trigger
language plpgsql
as $$
declare
  claims   jsonb  := auth.jwt();
  who      text   := lower(coalesce(auth.jwt()->>'email', ''));
  -- Keep in step with DELETE_ACCOUNT_EMAILS in src/19-app.jsx.
  deleters text[] := array['superuser@a1plus.com'];
begin
  if new.collection not in ('requests', 'disbursements', 'liquidations', 'reimbursements', 'replenishments') then
    return new;
  end if;
  -- Only the moment a live record becomes a tombstone.
  if not coalesce(new.deleted, false) or coalesce(old.deleted, false) then
    return new;
  end if;
  -- SQL editor / server-side maintenance: no user session at all.
  if claims is null then
    return new;
  end if;
  if not (who = any(deleters)) then
    raise exception 'Only the System Superuser can delete transactions.' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

-- UPDATE only: a portal delete is an upsert onto the record's existing row,
-- which fires the UPDATE trigger on conflict. INSERT is left alone so a
-- restore from backup can never be blocked.
drop trigger if exists pcp_delete_gate on public.pcp_records;
create trigger pcp_delete_gate
  before update on public.pcp_records
  for each row execute function public.pcp_delete_gate();

-- Sanity check — deletions so far, and who made them (informational only).
select collection,
       count(*)                                                        as deleted_rows,
       count(*) filter (where coalesce(data->>'deletedBy', '') <> '')  as with_delete_details
  from public.pcp_records
 where collection in ('requests', 'disbursements', 'liquidations', 'reimbursements', 'replenishments')
   and deleted
 group by collection
 order by collection;
