-- ==============================================================================
-- DOMINIO 03: SOCIAL, MOMENTOS, COMENTARIOS, NOTIFICACIONES Y CHATS
-- Savestate Schema Consolidado (Fase 2)
-- ==============================================================================

-- 1. Publicaciones / Momentos (Posts)
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (length(content) between 1 and 5000),
  media_url text,
  media_type text check (media_type in ('image', 'video', 'gif')),
  game_id uuid references public.games(id) on delete set null,
  privacy text not null default 'public' check (privacy in ('public', 'friends', 'private')),
  is_highlight boolean not null default false,
  likes_count integer not null default 0 check (likes_count >= 0),
  comments_count integer not null default 0 check (comments_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_posts_user_created on public.posts(user_id, created_at desc);
create index if not exists idx_posts_game on public.posts(game_id) where game_id is not null;

-- 2. Reacciones y Comentarios de Posts
create table if not exists public.post_reactions (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reaction_type text not null default 'like',
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists idx_post_reactions_user on public.post_reactions(user_id);

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (length(content) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists idx_post_comments_post on public.post_comments(post_id, created_at);
create index if not exists idx_post_comments_user on public.post_comments(user_id);

-- 3. Notificaciones del Sistema
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null default '',
  message text not null default '',
  link text,
  actor_id uuid references public.profiles(id) on delete cascade,
  thread_id uuid,
  badge_id uuid,
  itch_item_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user_created on public.notifications(user_id, created_at desc);
create index if not exists idx_notifications_actor on public.notifications(actor_id);
create index if not exists idx_notifications_thread on public.notifications(thread_id);
create index if not exists idx_notifications_badge on public.notifications(badge_id);
create index if not exists idx_notifications_itch on public.notifications(itch_item_id);

-- Índice parcial especializado de alto rendimiento para el contador de no leídas
create index if not exists idx_notifications_unread
  on public.notifications(user_id, created_at desc)
  where read_at is null;

-- 4. Mensajería Directa entre Amigos (Friend Direct Messages)
create table if not exists public.friend_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (length(content) between 1 and 2000),
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  check (sender_id <> receiver_id)
);

create index if not exists idx_friend_messages_sender on public.friend_messages(sender_id, created_at desc);
create index if not exists idx_friend_messages_receiver on public.friend_messages(receiver_id, read_at);
create index if not exists idx_friend_messages_conversation on public.friend_messages(
  least(sender_id, receiver_id),
  greatest(sender_id, receiver_id),
  created_at desc
);

-- 5. Chat Global
create table if not exists public.global_chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  message text not null check (length(message) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists idx_global_chat_created on public.global_chat_messages(created_at desc);

-- 6. Row Level Security (RLS)
alter table public.posts enable row level security;
alter table public.post_reactions enable row level security;
alter table public.post_comments enable row level security;
alter table public.notifications enable row level security;
alter table public.friend_messages enable row level security;
alter table public.global_chat_messages enable row level security;

-- Posts policies
create policy posts_read on public.posts for select using (
  privacy = 'public'
  or user_id = (select auth.uid())
  or (privacy = 'friends' and exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
    and ((f.sender_id = posts.user_id and f.receiver_id = (select auth.uid()))
      or (f.receiver_id = posts.user_id and f.sender_id = (select auth.uid())))
  ))
);
create policy posts_manage on public.posts for all using (user_id = (select auth.uid()));

-- Post reactions policies
create policy post_reactions_read on public.post_reactions for select using (true);
create policy post_reactions_manage on public.post_reactions for all using (user_id = (select auth.uid()));

-- Post comments policies
create policy post_comments_read on public.post_comments for select using (true);
create policy post_comments_manage on public.post_comments for all using (user_id = (select auth.uid()));

-- Notifications policies (optimizadas con subconsulta escalar InitPlan)
create policy notifications_read on public.notifications for select using (user_id = (select auth.uid()));
create policy notifications_update on public.notifications for update using (user_id = (select auth.uid()));
create policy notifications_delete on public.notifications for delete using (user_id = (select auth.uid()));

-- Friend messages policies
create policy friend_messages_read on public.friend_messages for select using (
  sender_id = (select auth.uid()) or receiver_id = (select auth.uid())
);
create policy friend_messages_insert on public.friend_messages for insert with check (
  sender_id = (select auth.uid()) and exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
    and ((f.sender_id = (select auth.uid()) and f.receiver_id = friend_messages.receiver_id)
      or (f.receiver_id = (select auth.uid()) and f.sender_id = friend_messages.receiver_id))
  )
);
create policy friend_messages_update on public.friend_messages for update using (
  receiver_id = (select auth.uid()) or sender_id = (select auth.uid())
);

-- Global chat policies
create policy global_chat_read on public.global_chat_messages for select using (true);
create policy global_chat_insert on public.global_chat_messages for insert with check (user_id = (select auth.uid()));
