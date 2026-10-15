-- ==============================================================================
-- DOMINIO 01: CORE SCHEMA, PERFILES Y RELACIONES SOCIALES
-- Savestate Schema Consolidado (Fase 2)
-- Incluye optimizaciones de índices RLS y claves foráneas hasta migración 034
-- ==============================================================================

-- 1. Tabla de Perfiles de Usuario
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[A-Za-z0-9_]{3,30}$'),
  avatar_url text,
  banner_url text,
  wallpaper_url text,
  theme_color text not null default 'cyan' check (
    theme_color in ('cyan', 'green', 'pink', 'amber', 'halloween', 'purple', 'christmas', 'ice')
    or theme_color ~ '^#[0-9a-fA-F]{6}$'
  ),
  room_theme text not null default 'crt_terminal' check (
    room_theme in (
      'crt_terminal', 'handheld_console', 'retro_shelf', 'arcade_cabinet',
      'cyber_deck', 'vaporwave_shrine', 'halloween_crypt', 'christmas_lodge'
    )
  ),
  terminal_status text not null default '' check (length(terminal_status) <= 160),
  social_links jsonb not null default '{}' check (jsonb_typeof(social_links) = 'object'),
  library_private boolean not null default false,
  xp integer not null default 0 check (xp >= 0),
  level integer not null default 1 check (level >= 1),
  equipped_title text not null default 'Insert Coin',
  equipped_frame text not null default 'default',
  created_at timestamptz not null default now()
);

create unique index if not exists profiles_username_lower on public.profiles(lower(username));

-- Trigger de creación automática de perfil al registrarse un usuario en auth.users
create or replace function public.create_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, username)
  values (new.id, 'player_' || left(replace(new.id::text, '-', ''), 23));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.create_profile();

-- 2. Sistema de Seguidores (Follows)
create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followed_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_id),
  check (follower_id <> followed_id)
);

create index if not exists idx_follows_followed on public.follows(followed_id);

-- 3. Sistema de Amistades (Friendships)
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  check (sender_id <> receiver_id)
);

create unique index if not exists friendships_pair
  on public.friendships(least(sender_id, receiver_id), greatest(sender_id, receiver_id));
create index if not exists friendships_receiver on public.friendships(receiver_id, status);
create index if not exists idx_friendships_sender on public.friendships(sender_id, status);

-- 4. Funciones de Visibilidad y Estado de Amigos
create or replace function public.can_view_library(owner_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = owner_id and (
      not p.library_private
      or p.id = (select auth.uid())
      or exists (
        select 1 from public.friendships f
        where f.status = 'accepted'
        and (
          (f.sender_id = owner_id and f.receiver_id = (select auth.uid()))
          or (f.receiver_id = owner_id and f.sender_id = (select auth.uid()))
        )
      )
    )
  );
$$;

create or replace function public.get_player_friends(p_user_id uuid)
returns table (
  id uuid,
  username text,
  avatar_url text,
  level integer,
  terminal_status text,
  current_game text,
  last_seen_at timestamptz
)
language sql stable security invoker set search_path = '' as $$
  select
    p.id,
    p.username,
    p.avatar_url,
    coalesce(p.level, 1),
    p.terminal_status,
    playing.title as current_game,
    coalesce(act.last_active, p.created_at) as last_seen_at
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
  left join lateral (
    select max(al.created_at) as last_active
    from public.activity_logs al
    where al.user_id = p.id
  ) act on true
  where (f.sender_id = p_user_id or f.receiver_id = p_user_id)
    and f.status = 'accepted'
  order by p.username;
$$;

-- 5. Row Level Security (RLS)
alter table public.profiles enable row level security;
alter table public.follows enable row level security;
alter table public.friendships enable row level security;

-- Profiles policies
create policy profiles_read on public.profiles for select using (true);
create policy profiles_update on public.profiles for update using (id = (select auth.uid()));

-- Follows policies
create policy follows_read on public.follows for select using (true);
create policy follows_manage on public.follows for all using (follower_id = (select auth.uid()));

-- Friendships policies
create policy friendships_read on public.friendships for select using (
  status = 'accepted' or sender_id = (select auth.uid()) or receiver_id = (select auth.uid())
);
create policy friendships_insert on public.friendships for insert with check (sender_id = (select auth.uid()));
create policy friendships_update on public.friendships for update using (
  sender_id = (select auth.uid()) or receiver_id = (select auth.uid())
);
create policy friendships_delete on public.friendships for delete using (
  sender_id = (select auth.uid()) or receiver_id = (select auth.uid())
);
