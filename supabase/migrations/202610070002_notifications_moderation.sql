begin;
create table public.notifications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete cascade, kind text not null,
  read_at timestamptz, created_at timestamptz not null default now()
);
create index notifications_recipient on public.notifications(user_id, created_at desc);
alter table public.notifications enable row level security;
create policy notifications_read on public.notifications for select to authenticated using(user_id = auth.uid());
create policy notifications_mark on public.notifications for update to authenticated using(user_id = auth.uid()) with check(user_id = auth.uid());
revoke all on public.notifications from anon, authenticated;
grant select, update(read_at) on public.notifications to authenticated;
grant all on public.notifications to service_role;

create function public.notify_social() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'follows' then
    insert into public.notifications(user_id,actor_id,kind) values(new.followed_id,new.follower_id,'follow');
  elsif tg_op = 'INSERT' then
    insert into public.notifications(user_id,actor_id,kind) values(new.receiver_id,new.sender_id,'friend_request');
  elsif new.status = 'accepted' and old.status <> 'accepted' then
    insert into public.notifications(user_id,actor_id,kind) values(new.sender_id,new.receiver_id,'friend_accepted');
  end if;
  return new;
end; $$;
create trigger follows_notify after insert on public.follows for each row execute function public.notify_social();
create trigger friends_notify after insert or update on public.friendships for each row execute function public.notify_social();
create function public.notify_review() returns trigger language plpgsql security definer set search_path = '' as $$
declare recipient uuid;
begin
  select ug.user_id into recipient from public.reviews r join public.user_games ug on ug.id = r.user_game_id where r.id = new.review_id;
  if recipient is not null and recipient <> new.user_id then
    insert into public.notifications(user_id,actor_id,kind) values(recipient,new.user_id,case when tg_table_name = 'review_comments' then 'comment' else 'reaction' end);
  end if;
  return new;
end; $$;
create trigger comments_notify after insert on public.review_comments for each row execute function public.notify_review();
create trigger reactions_notify after insert on public.review_reactions for each row execute function public.notify_review();

create function public.is_moderator() returns boolean language sql stable set search_path = '' as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin','moderator'),false);
$$;
create policy reports_moderator on public.reports for select to authenticated using(public.is_moderator());
create policy suggestions_moderator on public.game_suggestions for select to authenticated using(public.is_moderator());
create policy reviews_moderator on public.reviews for select to authenticated using(public.is_moderator());
create policy reviews_moderator_remove on public.reviews for delete to authenticated using(public.is_moderator());
grant execute on function public.is_moderator() to authenticated;
revoke execute on function public.notify_social(), public.notify_review() from public, anon, authenticated;
commit;
