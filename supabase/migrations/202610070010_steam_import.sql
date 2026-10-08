begin;

-- One transaction per new game; existing library records are never overwritten.
create function public.import_steam_game(p_game_id uuid, p_status text, p_minutes integer, p_appid bigint)
returns text language plpgsql security invoker set search_path = '' as $$
declare library_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_status not in ('backlog', 'playing', 'cleared') or p_status is null
    or p_minutes is null or p_minutes < 0 or p_minutes > 6000000
    or p_appid is null or p_appid < 1 or p_appid > 4294967295 then
    raise exception 'Invalid Steam import';
  end if;
  insert into public.user_games(user_id, game_id, status)
  values(auth.uid(), p_game_id, p_status)
  on conflict (user_id, game_id) do nothing returning id into library_id;
  if library_id is null then return 'existing'; end if;
  if p_minutes > 0 then
    insert into public.play_logs(user_game_id, platform_played, play_method, hours_played, note)
    values(library_id, 'PC / Steam', 'hardware', round(p_minutes::numeric / 60, 2),
      '[Steam lifetime:' || p_appid::text || '] Horas acumuladas importadas; año de juego desconocido.');
  end if;
  return 'imported';
end;
$$;
revoke all on function public.import_steam_game(uuid, text, integer, bigint) from public, anon, authenticated;
grant execute on function public.import_steam_game(uuid, text, integer, bigint) to authenticated;

commit;
