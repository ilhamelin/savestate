begin;
create table if not exists public.gatekeeper_attempts (
  key_hash text primary key check (key_hash ~ '^[a-f0-9]{64}$'),
  window_start timestamptz not null,
  attempts integer not null check (attempts > 0)
);
alter table public.gatekeeper_attempts enable row level security;
revoke all on public.gatekeeper_attempts from anon, authenticated;
create index if not exists idx_gatekeeper_attempts_window on public.gatekeeper_attempts(window_start);

create or replace function public.claim_gatekeeper_attempt(p_key_hash text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare attempt_count integer;
begin
  if p_key_hash is null or p_key_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid gatekeeper key';
  end if;
  delete from public.gatekeeper_attempts where window_start < now() - interval '1 day';
  insert into public.gatekeeper_attempts as g (key_hash, window_start, attempts)
    values (p_key_hash, now(), 1)
    on conflict (key_hash) do update set
      attempts = case when g.window_start <= now() - interval '1 minute' then 1 else least(g.attempts + 1, 1000000) end,
      window_start = case when g.window_start <= now() - interval '1 minute' then now() else g.window_start end
    returning attempts into attempt_count;
  return attempt_count <= 5;
end;
$$;
revoke all on function public.claim_gatekeeper_attempt(text) from public, anon, authenticated;
grant execute on function public.claim_gatekeeper_attempt(text) to service_role;
commit;
