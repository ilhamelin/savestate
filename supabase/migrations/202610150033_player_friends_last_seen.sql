begin;

-- A new return column requires recreating the RPC. Keep invoker permissions:
-- a private library must not reveal its titles or activity to other visitors.
drop function if exists public.get_player_friends(uuid);
create function public.get_player_friends(p_user_id uuid)
returns table (
  id uuid, username text, avatar_url text, level integer,
  terminal_status text, current_game text, last_seen_at timestamptz
)
language sql stable security invoker set search_path = '' as $$
  select p.id, p.username, p.avatar_url, coalesce(p.level, 1), p.terminal_status,
    playing.title as current_game,
    coalesce(act.last_active, p.created_at) as last_seen_at
  from public.friendships f
  join public.profiles p on p.id =
    case when f.sender_id = p_user_id then f.receiver_id else f.sender_id end
  left join lateral (
    select g.title
    from public.user_games ug
    join public.games g on g.id = ug.game_id
    where ug.user_id = p.id and ug.status = 'playing'
    order by ug.updated_at desc, ug.id
    limit 1
  ) playing on true
  left join lateral (
    select max(activity_time) as last_active
    from (
      select ug.updated_at as activity_time
      from public.user_games ug where ug.user_id = p.id
      union all
      select pl.created_at as activity_time
      from public.play_logs pl
      join public.user_games ug on ug.id = pl.user_game_id
      where ug.user_id = p.id
    ) visible_activity
  ) act on true
  where f.status = 'accepted'
    and (f.sender_id = p_user_id or f.receiver_id = p_user_id)
  order by (playing.title is not null) desc, p.username, p.id;
$$;
revoke all on function public.get_player_friends(uuid) from public;
grant execute on function public.get_player_friends(uuid) to anon, authenticated;

commit;
