-- ==============================================================================
-- DOMINIO 05: INTEGRACIONES DE PLATAFORMAS (STEAM, CONSOLAS, ITCH, DISCORD)
-- Savestate Schema Consolidado (Fase 2)
-- ==============================================================================

-- 1. Steam Sync y Límites de Tasa
create table if not exists public.steam_sync_limits (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  last_synced_at timestamptz not null
);

alter table public.steam_sync_limits enable row level security;
create policy steam_sync_limits_owner on public.steam_sync_limits
  for select to authenticated using (user_id = (select auth.uid()));

-- Guardián de cuenta Steam para evitar duplicidades cruzadas entre perfiles
create table if not exists public.steam_account_guards (
  steam_id text primary key check (steam_id ~ '^[0-9]{17}$'),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  claimed_at timestamptz not null default now()
);

alter table public.steam_account_guards enable row level security;
create policy steam_guard_read on public.steam_account_guards for select using (true);

-- 2. Itch.io Trackers & Monitoring
create table if not exists public.itch_trackers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  metadata jsonb not null check (jsonb_typeof(metadata) = 'object'),
  url text not null check (url ~ '^https://[a-z0-9][a-z0-9-]*\.itch\.io/[a-z0-9][a-z0-9-]*$'),
  current_played_version text not null default '' check (length(current_played_version) <= 80),
  status text not null default 'playing' check (status in ('playing', 'waiting_update', 'completed', 'on_hold')),
  milestones jsonb not null default '[]' check (jsonb_typeof(milestones) = 'array' and jsonb_array_length(milestones) <= 50),
  private_notes text not null default '' check (length(private_notes) <= 5000),
  last_checked_at timestamptz not null default now(),
  unique (user_id, url)
);

create index if not exists itch_trackers_check_order on public.itch_trackers(last_checked_at, id);
alter table public.itch_trackers enable row level security;

create policy itch_owner_read on public.itch_trackers for select to authenticated using (user_id = (select auth.uid()));
create policy itch_owner_edit on public.itch_trackers for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy itch_owner_delete on public.itch_trackers for delete to authenticated using (user_id = (select auth.uid()));

create table if not exists public.itch_monitor_state (
  id boolean primary key default true check (id),
  lock_token uuid,
  locked_until timestamptz,
  last_run_at timestamptz,
  last_success_at timestamptz
);

alter table public.itch_monitor_state enable row level security;

-- 3. Discord Bridge & Media Limits
create table if not exists public.discord_message_limits (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  last_sent_at timestamptz not null
);

alter table public.discord_message_limits enable row level security;

create table if not exists public.discord_private_media_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  media_path text not null,
  token text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_discord_tokens_expiry on public.discord_private_media_tokens(expires_at);
alter table public.discord_private_media_tokens enable row level security;

-- 4. Funciones Auxiliares de Integración
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
end;
$$;
