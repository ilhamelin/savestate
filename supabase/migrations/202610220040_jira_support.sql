begin;

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  input jsonb not null check (jsonb_typeof(input) = 'object'),
  status text not null default 'queued' check (status in ('queued','sending','synced_jira','stored_local','needs_review')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  remote_id text,
  jira_issue_key text,
  telemetry_id uuid unique,
  attempts integer not null default 0,
  locked_until timestamptz,
  lease_token uuid,
  next_attempt_at timestamptz not null default now()
);
create index if not exists support_tickets_queue on public.support_tickets(next_attempt_at)
  where status <> 'synced_jira';
create table if not exists public.support_rate_limits (
  key_hash text primary key,
  window_start timestamptz not null default now(),
  attempts integer not null default 0
);
create table if not exists public.support_telemetry (
  id uuid primary key,
  fingerprint text not null,
  event jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists support_telemetry_created on public.support_telemetry(created_at desc);
alter table public.support_tickets enable row level security;
alter table public.support_rate_limits enable row level security;
alter table public.support_telemetry enable row level security;
revoke all on public.support_tickets, public.support_rate_limits, public.support_telemetry from public, anon, authenticated;
grant select, insert, update, delete on public.support_tickets, public.support_rate_limits, public.support_telemetry to service_role;

create or replace function public.claim_support_attempt(p_key_hash text, p_kind text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_count int; v_limit int;
begin
  if p_key_hash !~ '^[a-f0-9]{64}$' or p_kind not in ('support','telemetry') then
    raise exception 'Invalid limiter key';
  end if;
  v_limit := case when p_kind = 'support' then 5 else 30 end;
  delete from public.support_rate_limits where window_start < now() - interval '20 minutes';
  insert into public.support_rate_limits(key_hash, attempts) values(p_key_hash,1)
  on conflict(key_hash) do update set
    attempts = case when public.support_rate_limits.window_start <= now() - interval '10 minutes' then 1
      else public.support_rate_limits.attempts + 1 end,
    window_start = case when public.support_rate_limits.window_start <= now() - interval '10 minutes' then now()
      else public.support_rate_limits.window_start end
  returning attempts into v_count;
  return v_count <= v_limit;
end;
$$;

create or replace function public.claim_support_ticket(p_id uuid)
returns setof public.support_tickets language plpgsql security definer set search_path = '' as $$
begin
  return query
  update public.support_tickets set
    status = case when status = 'sending' then 'needs_review' else status end,
    lease_token = gen_random_uuid(),
    locked_until = now() + interval '30 seconds',
    attempts = attempts + 1, updated_at = now()
  where id = p_id and status <> 'synced_jira'
    and (locked_until is null or locked_until < now())
  returning *;
end;
$$;

create or replace function public.record_support_telemetry(p_event jsonb, p_fingerprint text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform pg_advisory_xact_lock(842044);
  select id into v_id from public.support_telemetry
    where fingerprint = p_fingerprint and created_at > now() - interval '5 minutes' limit 1;
  if v_id is not null then return v_id; end if;
  v_id := (p_event->>'id')::uuid;
  insert into public.support_telemetry(id,fingerprint,event) values(v_id,p_fingerprint,p_event);
  delete from public.support_telemetry where id in (
    select id from public.support_telemetry order by created_at desc, id desc offset 50
  );
  return v_id;
end;
$$;
revoke all on function public.claim_support_attempt(text,text) from public, anon, authenticated;
revoke all on function public.claim_support_ticket(uuid) from public, anon, authenticated;
revoke all on function public.record_support_telemetry(jsonb,text) from public, anon, authenticated;
grant execute on function public.claim_support_attempt(text,text) to service_role;
grant execute on function public.claim_support_ticket(uuid) to service_role;
grant execute on function public.record_support_telemetry(jsonb,text) to service_role;

commit;
