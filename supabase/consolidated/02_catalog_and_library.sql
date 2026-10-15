-- ==============================================================================
-- DOMINIO 02: CATÁLOGO, BIBLIOTECA, RESEÑAS, LISTAS Y ACTIVIDAD
-- Savestate Schema Consolidado (Fase 2)
-- ==============================================================================

-- 1. Catálogo General de Juegos
create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  igdb_id bigint not null unique,
  title text not null,
  slug text not null unique,
  cover_url text,
  release_year integer,
  platforms text[] not null default '{}',
  genres text[] not null default '{}',
  developer text,
  publisher text,
  series text,
  synopsis text,
  steam_app_id integer unique,
  cached_at timestamptz not null default now()
);

create index if not exists games_title on public.games(lower(title));
create index if not exists games_platforms on public.games using gin(platforms);
create index if not exists games_genres on public.games using gin(genres);
create index if not exists idx_games_steam_app_id on public.games(steam_app_id) where steam_app_id is not null;

-- 2. Biblioteca de Juegos del Usuario
create table if not exists public.user_games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete cascade,
  status text not null default 'backlog' check (status in ('playing', 'backlog', 'cleared', 'platinum', 'dropped', 'wishlist')),
  rating numeric check (rating between 1 and 10 and mod(rating, 0.5) = 0),
  favorite_position integer check (favorite_position between 1 and 4),
  owned_platforms text[] not null default '{}',
  updated_at timestamptz not null default now(),
  unique(user_id, game_id),
  unique(user_id, favorite_position)
);

create index if not exists user_games_game on public.user_games(game_id);
create index if not exists idx_user_games_user_status on public.user_games(user_id, status);

-- 3. Bitácora de Sesiones de Juego (Play Logs)
create table if not exists public.play_logs (
  id uuid primary key default gen_random_uuid(),
  user_game_id uuid not null references public.user_games(id) on delete cascade,
  platform_played text not null check (length(platform_played) between 1 and 100),
  play_method text not null check (play_method in ('hardware', 'emulator', 'other')),
  difficulty text not null default '' check (length(difficulty) <= 80),
  hours_played numeric(8,2) not null default 0 check (hours_played between 0 and 100000),
  start_date date,
  finish_date date,
  note text not null default '' check (length(note) <= 2000),
  console_progress_type text check (console_progress_type in ('gamerscore', 'trophies', 'achievements')),
  console_progress_value integer check (console_progress_value >= 0),
  created_at timestamptz not null default now(),
  check (finish_date >= start_date)
);

create index if not exists play_logs_user_game on public.play_logs(user_game_id);

-- 4. Reseñas y Críticas
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_game_id uuid not null unique references public.user_games(id) on delete cascade,
  content text not null check (length(content) between 1 and 100000),
  content_markdown text not null check (length(content_markdown) between 1 and 10000),
  has_spoilers boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.review_reactions (
  review_id uuid not null references public.reviews(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reaction_type text not null check (reaction_type in ('critical_hit', 'gg', 'game_over')),
  created_at timestamptz not null default now(),
  primary key(review_id, user_id)
);

create index if not exists idx_review_reactions_user on public.review_reactions(user_id);

create table if not exists public.review_comments (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (length(content) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists idx_review_comments_review on public.review_comments(review_id, created_at);
create index if not exists idx_review_comments_user on public.review_comments(user_id);

-- 5. Listas Personalizadas y Elementos
create table if not exists public.user_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check(length(title) between 1 and 120),
  description text not null default '' check(length(description) <= 2000),
  is_private boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.user_lists(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete cascade,
  position integer not null check (position >= 0),
  note text not null default '' check (length(note) <= 500),
  created_at timestamptz not null default now(),
  unique(list_id, game_id)
);

create index if not exists idx_list_items_game on public.list_items(game_id);

-- 6. Registro de Actividad (Activity Logs)
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null,
  target_game_id uuid references public.games(id) on delete cascade,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_activity_target_game on public.activity_logs(target_game_id);
create index if not exists idx_activity_user_created on public.activity_logs(user_id, created_at desc);

-- 7. RLS
alter table public.games enable row level security;
alter table public.user_games enable row level security;
alter table public.play_logs enable row level security;
alter table public.reviews enable row level security;
alter table public.review_reactions enable row level security;
alter table public.review_comments enable row level security;
alter table public.user_lists enable row level security;
alter table public.list_items enable row level security;
alter table public.activity_logs enable row level security;

create policy games_read on public.games for select using (true);

create policy user_games_read on public.user_games for select using (public.can_view_library(user_id));
create policy user_games_manage on public.user_games for all using (user_id = (select auth.uid()));

create policy play_logs_manage on public.play_logs for all using (
  exists (select 1 from public.user_games ug where ug.id = user_game_id and ug.user_id = (select auth.uid()))
);

create policy reviews_read on public.reviews for select using (true);
create policy reviews_manage on public.reviews for all using (
  exists (select 1 from public.user_games ug where ug.id = user_game_id and ug.user_id = (select auth.uid()))
);

create policy review_reactions_read on public.review_reactions for select using (true);
create policy review_reactions_manage on public.review_reactions for all using (user_id = (select auth.uid()));

create policy review_comments_read on public.review_comments for select using (true);
create policy review_comments_manage on public.review_comments for all using (user_id = (select auth.uid()));

create policy user_lists_read on public.user_lists for select using (not is_private or user_id = (select auth.uid()));
create policy user_lists_manage on public.user_lists for all using (user_id = (select auth.uid()));

create policy list_items_read on public.list_items for select using (
  exists (select 1 from public.user_lists ul where ul.id = list_id and (not ul.is_private or ul.user_id = (select auth.uid())))
);
create policy list_items_manage on public.list_items for all using (
  exists (select 1 from public.user_lists ul where ul.id = list_id and ul.user_id = (select auth.uid()))
);

create policy activity_logs_read on public.activity_logs for select using (public.can_view_library(user_id));
