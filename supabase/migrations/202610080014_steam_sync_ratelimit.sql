begin;

alter table public.profiles
  add column if not exists steam_id text check (steam_id ~ '^7656[0-9]{13}$'),
  add column if not exists steam_sync_count integer not null default 0 check (steam_sync_count between 0 and 3),
  add column if not exists steam_last_sync_at timestamptz;
grant update (steam_id) on public.profiles to authenticated;
revoke update (steam_sync_count, steam_last_sync_at) on public.profiles from anon, authenticated;

create or replace function public.claim_steam_sync_slot()
returns table(allowed boolean, remaining_slots integer, message text)
language plpgsql security definer set search_path = '' as $$
declare current_count integer; last_sync timestamptz; linked_id text; claimed_at timestamptz;
begin
  if auth.uid() is null then
    return query select false, 0, 'Autenticación requerida'; return;
  end if;
  select p.steam_sync_count, p.steam_last_sync_at, p.steam_id
    into current_count, last_sync, linked_id
    from public.profiles p where p.id = auth.uid() for update;
  if not found or linked_id is null then
    return query select false, 0, 'Vincula tu cuenta desde el importador de Steam'; return;
  end if;
  claimed_at := clock_timestamp();
  if last_sync is null or (last_sync at time zone 'UTC')::date < (claimed_at at time zone 'UTC')::date then
    current_count := 0;
  end if;
  if current_count >= 3 then
    return query select false, 0, 'Límite diario de 3 sincronizaciones alcanzado. Vuelve mañana (día UTC).'; return;
  end if;
  update public.profiles set steam_sync_count = current_count + 1, steam_last_sync_at = claimed_at
    where id = auth.uid();
  return query select true, 2 - current_count, 'Slot concedido';
end;
$$;
revoke all on function public.claim_steam_sync_slot() from public, anon;
grant execute on function public.claim_steam_sync_slot() to authenticated;

-- Retain import semantics; zero-hour titles also need a Steam marker.
create or replace function public.import_steam_game(p_game_id uuid, p_status text, p_minutes integer, p_appid bigint)
returns text language plpgsql security invoker set search_path = '' as $$
declare library_id uuid; imported boolean; marker text;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_status is null or p_status not in ('backlog', 'playing', 'cleared')
    or p_minutes is null or p_minutes < 0 or p_minutes > 6000000
    or p_appid is null or p_appid < 1 or p_appid > 4294967295 then
    raise exception 'Invalid Steam import';
  end if;
  insert into public.user_games(user_id, game_id, status)
    values(auth.uid(), p_game_id, p_status)
    on conflict(user_id, game_id) do nothing returning id into library_id;
  imported := library_id is not null;
  if not imported then
    select id into library_id from public.user_games where user_id = auth.uid() and game_id = p_game_id for update;
  end if;
  marker := '[Steam lifetime:' || p_appid::text || ']';
  if not exists(select 1 from public.play_logs where user_game_id = library_id and note like marker || '%') then
    insert into public.play_logs(user_game_id, platform_played, play_method, hours_played, note)
      values(library_id, 'PC / Steam', 'hardware', case when imported then round(p_minutes::numeric / 60, 2) else 0 end,
        marker || ' Horas acumuladas importadas; año de juego desconocido.');
  end if;
  return case when imported then 'imported' else 'existing' end;
end;
$$;
revoke all on function public.import_steam_game(uuid, text, integer, bigint) from public, anon;
grant execute on function public.import_steam_game(uuid, text, integer, bigint) to authenticated;

-- Only the server may supply the authenticated user's authoritative Valve snapshot.
-- Profile + library + log locks serialize concurrent syncs and preserve manual logs.
create or replace function public.apply_steam_sync(p_user_id uuid, p_steam_id text, p_games jsonb)
returns table(updated_count integer, hours_added numeric)
language plpgsql security invoker set search_path = '' as $$
declare item record; anchor_id uuid; accumulated numeric; target_hours numeric; delta numeric;
  changed uuid[] := '{}'; total_added numeric := 0; marker text;
begin
  if jsonb_typeof(p_games) is distinct from 'array' or jsonb_array_length(p_games) > 10000 then
    raise exception 'Invalid Steam snapshot';
  end if;
  if exists(select 1 from jsonb_to_recordset(p_games) as g(appid bigint, minutes integer)
    where g.appid is null or g.appid < 1 or g.appid > 4294967295 or g.minutes is null or g.minutes < 0 or g.minutes > 6000000)
    or (select count(distinct g.appid) from jsonb_to_recordset(p_games) as g(appid bigint)) <> jsonb_array_length(p_games) then
    raise exception 'Invalid Steam snapshot';
  end if;
  perform 1 from public.profiles where id = p_user_id and steam_id = p_steam_id for update;
  if not found then raise exception 'Steam account changed' using errcode = 'P0001'; end if;
  for item in
    select distinct ug.id, g.appid, g.minutes
    from public.user_games ug join public.play_logs pl on pl.user_game_id = ug.id
    join jsonb_to_recordset(p_games) as g(appid bigint, minutes integer)
      on substring(pl.note from '^\[Steam lifetime:([0-9]{1,10})\]')::bigint = g.appid
    where ug.user_id = p_user_id order by ug.id, g.appid
  loop
    perform 1 from public.user_games where id = item.id and user_id = p_user_id for update;
    if not found then continue; end if;
    marker := '[Steam lifetime:' || item.appid::text || ']';
    perform 1 from public.play_logs where user_game_id = item.id and note like marker || '%' order by id for update;
    select id into anchor_id from public.play_logs where user_game_id = item.id and note like marker || '%' order by id limit 1;
    if anchor_id is null then continue; end if;
    select coalesce(sum(hours_played), 0) into accumulated from public.play_logs where user_game_id = item.id and note like marker || '%';
    target_hours := round(item.minutes::numeric / 60, 2);
    delta := target_hours - accumulated;
    if delta > 0 then
      update public.play_logs set hours_played = hours_played + delta where id = anchor_id;
      total_added := total_added + delta;
      if not item.id = any(changed) then changed := array_append(changed, item.id); end if;
    end if;
  end loop;
  return query select cardinality(changed), total_added;
end;
$$;
revoke all on function public.apply_steam_sync(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.apply_steam_sync(uuid, text, jsonb) to service_role;

commit;
