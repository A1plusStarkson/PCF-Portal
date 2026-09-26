-- ============================================================================
-- PCF Portal — ACCOUNTING GATE (server-side enforcement)
--
-- The portal already refuses, in every handler, a final approval that lacks
-- the Accounting check. That is a browser-side control: anyone with a valid
-- session can still write a record straight to pcp_records through the REST
-- API. This trigger enforces the same rule inside the database:
--
--   A liquidation / reimbursement may only RECEIVE a final approval
--   (review.finalBy going from empty to set) when
--       review.checkedBy     is set   (Custodian Approved = YES)
--   AND review.acctCheckedBy is set   (Accounting Checked = YES)
--   AND review.batchNo       is set   (Batch Number IS NOT EMPTY)
--   AND the signed-in user is a final approver.
--
--   An Accounting check (review.acctCheckedBy going from empty to set) may
--   only be written by the Accounting account, stamped with its own email.
--
-- EXISTING DATA IS NOT TOUCHED. The trigger reads nothing and rewrites
-- nothing; it only fires on writes, and only rejects a write that newly sets
-- a final approval or an Accounting check. Records final-approved before this
-- step existed keep their approval, and every other edit passes unchanged.
--
-- ⚠ WHEN TO RUN
--   Only AFTER the app build with the Accounting review is deployed AND every
--   user has reloaded the portal (Ctrl+F5). The app saves changes in batches;
--   if a stale, pre-update tab sends a final approval without the Accounting
--   check, the whole batch it was saved with is refused and retried, so that
--   tab's other unsaved edits would not land until it is reloaded.
--
-- TO REMOVE:  drop trigger if exists pcp_accounting_gate on public.pcp_records;
--             drop function if exists public.pcp_accounting_gate();
-- ============================================================================

create or replace function public.pcp_accounting_gate()
returns trigger
language plpgsql
as $$
declare
  new_rv   jsonb := coalesce(new.data->'review', '{}'::jsonb);
  old_rv   jsonb := case when tg_op = 'UPDATE' then coalesce(old.data->'review', '{}'::jsonb) else '{}'::jsonb end;
  who      text  := lower(coalesce(auth.jwt()->>'email', ''));
  -- Keep in step with ACCOUNTING_CHECKER_EMAILS and
  -- LIQUIDATION_FINAL_APPROVER_EMAILS in src/11-liquidation.jsx.
  acct     text[] := array['accounting@a1plus.com'];
  finals   text[] := array['a1plusadmin@a1plus.com', 'superuser@a1plus.com'];
begin
  if new.collection not in ('liquidations', 'reimbursements') or coalesce(new.deleted, false) then
    return new;
  end if;

  -- A final approval being given now.
  if coalesce(new_rv->>'finalBy', '') <> '' and coalesce(old_rv->>'finalBy', '') = '' then
    if coalesce(new_rv->>'checkedBy', '') = ''
       or coalesce(new_rv->>'acctCheckedBy', '') = ''
       or btrim(coalesce(new_rv->>'batchNo', '')) = '' then
      raise exception 'Cannot approve this transaction. The transaction must first be checked and assigned a Batch Number by Accounting.'
        using errcode = 'check_violation';
    end if;
    if not (who = any(finals)) then
      raise exception 'Only the final approver can give final approval.' using errcode = 'insufficient_privilege';
    end if;
  end if;

  -- An Accounting check being recorded now.
  if coalesce(new_rv->>'acctCheckedBy', '') <> '' and coalesce(old_rv->>'acctCheckedBy', '') = '' then
    if not (who = any(acct)) or lower(new_rv->>'acctCheckedBy') <> who then
      raise exception 'Only Accounting can mark a transaction as checked.' using errcode = 'insufficient_privilege';
    end if;
  end if;

  return new;
end;
$$;

-- UPDATE only. Every liquidation and reimbursement is created as a draft and
-- approved by a later update, which is what this guards. INSERT is left alone
-- on purpose so re-seeding or restoring existing, already-approved records
-- from a backup can never be blocked. The app's upsert fires the UPDATE
-- trigger on conflict.
drop trigger if exists pcp_accounting_gate on public.pcp_records;
create trigger pcp_accounting_gate
  before update on public.pcp_records
  for each row execute function public.pcp_accounting_gate();

-- Sanity check — how many records each rule would currently concern
-- (informational only; the trigger never touches existing rows).
select collection,
       count(*) filter (where coalesce(data->'review'->>'finalBy','') <> '')                                       as final_approved,
       count(*) filter (where coalesce(data->'review'->>'finalBy','') <> ''
                          and coalesce(data->'review'->>'acctCheckedBy','') = '')                                  as final_before_accounting_step,
       count(*) filter (where coalesce(data->'review'->>'acctCheckedBy','') <> '')                                 as accounting_checked
  from public.pcp_records
 where collection in ('liquidations', 'reimbursements') and not deleted
 group by collection;
