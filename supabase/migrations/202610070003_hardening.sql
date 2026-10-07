begin;
alter table public.profiles add column username_normalized text generated always as (lower(username)) stored;
create unique index profiles_username_normalized on public.profiles(username_normalized);
drop index public.profiles_username_lower;
drop policy reviews_moderator on public.reviews;
create policy reviews_moderator on public.reviews for select to authenticated using(public.is_moderator() and exists(select 1 from public.reports report where report.review_id = reviews.id));
create function public.community_ratings(p_game_ids uuid[]) returns table(game_id uuid, average numeric, total bigint) language sql stable security definer set search_path = '' as $$
  select wanted.id, round(avg(ug.rating),1), count(ug.rating)
  from unnest(p_game_ids) wanted(id)
  left join public.user_games ug on ug.game_id = wanted.id and exists(select 1 from public.profiles p where p.id = ug.user_id and not p.library_private)
  group by wanted.id;
$$;
create function public.game_statistics(p_game_id uuid) returns table(average numeric, total bigint, distribution jsonb, average_hours numeric) language sql stable security definer set search_path = '' as $$
  with visible as (
    select ug.* from public.user_games ug join public.profiles p on p.id = ug.user_id
    where ug.game_id = p_game_id and not p.library_private
  ), scores as (
    select rating,count(*) as amount from visible where rating is not null group by rating
  ), hours as (
    select ug.id,sum(pl.hours_played) as amount from visible ug join public.play_logs pl on pl.user_game_id = ug.id group by ug.id
  )
  select (select round(avg(rating),1) from visible), (select count(rating) from visible),
    coalesce((select jsonb_object_agg(rating::text,amount) from scores),'{}'), (select round(avg(amount),1) from hours);
$$;
revoke execute on function public.community_ratings(uuid[]), public.game_statistics(uuid) from public;
grant execute on function public.community_ratings(uuid[]), public.game_statistics(uuid) to anon, authenticated;

create function public.review_requires_rating() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.rating is null and exists(select 1 from public.reviews r where r.user_game_id = new.id) then
    raise exception 'A review requires a rating' using errcode = '23514';
  end if;
  return new;
end; $$;
create trigger library_review_rating before update on public.user_games for each row execute function public.review_requires_rating();
revoke execute on function public.review_requires_rating() from public,anon,authenticated;
create function public.review_check_rating() returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists(select 1 from public.user_games ug where ug.id = new.user_game_id and ug.rating is not null) then
    raise exception 'A review requires a library rating' using errcode = '23514';
  end if;
  return new;
end; $$;
create trigger review_library_rating before insert or update on public.reviews for each row execute function public.review_check_rating();
revoke execute on function public.review_check_rating() from public,anon,authenticated;
revoke update on public.user_games from authenticated;
grant update(status,rating,favorite_position) on public.user_games to authenticated;

drop policy profile_media_add on storage.objects;
drop policy profile_media_edit on storage.objects;
drop policy profile_media_remove on storage.objects;
create policy profile_media_add on storage.objects for insert to authenticated with check(bucket_id = 'profiles' and name in (auth.uid()::text || '/avatar.webp',auth.uid()::text || '/banner.webp'));
create policy profile_media_edit on storage.objects for update to authenticated using(bucket_id = 'profiles' and name in (auth.uid()::text || '/avatar.webp',auth.uid()::text || '/banner.webp')) with check(bucket_id = 'profiles' and name in (auth.uid()::text || '/avatar.webp',auth.uid()::text || '/banner.webp'));
create policy profile_media_remove on storage.objects for delete to authenticated using(bucket_id = 'profiles' and name in (auth.uid()::text || '/avatar.webp',auth.uid()::text || '/banner.webp'));
commit;
