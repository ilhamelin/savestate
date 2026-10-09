begin;

drop policy if exists friends_read on public.friendships;
create policy friends_read on public.friendships
  for select to authenticated, anon
  using (
    status = 'accepted'
    or (auth.uid() is not null and (sender_id = auth.uid() or receiver_id = auth.uid()))
  );
grant select on public.friendships to anon, authenticated;

-- Run with the visitor's permissions: private libraries must not leak playing titles.
create or replace function public.get_player_friends(p_user_id uuid)
returns table (
  id uuid, username text, avatar_url text, level integer,
  terminal_status text, current_game text
)
language sql stable security invoker set search_path = '' as $$
  select p.id, p.username, p.avatar_url, coalesce(p.level, 1), p.terminal_status,
    playing.title as current_game
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
  where f.status = 'accepted'
    and (f.sender_id = p_user_id or f.receiver_id = p_user_id)
  order by (playing.title is not null) desc, p.username, p.id;
$$;
revoke all on function public.get_player_friends(uuid) from public;
grant execute on function public.get_player_friends(uuid) to anon, authenticated;

commit;
