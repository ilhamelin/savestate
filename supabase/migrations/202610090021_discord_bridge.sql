begin;
create table if not exists public.discord_message_limits (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  last_sent_at timestamptz not null
);
alter table public.discord_message_limits enable row level security;
revoke all on public.discord_message_limits from public, anon, authenticated;

create or replace function public.claim_discord_message_slot()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_last timestamptz;
  v_now timestamptz;
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  -- One row lock serializes concurrent requests across all serverless instances.
  insert into public.discord_message_limits(user_id, last_sent_at)
    values(v_user, '-infinity') on conflict(user_id) do nothing;
  select last_sent_at into v_last from public.discord_message_limits
    where user_id = v_user for update;
  v_now := clock_timestamp();
  if v_last > v_now - interval '3 seconds' then
    return greatest(1, ceil(extract(epoch from (v_last + interval '3 seconds' - v_now)))::integer);
  end if;
  update public.discord_message_limits set last_sent_at = v_now where user_id = v_user;
  return 0;
end; $$;
revoke all on function public.claim_discord_message_slot() from public, anon;
grant execute on function public.claim_discord_message_slot() to authenticated;
commit;
