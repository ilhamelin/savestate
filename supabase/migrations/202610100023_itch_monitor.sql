begin;

-- Private operational state and a lease prevent overlapping cron scans.
create table if not exists public.itch_monitor_state (
  id boolean primary key default true check (id),
  lock_token uuid,
  locked_until timestamptz,
  last_run_at timestamptz,
  last_success_at timestamptz
);
insert into public.itch_monitor_state(id) values (true) on conflict do nothing;
alter table public.itch_monitor_state enable row level security;
revoke all on public.itch_monitor_state from public, anon, authenticated;
grant all on public.itch_monitor_state to service_role;
create index if not exists itch_trackers_check_order on public.itch_trackers(last_checked_at,id);

create or replace function public.claim_itch_monitor() returns uuid
language plpgsql security definer set search_path = '' as $$
declare token uuid := gen_random_uuid();
begin
  update public.itch_monitor_state set lock_token = token,
    locked_until = clock_timestamp() + interval '5 minutes', last_run_at = clock_timestamp()
    where id and (locked_until is null or locked_until < clock_timestamp());
  if not found then return null; end if;
  return token;
end;
$$;
create or replace function public.finish_itch_monitor(p_token uuid,p_success boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.itch_monitor_state set locked_until = null, lock_token = null,
    last_success_at = case when p_success then clock_timestamp() else last_success_at end
    where id and lock_token = p_token;
end;
$$;

create or replace function public.itch_version_is_newer(p_latest text,p_played text) returns boolean
language plpgsql immutable set search_path = '' as $$
declare latest text := lower(regexp_replace(trim(coalesce(p_latest,'')), '^v', '', 'i'));
  played text := lower(regexp_replace(trim(coalesce(p_played,'')), '^v', '', 'i'));
  a numeric[]; b numeric[]; i integer;
begin
  if played = '' then return true; end if;
  if latest !~ '^[0-9]+\.[0-9]+(\.[0-9]+)*[a-z]?$' or played !~ '^[0-9]+\.[0-9]+(\.[0-9]+)*[a-z]?$' then
    return latest <> played;
  end if;
  a := string_to_array(regexp_replace(latest,'[a-z]$',''),'.')::numeric[];
  b := string_to_array(regexp_replace(played,'[a-z]$',''),'.')::numeric[];
  for i in 1..greatest(array_length(a,1),array_length(b,1)) loop
    if coalesce(a[i],0) <> coalesce(b[i],0) then return coalesce(a[i],0) > coalesce(b[i],0); end if;
  end loop;
  return coalesce(substring(latest from '[a-z]$'),'') > coalesce(substring(played from '[a-z]$'),'');
end;
$$;

-- Metadata, release filtering, installer changes and bell alerts share one row lock.
create or replace function public.apply_itch_check_v2(p_id uuid,p_user_id uuid,p_metadata jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare t public.itch_trackers; previous jsonb; latest jsonb; old_release jsonb; release jsonb;
  old_ids text[]; new_ids text[]; release_changed boolean := false; installer_changed boolean := false;
  updated boolean; reason text;
begin
  select * into t from public.itch_trackers where id = p_id and user_id = p_user_id for update;
  if not found then raise exception 'Tracker not found' using errcode = 'P0001'; end if;
  if jsonb_typeof(p_metadata) <> 'object' then raise exception 'Invalid metadata'; end if;
  previous := t.metadata->'devlog'; latest := p_metadata->'devlog';
  if latest is null or latest = 'null'::jsonb or
    (previous is not null and previous <> 'null'::jsonb and (latest->>'publishedAt')::timestamptz <= (previous->>'publishedAt')::timestamptz) then
    p_metadata := jsonb_set(p_metadata,'{devlog}',coalesce(previous,'null'::jsonb));
  end if;
  old_release := t.metadata->'releaseDevlog';
  if (old_release is null or old_release = 'null'::jsonb) and previous <> 'null'::jsonb and
    (nullif(previous->>'version','') is not null or previous->>'title' ~* '(release|update|patch|hotfix|build|versión|actualización)') then
    old_release := previous;
  end if;
  release := p_metadata->'releaseDevlog';
  if release is null or release = 'null'::jsonb or not
    (nullif(release->>'version','') is not null or release->>'title' ~* '(release|update|patch|hotfix|build|versión|actualización)') then
    release := old_release;
  elsif old_release is not null and old_release <> 'null'::jsonb and
    (release->>'publishedAt')::timestamptz <= (old_release->>'publishedAt')::timestamptz then
    release := old_release;
  elsif release->>'url' is distinct from old_release->>'url' and
    (old_release is not null and old_release <> 'null'::jsonb or previous is null or previous = 'null'::jsonb or
      (release->>'publishedAt')::timestamptz > (previous->>'publishedAt')::timestamptz) then
    release_changed := public.itch_version_is_newer(coalesce(release->>'version',release->>'title'),t.current_played_version);
  end if;
  p_metadata := jsonb_set(p_metadata,'{releaseDevlog}',coalesce(release,'null'::jsonb));
  if coalesce((p_metadata->>'downloadsAvailable')::boolean,false) then
    select coalesce(array_agg(distinct value->>'uploadId' order by value->>'uploadId'),'{}') into new_ids
      from jsonb_array_elements(coalesce(p_metadata->'downloads','[]'));
    select coalesce(array_agg(distinct value->>'uploadId' order by value->>'uploadId'),'{}') into old_ids
      from jsonb_array_elements(coalesce(t.metadata->'downloads','[]'));
    -- First successful HTML inspection is a baseline. Removal/reordering/size alone is silent.
    installer_changed := coalesce((t.metadata->>'downloadsAvailable')::boolean,false) and not (new_ids <@ old_ids);
  else
    p_metadata := jsonb_set(p_metadata,'{downloads}',coalesce(t.metadata->'downloads','[]'));
    p_metadata := jsonb_set(p_metadata,'{downloadsAvailable}',coalesce(t.metadata->'downloadsAvailable','false'));
  end if;
  p_metadata := jsonb_set(p_metadata,'{installerChanged}',to_jsonb(installer_changed or coalesce((t.metadata->>'installerChanged')::boolean,false)));
  updated := release_changed or installer_changed;
  reason := case when installer_changed then 'installer' when release_changed then 'release' else null end;
  if updated then
    insert into public.notifications(user_id,actor_id,kind,itch_tracker_id) values(p_user_id,p_user_id,'itch_update',t.id);
  end if;
  update public.itch_trackers set metadata = p_metadata where id = t.id;
  return jsonb_build_object('updated',updated,'reason',reason);
end;
$$;

-- Preserve older server callers while retiring the unfiltered notification behavior.
create or replace function public.apply_itch_check(p_id uuid,p_user_id uuid,p_metadata jsonb) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  return (public.apply_itch_check_v2(p_id,p_user_id,p_metadata)->>'updated')::boolean;
end;
$$;
create or replace function public.acknowledge_itch_installer(p_id uuid,p_user_id uuid,p_upload_ids text[]) returns boolean
language plpgsql security definer set search_path = '' as $$
declare t public.itch_trackers; ids text[];
begin
  select * into t from public.itch_trackers where id = p_id and user_id = p_user_id for update;
  if not found then raise exception 'Tracker not found' using errcode = 'P0001'; end if;
  select coalesce(array_agg(distinct value->>'uploadId' order by value->>'uploadId'),'{}') into ids
    from jsonb_array_elements(coalesce(t.metadata->'downloads','[]'));
  if ids is distinct from p_upload_ids then return false; end if;
  update public.itch_trackers set metadata = jsonb_set(metadata,'{installerChanged}','false') where id = t.id;
  return true;
end;
$$;
revoke all on function public.claim_itch_monitor(),public.finish_itch_monitor(uuid,boolean),public.itch_version_is_newer(text,text),public.apply_itch_check_v2(uuid,uuid,jsonb),public.acknowledge_itch_installer(uuid,uuid,text[]) from public,anon,authenticated;
grant execute on function public.claim_itch_monitor(),public.finish_itch_monitor(uuid,boolean),public.itch_version_is_newer(text,text),public.apply_itch_check_v2(uuid,uuid,jsonb),public.acknowledge_itch_installer(uuid,uuid,text[]) to service_role;

commit;
