begin;

alter table public.profiles add column if not exists wallpaper_url text;
grant update (wallpaper_url) on public.profiles to authenticated;

drop policy profile_media_add on storage.objects;
drop policy profile_media_edit on storage.objects;
drop policy profile_media_remove on storage.objects;
create policy profile_media_add on storage.objects for insert to authenticated
  with check (bucket_id = 'profiles' and name in (auth.uid()::text || '/avatar.webp', auth.uid()::text || '/banner.webp', auth.uid()::text || '/wallpaper.webp'));
create policy profile_media_edit on storage.objects for update to authenticated
  using (bucket_id = 'profiles' and name in (auth.uid()::text || '/avatar.webp', auth.uid()::text || '/banner.webp', auth.uid()::text || '/wallpaper.webp'))
  with check (bucket_id = 'profiles' and name in (auth.uid()::text || '/avatar.webp', auth.uid()::text || '/banner.webp', auth.uid()::text || '/wallpaper.webp'));
create policy profile_media_remove on storage.objects for delete to authenticated
  using (bucket_id = 'profiles' and name in (auth.uid()::text || '/avatar.webp', auth.uid()::text || '/banner.webp', auth.uid()::text || '/wallpaper.webp'));

-- Serialize with the existing set_favorites RPC on the owner's profile row.
-- A move swaps the two occupied slots; clearing a slot leaves the others intact.
create or replace function public.set_favorite_slot(p_slot integer, p_game_id uuid, p_status text default 'backlog')
returns void language plpgsql security invoker set search_path = '' as $$
declare previous_game uuid; previous_slot integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_slot is null or p_slot < 1 or p_slot > 4 or p_status is null or p_status not in ('backlog', 'cleared', 'wishlist') then
    raise exception 'Invalid favorite slot';
  end if;
  perform 1 from public.profiles where id = auth.uid() for update;
  if not found then raise exception 'Profile not found'; end if;
  select game_id into previous_game from public.user_games where user_id = auth.uid() and favorite_position = p_slot;
  if p_game_id is not null then
    select favorite_position into previous_slot from public.user_games where user_id = auth.uid() and game_id = p_game_id;
    if previous_slot = p_slot then return; end if;
  end if;
  update public.user_games set favorite_position = null
    where user_id = auth.uid() and (favorite_position = p_slot or game_id = p_game_id);
  if p_game_id is not null then
    insert into public.user_games(user_id, game_id, status, favorite_position)
      values (auth.uid(), p_game_id, p_status, p_slot)
      on conflict (user_id, game_id) do update set favorite_position = excluded.favorite_position;
    if previous_slot is not null and previous_game is not null then
      update public.user_games set favorite_position = previous_slot where user_id = auth.uid() and game_id = previous_game;
    end if;
  end if;
end;
$$;
revoke execute on function public.set_favorite_slot(integer, uuid, text) from public, anon;
grant execute on function public.set_favorite_slot(integer, uuid, text) to authenticated;

commit;
