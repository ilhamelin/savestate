begin;

create table public.itch_trackers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  metadata jsonb not null check (jsonb_typeof(metadata) = 'object'),
  url text not null check (url ~ '^https://[a-z0-9][a-z0-9-]*\.itch\.io/[a-z0-9][a-z0-9-]*$'),
  current_played_version text not null default '' check (length(current_played_version) <= 80),
  status text not null default 'playing' check (status in ('playing','waiting_update','completed','on_hold')),
  milestones jsonb not null default '[]' check (jsonb_typeof(milestones) = 'array' and jsonb_array_length(milestones) <= 50),
  private_notes text not null default '' check (length(private_notes) <= 5000),
  last_checked_at timestamptz not null default now(),
  unique (user_id, url)
);
alter table public.itch_trackers enable row level security;
create policy itch_owner_read on public.itch_trackers for select to authenticated using (user_id = auth.uid());
create policy itch_owner_edit on public.itch_trackers for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy itch_owner_delete on public.itch_trackers for delete to authenticated using (user_id = auth.uid());
revoke all on public.itch_trackers from public, anon, authenticated;
grant select, delete on public.itch_trackers to authenticated;
grant update (current_played_version,status,milestones,private_notes) on public.itch_trackers to authenticated;
grant all on public.itch_trackers to service_role;

alter table public.notifications add column itch_tracker_id uuid references public.itch_trackers(id) on delete cascade;

create function public.limit_itch_trackers() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 22));
  if (select count(*) from public.itch_trackers where user_id = new.user_id) >= 50 then
    raise exception 'Tracker limit reached' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger limit_itch_trackers before insert on public.itch_trackers for each row execute function public.limit_itch_trackers();
revoke all on function public.limit_itch_trackers() from public, anon, authenticated;

-- Server-only quota and atomic notification. Client identity comes from the verified session.
create function public.claim_itch_check(p_id uuid, p_user_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare t public.itch_trackers;
begin
  select * into t from public.itch_trackers where id = p_id and user_id = p_user_id for update;
  if not found then raise exception 'Tracker not found' using errcode = 'P0001'; end if;
  if t.last_checked_at > clock_timestamp() - interval '30 seconds' then return false; end if;
  update public.itch_trackers set last_checked_at = clock_timestamp() where id = t.id;
  return true;
end;
$$;

create function public.apply_itch_check(p_id uuid, p_user_id uuid, p_metadata jsonb) returns boolean
language plpgsql security definer set search_path = '' as $$
declare t public.itch_trackers; changed boolean := false; latest jsonb; previous jsonb;
begin
  select * into t from public.itch_trackers where id = p_id and user_id = p_user_id for update;
  if not found then raise exception 'Tracker not found' using errcode = 'P0001'; end if;
  latest := p_metadata->'devlog'; previous := t.metadata->'devlog';
  if latest is null or latest = 'null'::jsonb then
    p_metadata := jsonb_set(p_metadata, '{devlog}', coalesce(previous, 'null'::jsonb));
  elsif previous is not null and previous <> 'null'::jsonb and
    (latest->>'publishedAt')::timestamptz <= (previous->>'publishedAt')::timestamptz then
    p_metadata := jsonb_set(p_metadata, '{devlog}', previous);
  elsif latest->>'url' is distinct from previous->>'url' then
    changed := true;
    insert into public.notifications(user_id,actor_id,kind,itch_tracker_id)
    values (p_user_id,p_user_id,'itch_update',t.id);
  end if;
  update public.itch_trackers set metadata = p_metadata where id = t.id;
  return changed;
end;
$$;
revoke all on function public.claim_itch_check(uuid,uuid), public.apply_itch_check(uuid,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.claim_itch_check(uuid,uuid), public.apply_itch_check(uuid,uuid,jsonb) to service_role;

commit;
