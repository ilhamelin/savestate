begin;

-- Durable state is required: Next.js Proxy and route functions do not share memory.
alter table public.system_switches drop constraint if exists system_switches_key_check;
alter table public.system_switches add constraint system_switches_key_check
  check (key in ('gatekeeper_enabled','registrations_open','seasonal_theme','double_xp','defcon_level'));
alter table public.system_switches drop constraint if exists system_switch_value;
alter table public.system_switches add constraint system_switch_value check (
  (key in ('gatekeeper_enabled','registrations_open','double_xp') and jsonb_typeof(value)='boolean') or
  (key='seasonal_theme' and value in ('"halloween"'::jsonb,'"classic"'::jsonb)) or
  (key='defcon_level' and value in ('1'::jsonb,'2'::jsonb,'3'::jsonb,'4'::jsonb,'5'::jsonb))
);
insert into public.system_switches(key,value) values('defcon_level','5') on conflict(key) do nothing;

create table if not exists public.guardian_soc_state (
  singleton boolean primary key default true check(singleton),
  registrations_before boolean,
  gatekeeper_before boolean,
  reason text not null default 'Estado inicial; sin activar restricciones',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
insert into public.guardian_soc_state(singleton) values(true) on conflict do nothing;
alter table public.guardian_soc_state enable row level security;
revoke all on public.guardian_soc_state from public,anon,authenticated;
grant select,insert,update on public.guardian_soc_state to service_role;

create table if not exists public.guardian_threat_ips (
  ip inet primary key check(masklen(ip)=case family(ip) when 4 then 32 else 128 end),
  attempts timestamptz[] not null default '{}',
  reason text not null default '' check(length(reason)<=240),
  quarantined_at timestamptz,
  expires_at timestamptz,
  last_seen_at timestamptz not null default now()
);
create index if not exists guardian_threat_expiry on public.guardian_threat_ips(expires_at) where expires_at is not null;
create index if not exists guardian_threat_last_seen on public.guardian_threat_ips(last_seen_at);
alter table public.guardian_threat_ips enable row level security;
revoke all on public.guardian_threat_ips from public,anon,authenticated;
grant select,insert,update,delete on public.guardian_threat_ips to service_role;

-- Append-only audit; no administrative HTTP action can rewrite or remove events.
create or replace function public.guardian_audit_append_only()
returns trigger language plpgsql set search_path='' as $$
begin raise exception 'El registro de seguridad es de solo anexado'; end; $$;
drop trigger if exists guardian_audit_append_only on public.security_audit_logs;
create trigger guardian_audit_append_only before update or delete on public.security_audit_logs
for each row execute function public.guardian_audit_append_only();
revoke update,delete on public.security_audit_logs from service_role;
revoke all on function public.guardian_audit_append_only() from public,anon,authenticated;

create or replace function public.guardian_soc_snapshot()
returns jsonb language sql security definer set search_path='' as $$
  select jsonb_build_object(
    'level',coalesce((select (value::text)::int from public.system_switches where key='defcon_level'),5),
    'updatedAt',s.updated_at,'updatedBy',s.updated_by,'reason',s.reason,
    'registrationsOpen',coalesce((select value='true'::jsonb from public.system_switches where key='registrations_open'),false),
    'gatekeeperEnabled',coalesce((select value='true'::jsonb from public.system_switches where key='gatekeeper_enabled'),false),
    'quarantinedIps',coalesce((select jsonb_agg(jsonb_build_object(
      'ip',host(q.ip),'reason',q.reason,'attempts',cardinality(q.attempts),
      'quarantinedAt',floor(extract(epoch from q.quarantined_at)*1000),
      'expiresAt',floor(extract(epoch from q.expires_at)*1000)
    )) from public.guardian_threat_ips q where q.expires_at>now()),'[]'::jsonb)
  ) from public.guardian_soc_state s where singleton;
$$;
revoke all on function public.guardian_soc_snapshot() from public,anon,authenticated;
grant execute on function public.guardian_soc_snapshot() to service_role;

create or replace function public.guardian_soc_fail(p_ip inet,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.guardian_threat_ips; v_attempts timestamptz[];
begin
  if p_ip is null or masklen(p_ip)<>(case family(p_ip) when 4 then 32 else 128 end) then raise exception 'IP no válida'; end if;
  perform pg_advisory_xact_lock(hashtextextended(host(p_ip),41001));
  delete from public.guardian_threat_ips where last_seen_at<now()-interval '1 day' and (expires_at is null or expires_at<=now());
  insert into public.guardian_threat_ips(ip) values(p_ip) on conflict do nothing;
  select * into v from public.guardian_threat_ips where ip=p_ip for update;
  if v.expires_at>now() then
    return jsonb_build_object('quarantined',true,'recentCount',cardinality(v.attempts),'expiresAt',floor(extract(epoch from v.expires_at)*1000));
  end if;
  select coalesce(array_agg(t),'{}') into v_attempts from unnest(v.attempts) t where t>now()-interval '60 seconds' and t<=now();
  v_attempts:=array_append(v_attempts,now());
  update public.guardian_threat_ips set attempts=v_attempts,last_seen_at=now(),reason=left(p_reason,240),
    quarantined_at=case when cardinality(v_attempts)>=5 then now() else null end,
    expires_at=case when cardinality(v_attempts)>=5 then now()+interval '15 minutes' else null end
  where ip=p_ip returning * into v;
  if cardinality(v_attempts)>=5 then
    insert into public.security_audit_logs(event,metadata) values('threat_ip_quarantined',jsonb_build_object(
      'ip',host(p_ip),'reason',left(p_reason,240),'durationMinutes',15,'attempts',cardinality(v_attempts),'severity','high','source','automatic'));
  end if;
  return jsonb_build_object('quarantined',cardinality(v_attempts)>=5,'recentCount',cardinality(v_attempts),
    'expiresAt',case when v.expires_at is not null then floor(extract(epoch from v.expires_at)*1000) else null end);
end; $$;
revoke all on function public.guardian_soc_fail(inet,text) from public,anon,authenticated;
grant execute on function public.guardian_soc_fail(inet,text) to service_role;

create or replace function public.guardian_soc_quarantine(p_ip inet,p_action text,p_reason text,p_actor uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if p_actor is null or p_action is null or p_action not in ('block','unblock') or length(btrim(coalesce(p_reason,''))) not between 5 and 240
     or p_ip is null or masklen(p_ip)<>(case family(p_ip) when 4 then 32 else 128 end) then raise exception 'Acción no válida'; end if;
  perform pg_advisory_xact_lock(hashtextextended(host(p_ip),41001));
  if p_action='block' then
    insert into public.guardian_threat_ips(ip,reason,quarantined_at,expires_at,last_seen_at)
    values(p_ip,p_reason,now(),now()+interval '15 minutes',now())
    on conflict(ip) do update set reason=excluded.reason,quarantined_at=excluded.quarantined_at,expires_at=excluded.expires_at,last_seen_at=excluded.last_seen_at;
  else
    delete from public.guardian_threat_ips where ip=p_ip;
  end if;
  insert into public.security_audit_logs(event,metadata) values('soc_ip_'||p_action,jsonb_build_object(
    'ip',host(p_ip),'actor_id',p_actor,'reason',p_reason,'severity',case when p_action='block' then 'high' else 'medium' end));
  return true;
end; $$;
revoke all on function public.guardian_soc_quarantine(inet,text,text,uuid) from public,anon,authenticated;
grant execute on function public.guardian_soc_quarantine(inet,text,text,uuid) to service_role;

create or replace function public.guardian_soc_defcon(p_level int,p_actor uuid,p_reason text)
returns boolean language plpgsql security definer set search_path='' as $$
declare s public.guardian_soc_state; previous int;
begin
  if p_level is null or p_level not between 1 and 5 or p_actor is null or length(btrim(coalesce(p_reason,''))) not between 5 and 240 then raise exception 'Nivel o motivo no válido'; end if;
  perform pg_advisory_xact_lock(41002);
  select * into s from public.guardian_soc_state where singleton for update;
  select (value::text)::int into previous from public.system_switches where key='defcon_level' for update;
  if p_level<=3 and s.registrations_before is null then
    select value='true'::jsonb into s.registrations_before from public.system_switches where key='registrations_open';
  end if;
  if p_level=1 and s.gatekeeper_before is null then
    select value='true'::jsonb into s.gatekeeper_before from public.system_switches where key='gatekeeper_enabled';
  end if;
  update public.system_switches set value=to_jsonb(p_level),updated_by=p_actor,updated_at=now() where key='defcon_level';
  if p_level<=3 then
    update public.system_switches set value='false',updated_by=p_actor,updated_at=now() where key='registrations_open';
  elsif s.registrations_before is not null then
    update public.system_switches set value=to_jsonb(s.registrations_before),updated_by=p_actor,updated_at=now() where key='registrations_open';
    s.registrations_before:=null;
  end if;
  if p_level=1 then
    update public.system_switches set value='true',updated_by=p_actor,updated_at=now() where key='gatekeeper_enabled';
  elsif s.gatekeeper_before is not null then
    update public.system_switches set value=to_jsonb(s.gatekeeper_before),updated_by=p_actor,updated_at=now() where key='gatekeeper_enabled';
    s.gatekeeper_before:=null;
  end if;
  update public.guardian_soc_state set registrations_before=s.registrations_before,gatekeeper_before=s.gatekeeper_before,
    updated_by=p_actor,updated_at=now(),reason=p_reason where singleton;
  insert into public.security_audit_logs(event,metadata) values('defcon_escalation',jsonb_build_object(
    'level',p_level,'previous',previous,'actor_id',p_actor,'reason',p_reason,'severity',case when p_level<=2 then 'critical' when p_level=3 then 'high' else 'low' end));
  return true;
end; $$;
revoke all on function public.guardian_soc_defcon(int,uuid,text) from public,anon,authenticated;
grant execute on function public.guardian_soc_defcon(int,uuid,text) to service_role;

-- Existing switch controls cannot bypass an active DEFCON policy.
create or replace function public.guardian_set_switch(p_key text,p_value jsonb,p_actor uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare level int;
begin
  perform pg_advisory_xact_lock(41002);
  select (value::text)::int into level from public.system_switches where key='defcon_level';
  if p_key='defcon_level' or (level<=3 and p_key='registrations_open' and p_value='true'::jsonb)
    or (level=1 and p_key='gatekeeper_enabled' and p_value='false'::jsonb) then raise exception 'Modifica esta política desde SOC DEFCON'; end if;
  update public.system_switches set value=p_value,updated_at=now(),updated_by=p_actor where key=p_key;
  if not found then raise exception 'Interruptor no válido'; end if;
  insert into public.security_audit_logs(event,metadata) values('system_switch_changed',jsonb_build_object('actor_id',p_actor,'key',p_key,'value',p_value));
  return true;
end; $$;

-- Provider-side registration guard also covers direct Supabase signup/OAuth calls.
create or replace function public.guardian_registration_guard()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from public.system_switches where
    (key='registrations_open' and value='false'::jsonb) or (key='defcon_level' and value in ('1'::jsonb,'2'::jsonb,'3'::jsonb))) then
    raise exception 'El registro de nuevos usuarios está cerrado.';
  end if;
  return new;
end; $$;

-- Enforce read-only for direct client DML as well as the application proxy.
create or replace function public.guardian_defcon_write_guard()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if auth.role() in ('anon','authenticated') and exists(
    select 1 from public.system_switches where key='defcon_level' and value in ('1'::jsonb,'2'::jsonb)
  ) then raise exception 'SaveState está temporalmente en modo solo lectura'; end if;
  if TG_OP='DELETE' then return old; end if;
  return new;
end; $$;
do $$ declare r record;
begin
  for r in select tablename from pg_tables where schemaname='public' and tablename not in
    ('system_switches','system_broadcasts','security_audit_logs','guardian_soc_state','guardian_threat_ips','gatekeeper_attempts','support_telemetry','support_tickets')
  loop
    execute format('drop trigger if exists guardian_defcon_write_guard on public.%I',r.tablename);
    execute format('create trigger guardian_defcon_write_guard before insert or update or delete on public.%I for each row execute function public.guardian_defcon_write_guard()',r.tablename);
  end loop;
end; $$;
revoke all on function public.guardian_defcon_write_guard() from public,anon,authenticated;

create or replace function public.guardian_soc_telemetry()
returns jsonb language sql security definer set search_path='' as $$
  select public.guardian_soc_snapshot() || jsonb_build_object(
    'attacksBlockedToday',(select count(*) from public.security_audit_logs where event='threat_ip_quarantined'
      and created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'),
    'recentThreats',coalesce((select jsonb_agg(t) from
      (select id,event,metadata,created_at from public.security_audit_logs where event like 'threat_%' or event like 'soc_%' or event='defcon_escalation' order by created_at desc limit 20)t),'[]'::jsonb)
  );
$$;
revoke all on function public.guardian_soc_telemetry() from public,anon,authenticated;
grant execute on function public.guardian_soc_telemetry() to service_role;

commit;
