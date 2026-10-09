begin;
alter table public.profiles
  add column if not exists xp integer not null default 0 check (xp >= 0),
  add column if not exists level integer not null default 1 check (level >= 1),
  add column if not exists equipped_title text not null default 'Insert Coin',
  add column if not exists equipped_frame text not null default 'default';

create table if not exists public.user_xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount integer not null check (amount > 0),
  action text not null,
  reference_id text,
  created_at timestamptz not null default now()
);
create unique index if not exists idx_xp_events_unique_action
  on public.user_xp_events(user_id, action, reference_id) where reference_id is not null;
create index if not exists idx_xp_events_user_date on public.user_xp_events(user_id, created_at);
alter table public.user_xp_events enable row level security;
revoke all on public.user_xp_events from public, anon, authenticated;
grant select on public.user_xp_events to authenticated;
grant all on public.user_xp_events to service_role;
drop policy if exists xp_events_owner on public.user_xp_events;
create policy xp_events_owner on public.user_xp_events for select to authenticated using(user_id = auth.uid());

create or replace function public.award_xp(p_user_id uuid, p_amount integer, p_action text, p_reference_id text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_old_xp integer; v_old_level integer; v_new_xp integer; v_new_level integer; v_expected integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'XP awards require the server role' using errcode = '42501';
  end if;
  v_expected := case p_action when 'cleared' then 150 when 'platinum' then 300 when 'session' then 10
    when 'review' then 75 when 'highlight' then 40 when 'steam_connected' then 200
    when 'psn_connected' then 200 when 'xbox_connected' then 200 else null end;
  if v_expected is null or p_amount is distinct from v_expected or p_reference_id is null
    or length(btrim(p_reference_id)) = 0 or length(p_reference_id) > 200 then
    raise exception 'Invalid XP event' using errcode = '22023';
  end if;
  -- Serializes all XP events per player, including deduplication and daily limits.
  select xp, level into v_old_xp, v_old_level from public.profiles where id = p_user_id for update;
  if not found then raise exception 'Player not found' using errcode = 'P0002'; end if;
  if exists(select 1 from public.user_xp_events where user_id = p_user_id and action = p_action and reference_id = p_reference_id) then
    return jsonb_build_object('success', false, 'reason', 'already_awarded');
  end if;
  if p_action = 'session' and exists(select 1 from public.user_xp_events where user_id = p_user_id and action = 'session'
    and split_part(reference_id, ':', 1) = split_part(p_reference_id, ':', 1) and created_at > now() - interval '30 minutes') then
    return jsonb_build_object('success', false, 'reason', 'session_cooldown');
  end if;
  if p_action = 'highlight' and (select count(*) from public.user_xp_events where user_id = p_user_id and action = 'highlight'
    and created_at >= (date_trunc('day', now() at time zone 'UTC') at time zone 'UTC')) >= 3 then
    return jsonb_build_object('success', false, 'reason', 'daily_limit');
  end if;
  if p_action in ('steam_connected', 'psn_connected', 'xbox_connected') and exists(
    select 1 from public.user_xp_events where user_id = p_user_id and action = p_action) then
    return jsonb_build_object('success', false, 'reason', 'already_awarded');
  end if;
  v_new_xp := v_old_xp + p_amount;
  v_new_level := greatest(1, floor(power(v_new_xp::numeric / 100.0, 1.0 / 1.65))::integer + 1);
  insert into public.user_xp_events(user_id, amount, action, reference_id) values(p_user_id, p_amount, p_action, p_reference_id);
  update public.profiles set xp = v_new_xp, level = v_new_level where id = p_user_id;
  return jsonb_build_object('success', true, 'awarded', p_amount, 'total_xp', v_new_xp, 'level', v_new_level, 'leveled_up', v_new_level > v_old_level);
end; $$;
revoke all on function public.award_xp(uuid, integer, text, text) from public, anon, authenticated;
grant execute on function public.award_xp(uuid, integer, text, text) to service_role;

create or replace function public.validate_equipped_rewards() returns trigger
language plpgsql set search_path = '' as $$
declare v_title_level integer; v_frame_level integer;
begin
  v_title_level := case new.equipped_title when 'Insert Coin' then 1 when 'Button Masher' then 3 when 'Backlog Explorer' then 7
    when 'Cartridge Blower' then 10 when 'Save Scummer' then 20 when 'Speedrunner' then 25
    when 'Achievement Hunter' then 30 when 'Secret Boss' then 40 when 'Final Boss' then 50 else null end;
  v_frame_level := case new.equipped_frame when 'default' then 1 when 'bronze' then 5 when 'famicom' then 10
    when 'neon' then 15 when 'gold' then 20 when 'crt' then 25 when 'platinum' then 30 when 'vaporwave' then 40 when 'boss' then 50 else null end;
  if v_title_level is null or v_frame_level is null or new.level < greatest(v_title_level, v_frame_level) then
    raise exception 'Reward is locked or invalid' using errcode = '23514';
  end if;
  return new;
end; $$;
drop trigger if exists profile_equipped_rewards on public.profiles;
create trigger profile_equipped_rewards before insert or update on public.profiles for each row execute function public.validate_equipped_rewards();
revoke all on function public.validate_equipped_rewards() from public, anon, authenticated;
revoke update(xp, level) on public.profiles from anon, authenticated;
grant update(equipped_title, equipped_frame) on public.profiles to authenticated;
commit;
