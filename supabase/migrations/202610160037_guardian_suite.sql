begin;
create table if not exists public.system_broadcasts (
  id uuid primary key default gen_random_uuid(),
  message text not null check (length(btrim(message)) between 1 and 240),
  category text not null check (category in ('info','warning','event')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);
create unique index if not exists system_broadcast_single_active on public.system_broadcasts(active) where active;
alter table public.system_broadcasts enable row level security;
drop policy if exists broadcast_active_read on public.system_broadcasts;
create policy broadcast_active_read on public.system_broadcasts for select to anon,authenticated using(active);
revoke all on public.system_broadcasts from public,anon,authenticated;
grant select on public.system_broadcasts to anon,authenticated;
grant all on public.system_broadcasts to service_role;

create table if not exists public.system_switches (
  key text primary key check(key in ('gatekeeper_enabled','registrations_open','seasonal_theme')),
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint system_switch_value check (
    (key in ('gatekeeper_enabled','registrations_open') and jsonb_typeof(value)='boolean') or
    (key='seasonal_theme' and value in ('"halloween"'::jsonb,'"classic"'::jsonb))
  )
);
alter table public.system_switches enable row level security;
drop policy if exists switches_public_read on public.system_switches;
create policy switches_public_read on public.system_switches for select to anon,authenticated using(true);
revoke all on public.system_switches from public,anon,authenticated;
grant select on public.system_switches to anon,authenticated;
grant all on public.system_switches to service_role;
insert into public.system_switches(key,value) values
('gatekeeper_enabled','false'),('registrations_open','true'),('seasonal_theme','"halloween"')
on conflict(key) do nothing;

create table if not exists public.security_audit_logs (
  id uuid primary key default gen_random_uuid(), event text not null,
  key_hash text check(key_hash is null or key_hash ~ '^[a-f0-9]{64}$'),
  metadata jsonb not null default '{}', created_at timestamptz not null default now()
);
create index if not exists security_audit_recent on public.security_audit_logs(created_at desc);
alter table public.security_audit_logs enable row level security;
revoke all on public.security_audit_logs from public,anon,authenticated;
grant select,insert on public.security_audit_logs to service_role;
grant select on public.gatekeeper_attempts to service_role;

create or replace function public.grant_player_xp(p_target_id uuid,p_amount int)
returns table(new_xp int,new_level int) language plpgsql security definer set search_path='' as $$
declare v_xp int; v_level int;
begin
  if p_amount is null or p_amount<=0 or p_amount>100000 then raise exception 'Cantidad de XP no válida'; end if;
  select xp into v_xp from public.profiles where id=p_target_id for update;
  if not found then raise exception 'Jugador no encontrado'; end if;
  if v_xp>2147483647-p_amount then raise exception 'Límite de XP excedido'; end if;
  v_xp:=v_xp+p_amount;
  v_level:=greatest(1,floor(power(v_xp::numeric/100.0,1.0/1.65))::int+1);
  update public.profiles set xp=v_xp,level=v_level where id=p_target_id;
  insert into public.security_audit_logs(event,metadata) values('player_xp_granted',jsonb_build_object('target_id',p_target_id,'xp',p_amount));
  return query select v_xp,v_level;
end; $$;
revoke all on function public.grant_player_xp(uuid,int) from public,anon,authenticated;
grant execute on function public.grant_player_xp(uuid,int) to service_role;

-- A transaction plus advisory lock guarantees at most one active announcement under concurrent taps.
create or replace function public.guardian_broadcast(p_message text,p_category text,p_active boolean,p_actor uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  perform pg_advisory_xact_lock(37001);
  update public.system_broadcasts set active=false where active;
  if p_active then
    insert into public.system_broadcasts(message,category,created_by) values(p_message,p_category,p_actor) returning id into v_id;
  end if;
  insert into public.security_audit_logs(event,metadata) values('broadcast_changed',jsonb_build_object('actor_id',p_actor,'broadcast_id',v_id,'active',p_active));
  return v_id;
end; $$;
revoke all on function public.guardian_broadcast(text,text,boolean,uuid) from public,anon,authenticated;
grant execute on function public.guardian_broadcast(text,text,boolean,uuid) to service_role;

create or replace function public.guardian_set_switch(p_key text,p_value jsonb,p_actor uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  update public.system_switches set value=p_value,updated_at=now(),updated_by=p_actor where key=p_key;
  if not found then raise exception 'Interruptor no válido'; end if;
  insert into public.security_audit_logs(event,metadata) values('system_switch_changed',jsonb_build_object('actor_id',p_actor,'key',p_key,'value',p_value));
  return true;
end; $$;
revoke all on function public.guardian_set_switch(text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.guardian_set_switch(text,jsonb,uuid) to service_role;

-- Enforce registration policy at the source, including direct OAuth and Auth API signups.
create or replace function public.guardian_registration_guard()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from public.system_switches where key='registrations_open' and value='false'::jsonb) then
    raise exception 'El registro de nuevos usuarios está cerrado.';
  end if;
  return new;
end; $$;
drop trigger if exists guardian_registration_guard on auth.users;
create trigger guardian_registration_guard before insert on auth.users for each row execute function public.guardian_registration_guard();
revoke all on function public.guardian_registration_guard() from public,anon,authenticated;

create or replace function public.guardian_telemetry()
returns jsonb language sql security definer set search_path='' as $$
  select jsonb_build_object(
    'storage_bytes',(select coalesce(sum(file_size),0) from public.user_vault_media),
    'users_total',(select count(*) from public.profiles),
    'users_recent',(select count(distinct user_id) from public.user_games where updated_at>now()-interval '15 minutes')
  );
$$;
revoke all on function public.guardian_telemetry() from public,anon,authenticated;
grant execute on function public.guardian_telemetry() to service_role;

-- Keep the existing atomic limiter and record the first blocked attempt of each window.
create or replace function public.claim_gatekeeper_attempt(p_key_hash text)
returns boolean language plpgsql security definer set search_path='' as $$
declare attempt_count integer;
begin
  if p_key_hash is null or p_key_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid gatekeeper key'; end if;
  delete from public.gatekeeper_attempts where window_start<now()-interval '1 day';
  insert into public.gatekeeper_attempts as g(key_hash,window_start,attempts) values(p_key_hash,now(),1)
  on conflict(key_hash) do update set
    attempts=case when g.window_start<=now()-interval '1 minute' then 1 else least(g.attempts+1,1000000) end,
    window_start=case when g.window_start<=now()-interval '1 minute' then now() else g.window_start end
  returning attempts into attempt_count;
  if attempt_count=6 then insert into public.security_audit_logs(event,key_hash) values('gatekeeper_rate_limited',p_key_hash); end if;
  return attempt_count<=5;
end; $$;
revoke all on function public.claim_gatekeeper_attempt(text) from public,anon,authenticated;
grant execute on function public.claim_gatekeeper_attempt(text) to service_role;
commit;
