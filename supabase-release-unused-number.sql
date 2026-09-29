-- ============================================================================
-- PCF Portal — RELEASE ONE UNUSED SERIES NUMBER (one-off gap fix)
--
-- Lets the next new transaction in a series take a number that was issued
-- but never used (e.g. a save that did not finish). It REFUSES when the
-- number appears on any record — live or deleted, any module, audit trail
-- included — so a deleted transaction's number is never reused.
--
-- Edit v_no, v_prefix and v_last below, then run in the Supabase SQL Editor.
--   v_no      the number to release                  'PCR-M-2026-0048'
--   v_prefix  its series                             'PCR-M-2026-'
--   v_last    the number just BEFORE it              47
-- The next save in that series gets v_no; numbers already taken after it
-- are skipped automatically.
-- ============================================================================

do $$
declare
  v_no     text   := 'PCR-M-2026-0048';
  v_prefix text   := 'PCR-M-2026-';
  v_last   bigint := 47;
  v_used   int;
begin
  -- Is the number on ANY record (live or deleted, any module, audit trail included)?
  select count(*) into v_used
    from public.pcp_records
   where data::text ilike '%' || v_no || '%';

  if v_used > 0 then
    raise exception '% is on % record(s) (possibly a deleted transaction). Not released — it stays retired.', v_no, v_used;
  end if;

  -- Unused: release it from the permanent registry (lock lifted for this one row only).
  alter table public.pcp_series_registry disable trigger pcp_series_registry_lock;
  delete from public.pcp_series_registry where no = upper(v_no);
  alter table public.pcp_series_registry enable trigger pcp_series_registry_lock;

  -- Step the counter back so the next save gets v_no.
  update public.pcp_series_counters set last_no = v_last, updated_at = now()
   where prefix = v_prefix and last_no > v_last;

  raise notice '% released. The next % transaction will be %.', v_no, v_prefix, v_no;
end $$;
