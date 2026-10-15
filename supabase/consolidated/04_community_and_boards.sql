-- ==============================================================================
-- DOMINIO 04: COMUNIDAD, FOROS, INSIGNIAS, ARCADE Y NIVELES XP
-- Savestate Schema Consolidado (Fase 2)
-- ==============================================================================

-- 1. Foros y Tablones de Discusión
create table if not exists public.forum_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  icon text not null default 'message-square',
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.forum_threads (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.forum_categories(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (length(title) between 3 and 150),
  content text not null check (length(content) between 3 and 20000),
  is_pinned boolean not null default false,
  is_locked boolean not null default false,
  views_count integer not null default 0 check (views_count >= 0),
  replies_count integer not null default 0 check (replies_count >= 0),
  last_reply_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_forum_threads_category on public.forum_threads(category_id, is_pinned desc, last_reply_at desc);
create index if not exists idx_forum_threads_user on public.forum_threads(user_id);

create table if not exists public.forum_replies (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.forum_threads(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (length(content) between 1 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_forum_replies_thread on public.forum_replies(thread_id, created_at asc);
create index if not exists idx_forum_replies_user on public.forum_replies(user_id, created_at desc);

create table if not exists public.forum_reactions (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid references public.forum_threads(id) on delete cascade,
  reply_id uuid references public.forum_replies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reaction text not null check (reaction in ('like', 'fire', 'trophy', 'skull')),
  created_at timestamptz not null default now(),
  check ((thread_id is not null and reply_id is null) or (thread_id is null and reply_id is not null))
);

create index if not exists idx_forum_reactions_user on public.forum_reactions(user_id);

-- 2. Sistema de Insignias (Badges)
create table if not exists public.badges (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null,
  icon_url text not null,
  category text not null default 'general',
  xp_award integer not null default 0 check (xp_award >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.user_badges (
  user_id uuid not null references public.profiles(id) on delete cascade,
  badge_id uuid not null references public.badges(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

create index if not exists idx_user_badges_badge on public.user_badges(badge_id);

-- 3. Arcade y Duelos
create table if not exists public.arcade_duels (
  id uuid primary key default gen_random_uuid(),
  game_a_id uuid not null references public.games(id) on delete cascade,
  game_b_id uuid not null references public.games(id) on delete cascade,
  topic text not null default '',
  is_active boolean not null default true,
  votes_a integer not null default 0 check (votes_a >= 0),
  votes_b integer not null default 0 check (votes_b >= 0),
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (game_a_id <> game_b_id)
);

create table if not exists public.duel_votes (
  duel_id uuid not null references public.arcade_duels(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  chosen_game_id uuid not null references public.games(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (duel_id, user_id)
);

create index if not exists idx_duel_votes_user on public.duel_votes(user_id);
create index if not exists idx_duel_votes_chosen_game on public.duel_votes(chosen_game_id);

-- 4. Peticiones de Party / Multijugador
create table if not exists public.party_requests (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete cascade,
  title text not null check (length(title) between 3 and 100),
  description text not null default '',
  platform text not null,
  max_players integer not null default 4 check (max_players between 2 and 32),
  status text not null default 'open' check (status in ('open', 'full', 'closed')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_party_requests_game on public.party_requests(game_id);

-- 5. Registro de Eventos XP y Progresión
create table if not exists public.user_xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount integer not null check (amount > 0),
  action text not null,
  reference_id text,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_xp_events_unique_action
  on public.user_xp_events(user_id, action, reference_id) where reference_id is not null;
create index if not exists idx_user_xp_events_user_recent
  on public.user_xp_events(user_id, created_at desc);

-- 6. Row Level Security (RLS)
alter table public.forum_categories enable row level security;
alter table public.forum_threads enable row level security;
alter table public.forum_replies enable row level security;
alter table public.forum_reactions enable row level security;
alter table public.badges enable row level security;
alter table public.user_badges enable row level security;
alter table public.arcade_duels enable row level security;
alter table public.duel_votes enable row level security;
alter table public.party_requests enable row level security;
alter table public.user_xp_events enable row level security;

create policy forum_categories_read on public.forum_categories for select using (true);

create policy forum_threads_read on public.forum_threads for select using (true);
create policy forum_threads_insert on public.forum_threads for insert with check (user_id = (select auth.uid()));
create policy forum_threads_update on public.forum_threads for update using (user_id = (select auth.uid()));

create policy forum_replies_read on public.forum_replies for select using (true);
create policy forum_replies_insert on public.forum_replies for insert with check (user_id = (select auth.uid()));
create policy forum_replies_update on public.forum_replies for update using (user_id = (select auth.uid()));

create policy forum_reactions_read on public.forum_reactions for select using (true);
create policy forum_reactions_manage on public.forum_reactions for all using (user_id = (select auth.uid()));

create policy badges_read on public.badges for select using (true);
create policy user_badges_read on public.user_badges for select using (true);

create policy arcade_duels_read on public.arcade_duels for select using (true);
create policy duel_votes_read on public.duel_votes for select using (true);
create policy duel_votes_manage on public.duel_votes for all using (user_id = (select auth.uid()));

create policy party_requests_read on public.party_requests for select using (true);
create policy party_requests_manage on public.party_requests for all using (creator_id = (select auth.uid()));

create policy user_xp_events_read on public.user_xp_events for select using (user_id = (select auth.uid()));
