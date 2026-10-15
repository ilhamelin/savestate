-- ==============================================================================
-- DOMINIO 06: MULTIMEDIA, SCREEN JOURNAL, WATCHLIST Y MEDIA VAULT
-- Savestate Schema Consolidado (Fase 2)
-- ==============================================================================

-- 1. Diario de Cine y TV (Screen Journal & Watchlist)
create table if not exists public.user_screen_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tmdb_id integer not null check (tmdb_id > 0),
  media_type text not null check (media_type in ('tv', 'movie')),
  title text not null check (char_length(title) between 1 and 300),
  poster_path text,
  backdrop_path text,
  status text not null default 'plan_to_watch' check (status in ('watching', 'plan_to_watch', 'completed', 'dropped')),
  rating numeric(3,1) check (rating between 0 and 10 and mod(rating * 2, 1) = 0),
  current_season integer not null default 1 check (current_season between 1 and 999),
  current_episode integer not null default 0 check (current_episode between 0 and 9999),
  total_episodes integer not null default 0 check (total_episodes between 0 and 5000),
  watched_episodes integer[] not null default '{}' check (cardinality(watched_episodes) <= 5000),
  notes text check (char_length(notes) <= 2000),
  followed boolean not null default false,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, tmdb_id, media_type)
);

create index if not exists user_screen_entries_user_status_idx on public.user_screen_entries(user_id, status);
create index if not exists user_screen_entries_followed_idx on public.user_screen_entries(user_id, updated_at desc) where followed;
create index if not exists idx_user_screen_entries_tmdb on public.user_screen_entries(tmdb_id, media_type);

-- 2. Baúl de Medios (Memory Card / Media Vault)
create table if not exists public.user_vault_media (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  r2_key text not null unique,
  file_name text not null check (length(file_name) between 1 and 200),
  file_size bigint not null check (file_size between 1 and 104857600),
  mime_type text not null check (mime_type in ('image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4', 'video/webm')),
  status text not null default 'pending' check (status in ('pending', 'ready')),
  public_url text,
  created_at timestamptz not null default now(),
  check (split_part(r2_key, '/', 1) = user_id::text)
);

create index if not exists user_vault_media_owner on public.user_vault_media(user_id, created_at desc);
create index if not exists idx_user_vault_media_status on public.user_vault_media(user_id, status);

-- 3. Row Level Security (RLS)
alter table public.user_screen_entries enable row level security;
alter table public.user_vault_media enable row level security;

-- Screen entries policies (optimizadas con InitPlan subquery)
create policy screen_owner_select on public.user_screen_entries
  for select to authenticated using ((select auth.uid()) = user_id);

create policy screen_owner_insert on public.user_screen_entries
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy screen_owner_update on public.user_screen_entries
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy screen_owner_delete on public.user_screen_entries
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Media vault policies
create policy vault_owner_select on public.user_vault_media
  for select to authenticated using (user_id = (select auth.uid()));

create policy vault_owner_insert on public.user_vault_media
  for insert to authenticated with check (user_id = (select auth.uid()));

create policy vault_owner_update on public.user_vault_media
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy vault_owner_delete on public.user_vault_media
  for delete to authenticated using (user_id = (select auth.uid()));
