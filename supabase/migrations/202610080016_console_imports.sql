begin;

alter table public.profiles
  add column if not exists psn_id text check (length(psn_id) between 3 and 30),
  add column if not exists xbox_gamertag text check (length(xbox_gamertag) between 3 and 30);
grant update (psn_id, xbox_gamertag) on public.profiles to authenticated;

create or replace function public.import_console_game(
  p_game_id uuid, p_status text, p_platform text,
  p_hours numeric default 0, p_source text default 'PlayStation'
)
returns text language plpgsql security invoker set search_path = '' as $$
declare
  library_id uuid;
  is_new boolean;
  marker text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_status is null or p_status not in ('backlog','playing','cleared','platinum','dropped','wishlist')
    or p_hours is null or p_hours::text in ('NaN','Infinity','-Infinity')
    or p_hours < 0 or p_hours > 100000
    or p_source is null or p_source not in ('PlayStation','Xbox')
    or p_platform is null
    or (p_source = 'PlayStation' and p_platform not in ('PlayStation','PlayStation 2','PlayStation 3','PlayStation 4','PlayStation 5','PSP','PlayStation Vita'))
    or (p_source = 'Xbox' and p_platform not in ('Xbox','Xbox 360','Xbox One','Xbox Series X|S')) then
    raise exception 'Invalid console import parameters';
  end if;
  insert into public.user_games(user_id, game_id, status)
  values(auth.uid(), p_game_id, p_status)
  on conflict (user_id, game_id) do nothing returning id into library_id;
  is_new := library_id is not null;
  select id into library_id from public.user_games
  where user_id = auth.uid() and game_id = p_game_id for update;
  marker := '[' || p_source || '] Partida importada a la biblioteca.';
  if not exists (select 1 from public.play_logs
    where user_game_id = library_id and platform_played = p_platform and note = marker) then
    insert into public.play_logs(user_game_id, platform_played, play_method, hours_played, note)
    values(library_id, p_platform, 'hardware', case when is_new then round(p_hours, 2) else 0 end, marker);
  end if;
  return case when is_new then 'imported' else 'existing' end;
end;
$$;
revoke all on function public.import_console_game(uuid,text,text,numeric,text) from public, anon;
grant execute on function public.import_console_game(uuid,text,text,numeric,text) to authenticated;

commit;
