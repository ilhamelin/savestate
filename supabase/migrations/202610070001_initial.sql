begin;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[A-Za-z0-9_]{3,30}$'),
  avatar_url text, banner_url text,
  theme_color text not null default 'cyan' check (theme_color in ('cyan','green','pink','amber')),
  terminal_status text not null default '' check (length(terminal_status) <= 160),
  social_links jsonb not null default '{}' check (jsonb_typeof(social_links) = 'object'),
  library_private boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index profiles_username_lower on public.profiles(lower(username));

create function public.create_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, username) values (new.id, 'player_' || left(replace(new.id::text, '-', ''), 23));
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.create_profile();

create table public.games (
  id uuid primary key default gen_random_uuid(), igdb_id bigint not null unique,
  title text not null, slug text not null unique, cover_url text,
  release_year int, platforms text[] not null default '{}', genres text[] not null default '{}',
  developer text, publisher text, series text, synopsis text,
  cached_at timestamptz not null default now()
);
create index games_title on public.games(lower(title));
create index games_platforms on public.games using gin(platforms);
create index games_genres on public.games using gin(genres);

create table public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followed_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(), primary key (follower_id, followed_id),
  check (follower_id <> followed_id)
);
create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  created_at timestamptz not null default now(), check (sender_id <> receiver_id)
);
create unique index friendships_pair on public.friendships(least(sender_id, receiver_id), greatest(sender_id, receiver_id));
create index friendships_receiver on public.friendships(receiver_id, status);

create function public.can_view_library(owner_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = owner_id and (
    not p.library_private or p.id = auth.uid() or exists (
      select 1 from public.friendships f where f.status = 'accepted' and
      ((f.sender_id = owner_id and f.receiver_id = auth.uid()) or (f.receiver_id = owner_id and f.sender_id = auth.uid()))
    )
  ));
$$;

create table public.user_games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete cascade,
  status text not null default 'backlog' check (status in ('playing','backlog','cleared','platinum','dropped','wishlist')),
  rating numeric check (rating between 1 and 10 and mod(rating, 0.5) = 0),
  favorite_position int check (favorite_position between 1 and 4),
  updated_at timestamptz not null default now(), unique(user_id, game_id), unique(user_id, favorite_position)
);
create index user_games_game on public.user_games(game_id);
create table public.play_logs (
  id uuid primary key default gen_random_uuid(),
  user_game_id uuid not null references public.user_games(id) on delete cascade,
  platform_played text not null check (length(platform_played) between 1 and 100),
  play_method text not null check (play_method in ('hardware','emulator','other')),
  difficulty text not null default '' check (length(difficulty) <= 80),
  hours_played numeric(8,2) not null default 0 check (hours_played between 0 and 100000),
  start_date date, finish_date date, note text not null default '' check (length(note) <= 2000),
  created_at timestamptz not null default now(), check (finish_date >= start_date)
);
create index play_logs_user_game on public.play_logs(user_game_id);
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_game_id uuid not null unique references public.user_games(id) on delete cascade,
  content text not null check (length(content) between 1 and 100000),
  content_markdown text not null check (length(content_markdown) between 1 and 10000),
  has_spoilers boolean not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.review_reactions (
  review_id uuid not null references public.reviews(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reaction_type text not null check (reaction_type in ('critical_hit','gg','game_over')),
  primary key(review_id, user_id)
);
create table public.review_comments (
  id uuid primary key default gen_random_uuid(), review_id uuid not null references public.reviews(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (length(content) between 1 and 2000), created_at timestamptz not null default now()
);
create table public.user_lists (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check(length(title) between 1 and 120), description text not null default '' check(length(description) <= 2000),
  is_private boolean not null default false, created_at timestamptz not null default now()
);
create table public.list_items (
  id uuid primary key default gen_random_uuid(), list_id uuid not null references public.user_lists(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete cascade,
  position_index int not null check(position_index >= 0), note text not null default '' check(length(note) <= 1000),
  unique(list_id, game_id), unique(list_id, position_index)
);
create table public.activity_logs (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  target_game_id uuid not null references public.games(id) on delete cascade,
  event_type text not null, event_data jsonb not null default '{}', created_at timestamptz not null default now()
);
create index activity_recent on public.activity_logs(user_id, created_at desc);
create table public.game_suggestions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check(length(title) between 1 and 200), details text not null check(length(details) between 1 and 2000),
  created_at timestamptz not null default now()
);
create table public.reports (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  review_id uuid not null references public.reviews(id) on delete cascade,
  reason text not null check(length(reason) between 1 and 1000), created_at timestamptz not null default now(), unique(user_id, review_id)
);

create function public.can_view_review(review uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.reviews r join public.user_games ug on ug.id = r.user_game_id
    where r.id = review and public.can_view_library(ug.user_id));
$$;
create function public.can_view_list(list uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.user_lists l where l.id = list and
    (l.user_id = auth.uid() or (not l.is_private and public.can_view_library(l.user_id))));
$$;

alter table public.profiles enable row level security;
alter table public.games enable row level security;
alter table public.follows enable row level security;
alter table public.friendships enable row level security;
alter table public.user_games enable row level security;
alter table public.play_logs enable row level security;
alter table public.reviews enable row level security;
alter table public.review_reactions enable row level security;
alter table public.review_comments enable row level security;
alter table public.user_lists enable row level security;
alter table public.list_items enable row level security;
alter table public.activity_logs enable row level security;
alter table public.game_suggestions enable row level security;
alter table public.reports enable row level security;

create policy profiles_read on public.profiles for select using (true);
create policy profiles_edit on public.profiles for update to authenticated using (id = auth.uid()) with check(id = auth.uid());
create policy games_read on public.games for select using(true);
create policy follows_read on public.follows for select to authenticated using(follower_id = auth.uid() or followed_id = auth.uid());
create policy follows_add on public.follows for insert to authenticated with check(follower_id = auth.uid());
create policy follows_remove on public.follows for delete to authenticated using(follower_id = auth.uid());
create policy friends_read on public.friendships for select to authenticated using(sender_id = auth.uid() or receiver_id = auth.uid());
create policy friends_request on public.friendships for insert to authenticated with check(sender_id = auth.uid() and status = 'pending');
create policy friends_respond on public.friendships for update to authenticated using(receiver_id = auth.uid() and status = 'pending') with check(receiver_id = auth.uid() and status in ('accepted','rejected'));
create policy friends_remove on public.friendships for delete to authenticated using(sender_id = auth.uid() or receiver_id = auth.uid());
create policy library_read on public.user_games for select using(public.can_view_library(user_id));
create policy library_add on public.user_games for insert to authenticated with check(user_id = auth.uid());
create policy library_edit on public.user_games for update to authenticated using(user_id = auth.uid()) with check(user_id = auth.uid());
create policy library_remove on public.user_games for delete to authenticated using(user_id = auth.uid());
create policy logs_read on public.play_logs for select using(exists(select 1 from public.user_games ug where ug.id = user_game_id));
create policy logs_owner on public.play_logs for all to authenticated using(exists(select 1 from public.user_games ug where ug.id = user_game_id and ug.user_id = auth.uid())) with check(exists(select 1 from public.user_games ug where ug.id = user_game_id and ug.user_id = auth.uid()));
create policy reviews_read on public.reviews for select using(exists(select 1 from public.user_games ug where ug.id = user_game_id));
create policy reviews_owner on public.reviews for all to authenticated using(exists(select 1 from public.user_games ug where ug.id = user_game_id and ug.user_id = auth.uid())) with check(exists(select 1 from public.user_games ug where ug.id = user_game_id and ug.user_id = auth.uid()));
create policy reactions_read on public.review_reactions for select using(public.can_view_review(review_id));
create policy reactions_owner on public.review_reactions for all to authenticated using(user_id = auth.uid() and public.can_view_review(review_id)) with check(user_id = auth.uid() and public.can_view_review(review_id));
create policy comments_read on public.review_comments for select using(public.can_view_review(review_id));
create policy comments_add on public.review_comments for insert to authenticated with check(user_id = auth.uid() and public.can_view_review(review_id));
create policy comments_remove on public.review_comments for delete to authenticated using(user_id = auth.uid());
create policy lists_read on public.user_lists for select using(public.can_view_list(id));
create policy lists_owner on public.user_lists for all to authenticated using(user_id = auth.uid()) with check(user_id = auth.uid());
create policy items_read on public.list_items for select using(public.can_view_list(list_id));
create policy items_owner on public.list_items for all to authenticated using(exists(select 1 from public.user_lists l where l.id = list_id and l.user_id = auth.uid())) with check(exists(select 1 from public.user_lists l where l.id = list_id and l.user_id = auth.uid()));
create policy activity_read on public.activity_logs for select using(public.can_view_library(user_id));
create policy suggestions_owner on public.game_suggestions for select to authenticated using(user_id = auth.uid());
create policy suggestions_add on public.game_suggestions for insert to authenticated with check(user_id = auth.uid());
create policy reports_owner on public.reports for select to authenticated using(user_id = auth.uid());
create policy reports_add on public.reports for insert to authenticated with check(user_id = auth.uid() and public.can_view_review(review_id));

-- Remove implicit Supabase grants; expose only operations protected by policies.
revoke all on all tables in schema public from anon, authenticated;
grant select on public.profiles, public.games, public.user_games, public.play_logs, public.reviews, public.review_reactions, public.review_comments, public.user_lists, public.list_items, public.activity_logs to anon, authenticated;
grant select on public.follows, public.friendships, public.game_suggestions, public.reports to authenticated;
grant update(username, avatar_url, banner_url, theme_color, terminal_status, social_links, library_private) on public.profiles to authenticated;
grant insert, delete on public.follows, public.friendships to authenticated;
grant update(status) on public.friendships to authenticated;
grant insert, update, delete on public.user_games, public.play_logs, public.reviews, public.review_reactions, public.user_lists, public.list_items to authenticated;
grant insert, delete on public.review_comments to authenticated;
grant insert on public.game_suggestions, public.reports to authenticated;
grant all on all tables in schema public to service_role;

create function public.stamp_updated() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end; $$;
create trigger library_updated before update on public.user_games for each row execute function public.stamp_updated();
create trigger review_updated before update on public.reviews for each row execute function public.stamp_updated();

create function public.track_library() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status or new.rating is distinct from old.rating then
    insert into public.activity_logs(user_id, target_game_id, event_type, event_data)
    values(new.user_id, new.game_id, 'library_updated', jsonb_build_object('status',new.status,'rating',new.rating));
  end if;
  return new;
end; $$;
create trigger library_activity after insert or update on public.user_games for each row execute function public.track_library();

create function public.save_review(p_game_id uuid, p_rating numeric, p_content text, p_markdown text, p_has_spoilers boolean) returns uuid language plpgsql security invoker set search_path = '' as $$
declare library_id uuid; review_id uuid;
begin
  if auth.uid() is null or p_rating is null then raise exception 'Authentication and rating required'; end if;
  insert into public.user_games(user_id, game_id, rating) values(auth.uid(),p_game_id,p_rating)
    on conflict(user_id,game_id) do update set rating = excluded.rating returning id into library_id;
  insert into public.reviews(user_game_id,content,content_markdown,has_spoilers) values(library_id,p_content,p_markdown,p_has_spoilers)
    on conflict(user_game_id) do update set content = excluded.content, content_markdown = excluded.content_markdown, has_spoilers = excluded.has_spoilers returning id into review_id;
  return review_id;
end; $$;
create function public.set_favorites(p_game_ids uuid[]) returns void language plpgsql security invoker set search_path = '' as $$
declare game uuid; pos int := 0;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_game_ids is null or cardinality(p_game_ids) > 4 or exists(select 1 from unnest(p_game_ids) x where x is null) or (select count(distinct x) from unnest(p_game_ids) x) <> cardinality(p_game_ids) then raise exception 'Invalid Top 4'; end if;
  perform 1 from public.profiles where id = auth.uid() for update;
  update public.user_games set favorite_position = null where user_id = auth.uid() and favorite_position is not null;
  foreach game in array p_game_ids loop
    pos := pos + 1;
    insert into public.user_games(user_id,game_id,favorite_position) values(auth.uid(),game,pos)
      on conflict(user_id,game_id) do update set favorite_position = excluded.favorite_position;
  end loop;
end; $$;
create function public.community_rating(p_game_id uuid) returns table(average numeric, total bigint) language sql stable security definer set search_path = '' as $$
  select round(avg(ug.rating),1),count(ug.rating) from public.user_games ug join public.profiles p on p.id = ug.user_id where ug.game_id = p_game_id and not p.library_private;
$$;
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.can_view_library(uuid), public.can_view_review(uuid), public.can_view_list(uuid), public.community_rating(uuid) to anon, authenticated;
grant execute on function public.save_review(uuid,numeric,text,text,boolean), public.set_favorites(uuid[]) to authenticated;

-- Public assets are intentional: privacy is for library content, not avatar/banner identity.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('profiles','profiles',true,512000,array['image/webp']) on conflict(id) do nothing;
create policy profile_media_read on storage.objects for select using(bucket_id = 'profiles');
create policy profile_media_add on storage.objects for insert to authenticated with check(bucket_id = 'profiles' and (storage.foldername(name))[1] = auth.uid()::text);
create policy profile_media_edit on storage.objects for update to authenticated using(bucket_id = 'profiles' and (storage.foldername(name))[1] = auth.uid()::text) with check(bucket_id = 'profiles' and (storage.foldername(name))[1] = auth.uid()::text);
create policy profile_media_remove on storage.objects for delete to authenticated using(bucket_id = 'profiles' and (storage.foldername(name))[1] = auth.uid()::text);

-- Realtime broadcasts are RLS-filtered. Feed re-fetch also handles privacy changes.
alter publication supabase_realtime add table public.activity_logs;
-- Atomic budget shared by all Next.js instances: fewer than four IGDB calls per second.
create table public.igdb_request_budget (id int primary key check(id = 1), last_request_at timestamptz not null);
insert into public.igdb_request_budget values(1, '1970-01-01');
alter table public.igdb_request_budget enable row level security;
revoke all on public.igdb_request_budget from anon, authenticated;
create function public.claim_igdb_request() returns boolean language plpgsql security definer set search_path = '' as $$
declare updated int;
begin
  update public.igdb_request_budget set last_request_at = clock_timestamp() where id = 1 and last_request_at <= clock_timestamp() - interval '270 milliseconds';
  get diagnostics updated = row_count;
  return updated = 1;
end; $$;
revoke execute on function public.claim_igdb_request() from public, anon, authenticated;
grant execute on function public.claim_igdb_request() to service_role;
commit;
