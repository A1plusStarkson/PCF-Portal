-- ============================================================================
-- PCF Portal — SERIES PREVIEW: show the next number on a New form
--
-- Run AFTER Part A of supabase-series-guard.sql. Safe to re-run.
--
-- pcp_peek_series_no(prefix) returns the number the next save in that series
-- will most likely get (e.g. 'PCR-M-2026-0047'). It only READS: nothing is
-- issued, reserved or registered, so opening and cancelling a form never
-- uses up a number. The number is still issued by pcp_issue_series_no on
-- save; if someone else saves first, the app says which number was given.
-- ============================================================================

create or replace function public.pcp_peek_series_no(p_prefix text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  n         bigint;
  candidate text;
begin
  if p_prefix is null or p_prefix !~ '^(PCR|RMB|RPL)-[A-Z0-9]+-[0-9]{4}-$' then
    raise exception 'PCF_SERIES: invalid series prefix %', p_prefix using errcode = 'invalid_parameter_value';
  end if;
  select coalesce(max(last_no), 0) + 1 into n from pcp_series_counters where prefix = p_prefix;
  loop
    candidate := p_prefix || lpad(n::text, greatest(4, length(n::text)), '0');
    exit when not exists (select 1 from pcp_series_registry where no = upper(candidate));
    n := n + 1;
  end loop;
  return candidate;
end;
$$;

revoke all on function public.pcp_peek_series_no(text) from public, anon;
grant execute on function public.pcp_peek_series_no(text) to authenticated;

notify pgrst, 'reload schema';

select 'Series preview is ON' as status;
