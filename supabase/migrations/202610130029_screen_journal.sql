begin;
create table if not exists public.user_screen_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tmdb_id integer not null check (tmdb_id > 0),
  media_type text not null check (media_type in ('tv','movie')),
  title text not null check (char_length(title) between 1 and 300),
  poster_path text, backdrop_path text,
  status text not null default 'plan_to_watch' check (status in ('watching','plan_to_watch','completed','dropped')),
  rating numeric(3,1) check (rating between 0 and 10 and mod(rating * 2,1) = 0),
  current_season integer not null default 1 check (current_season between 1 and 999),
  current_episode integer not null default 0 check (current_episode between 0 and 9999),
  total_episodes integer not null default 0 check (total_episodes between 0 and 5000),
  watched_episodes integer[] not null default '{}' check (cardinality(watched_episodes) <= 5000),
  notes text check (char_length(notes) <= 2000),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id,tmdb_id,media_type)
);
create index if not exists user_screen_entries_user_status_idx on public.user_screen_entries(user_id,status);
alter table public.user_screen_entries enable row level security;
revoke all on public.user_screen_entries from anon, authenticated;
grant select, delete on public.user_screen_entries to authenticated;
grant insert (user_id,tmdb_id,media_type,title,poster_path,backdrop_path,status,rating,current_season,current_episode,total_episodes,watched_episodes,notes) on public.user_screen_entries to authenticated;
grant update (title,poster_path,backdrop_path,status,rating,current_season,current_episode,total_episodes,watched_episodes,notes) on public.user_screen_entries to authenticated;
drop policy if exists screen_owner_select on public.user_screen_entries;
create policy screen_owner_select on public.user_screen_entries for select to authenticated using (auth.uid() = user_id);
drop policy if exists screen_owner_insert on public.user_screen_entries;
create policy screen_owner_insert on public.user_screen_entries for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists screen_owner_update on public.user_screen_entries;
create policy screen_owner_update on public.user_screen_entries for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists screen_owner_delete on public.user_screen_entries;
create policy screen_owner_delete on public.user_screen_entries for delete to authenticated using (auth.uid() = user_id);
create or replace function public.touch_screen_entry() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := clock_timestamp(); return new; end;
$$;
revoke all on function public.touch_screen_entry() from public,anon,authenticated;
drop trigger if exists screen_entry_updated on public.user_screen_entries;
create trigger screen_entry_updated before update on public.user_screen_entries for each row execute function public.touch_screen_entry();
comment on column public.user_screen_entries.watched_episodes is 'Season-aware keys: season_number * 10000 + episode_number. No overlap between seasons.';
commit;
