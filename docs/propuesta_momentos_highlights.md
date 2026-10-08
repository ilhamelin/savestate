# Propuesta Técnica: Sistema de Momentos y Publicaciones de la Comunidad ("Highlights")
**Fecha:** 7 de octubre de 2026  
**Origen:** Auditoría e Investigación (`research/antigravity`)  
**Destino:** Equipo de Implementación (`implementation/chatgpt` / Codex)  
**Propósito:** Especificar el modelo de datos, seguridad, integración de medios y componentes de UI para permitir a los jugadores compartir publicaciones con capturas, descripciones y videos embebidos de sus momentos épicos, graciosos o emotivos.

---

## 1. Visión y Alcance Funcional

Se introduce un nuevo módulo social comunitario: **"Momentos Gamer" (Highlights / Posts)**.
Permite a cualquier jugador autenticado crear publicaciones enriquecidas:
1. **Contenido:** Título (máx. 120 caracteres), descripción en Markdown sanitizado y etiqueta de categoría (`Épico`, `Emotivo`, `Gracioso`, `Glitch`, `Speedrun`, `Otro`).
2. **Vinculación con Catálogo (Opcional):** El usuario puede asociar el momento a un juego existente en la tabla `games` para que aparezca tanto en su perfil como en la ficha del juego.
3. **Multimedia Híbrida y Segura:**
   - **Imágenes:** Hasta 4 capturas en formato WebP comprimidas en cliente (máx. 1 MB por imagen) almacenadas en un nuevo bucket `highlights`.
   - **Videos:** Soporte para enlaces de **YouTube / YouTube Shorts**. Se almacena únicamente el `youtube_video_id` (11 caracteres) para reproducirse inline mediante `iframe` seguro (`youtube-nocookie.com`), garantizando costo cero de almacenamiento y reproducción fluida a 1080p/60fps.
4. **Interacción Comunitaria:**
   - Reacciones temáticas (`critical_hit`, `gg`, `game_over`).
   - Comentarios de otros jugadores protegidos por RLS.
5. **Transmisión en Tiempo Real:** Emisión automática a `activity_logs` para que los nuevos momentos aparezcan en vivo en la página `/feed`.

---

## 2. Nueva Migración SQL: `202610070004_highlights.sql`

Esta migración se aplicará como la cuarta migración secuencial en Supabase sin modificar las tablas previas:

```sql
begin;

-- 1. Tabla principal de publicaciones de momentos
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  game_id uuid references public.games(id) on delete set null,
  title text not null check (length(title) between 3 and 120),
  content text not null default '' check (length(content) <= 5000),
  category text not null default 'epic' check (category in ('epic', 'emotional', 'funny', 'glitch', 'speedrun', 'other')),
  media_type text not null default 'none' check (media_type in ('none', 'images', 'youtube')),
  image_urls text[] not null default '{}' check (cardinality(image_urls) <= 4),
  youtube_video_id text check (youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  is_private boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index posts_user on public.posts(user_id, created_at desc);
create index posts_game on public.posts(game_id);
create index posts_category on public.posts(category);

-- 2. Reacciones a publicaciones
create table public.post_reactions (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reaction_type text not null check (reaction_type in ('critical_hit', 'gg', 'game_over')),
  primary key (post_id, user_id)
);

-- 3. Comentarios en publicaciones
create table public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (length(content) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index post_comments_post on public.post_comments(post_id, created_at);

-- 4. Funciones de visibilidad
create function public.can_view_post(p_post_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.posts p
    where p.id = p_post_id and (
      p.user_id = auth.uid() or
      (not p.is_private and public.can_view_library(p.user_id))
    )
  );
$$;

-- 5. Trigger para emisión de actividad a Transmisión
create function public.track_post_activity() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.game_id is not null then
    insert into public.activity_logs(user_id, target_game_id, event_type, event_data)
    values(new.user_id, new.game_id, 'moment_shared', jsonb_build_object('post_id', new.id, 'title', new.title, 'category', new.category));
  end if;
  return new;
end; $$;

create trigger on_post_created after insert on public.posts
  for each row execute function public.track_post_activity();

-- 6. Row Level Security
alter table public.posts enable row level security;
alter table public.post_reactions enable row level security;
alter table public.post_comments enable row level security;

create policy posts_read on public.posts for select using (public.can_view_post(id));
create policy posts_create on public.posts for insert to authenticated with check (user_id = auth.uid());
create policy posts_update on public.posts for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy posts_delete on public.posts for delete to authenticated using (user_id = auth.uid());

create policy post_reactions_read on public.post_reactions for select using (public.can_view_post(post_id));
create policy post_reactions_manage on public.post_reactions for all to authenticated
  using (user_id = auth.uid() and public.can_view_post(post_id))
  with check (user_id = auth.uid() and public.can_view_post(post_id));

create policy post_comments_read on public.post_comments for select using (public.can_view_post(post_id));
create policy post_comments_create on public.post_comments for insert to authenticated
  with check (user_id = auth.uid() and public.can_view_post(post_id));
create policy post_comments_delete on public.post_comments for delete to authenticated using (user_id = auth.uid());

-- Permisos
grant select on public.posts, public.post_reactions, public.post_comments to anon, authenticated;
grant insert, update, delete on public.posts, public.post_reactions to authenticated;
grant insert, delete on public.post_comments to authenticated;
grant execute on function public.can_view_post(uuid) to anon, authenticated;

-- 7. Storage Bucket para capturas de momentos
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values('highlights', 'highlights', true, 1048576, array['image/webp']) on conflict(id) do nothing;

create policy highlights_read on storage.objects for select using (bucket_id = 'highlights');
create policy highlights_add on storage.objects for insert to authenticated
  with check (bucket_id = 'highlights' and (storage.foldername(name))[1] = auth.uid()::text);
create policy highlights_remove on storage.objects for delete to authenticated
  using (bucket_id = 'highlights' and (storage.foldername(name))[1] = auth.uid()::text);

commit;
```

---

## 3. Ajustes de Seguridad y CSP en `src/proxy.ts`

Para permitir la reproducción segura de videos de YouTube, se debe autorizar el dominio de incrustación con privacidad mejorada en la cabecera `Content-Security-Policy`:
- Añadir a la directiva `frame-src`: `'self' https://www.youtube-nocookie.com;`.

---

## 4. Componentes y Rutas Propuestas

1. **Ruta y Vistas:**
   - `/highlights`: Muro/feed público con los momentos más recientes de la comunidad, filtrables por categoría (`Épico`, `Gracioso`, `Glitch`, etc.).
   - Sección en el perfil de jugador (`/players/[username]`): pestaña *"Momentos"*.
   - Sección opcional en la ficha del juego (`/games/[slug]`): *"Momentos destacados de este juego"*.
2. **Componentes:**
   - `src/components/highlights/post-card.tsx`: Tarjeta con visualizador de carrusel de imágenes WebP o reproductor responsivo de YouTube.
   - `src/components/highlights/post-form.tsx`: Formulario de publicación con parser de enlaces de YouTube (soporta `youtu.be/ID`, `youtube.com/watch?v=ID`, `youtube.com/shorts/ID`).
   - `src/components/highlights/post-actions.tsx`: Reacciones temáticas y acordeón de comentarios.
