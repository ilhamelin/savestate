# Propuesta Técnica: Tableros de Discusión y Foros Comunitarios ("SaveState Boards")
**Fecha:** 8 de octubre de 2026  
**Origen:** Auditoría e Investigación (`research/antigravity`)  
**Destino:** Equipo de Implementación (`implementation/chatgpt` / Codex)  
**Propósito:** Especificar la arquitectura relacional, políticas de seguridad RLS, triggers atómicos y componentes de interfaz para la creación del sistema de Foros y Conversaciones comunitarias en SaveState.

---

## 1. Visión General del Módulo

El sistema de foros recupera el espíritu de las comunidades clásicas de videojuegos (GameFAQs, NeoGAF, foros de 16/32 bits) pero impulsado por **Next.js 16**, **Supabase (PostgreSQL 16)** y **WebSockets en tiempo real**.

### Pilares de diseño:
1. **Jerarquía Clara:** Canales Temáticos (`forum_categories`) > Hilos de Discusión (`forum_threads`) > Respuestas en Hilo (`forum_replies`).
2. **Conexión con el Catálogo Gamer:** Un hilo puede vincularse opcionalmente a un juego existente (`game_id`). Si se asocia, el debate aparecerá tanto en el foro general como en la ficha del título (`/games/[slug]`).
3. **Alto Rendimiento en Lectura:** Contadores de respuestas y marcas temporales desnormalizadas mediante triggers automáticos en la base de datos para evitar consultas lentas con `COUNT(*)`.
4. **Respuestas en Vivo:** Soporte para suscripción por Supabase Realtime para recibir nuevas respuestas al instante sin refrescar la página.
5. **Identidad Retro en los Mensajes:** Cada respuesta presenta la tarjeta del jugador con su avatar, estado de terminal, medallas desbloqueadas y estilo de habitación gamer.
6. **Integración con Notificaciones:** Al responder o citar a un usuario, se dispara una notificación automática a la **Campanita del Header**.

---

## 2. Nueva Migración SQL: `202610080011_forum_boards.sql`

```sql
begin;

-- 1. Categorías / Canales Temáticos del Foro
create table public.forum_categories (
  id text primary key,
  name text not null,
  description text not null,
  icon text not null default 'message-square',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- Semilla de categorías iniciales
insert into public.forum_categories (id, name, description, icon, sort_order)
values
  ('retro-corner', 'La Taberna Retro', 'Debates, anécdotas y conservación de consolas de 8, 16 y 32 bits, arcades y joyas del pasado.', 'gamepad-2', 1),
  ('general-gaming', 'Actualidad y Debate', 'Lanzamientos recientes, impresiones, noticias de la industria y debates generales.', 'flame', 2),
  ('guides-secrets', 'Guías, Trucos y Secretos', 'Estrategias, resoluciones de atascos, speedruns y coleccionables compartidos.', 'map', 3),
  ('indie-sanctuary', 'El Rincón Indie', 'Descubrimientos ocultos, desarrolladores independientes y obras de autor.', 'sparkles', 4),
  ('off-topic', 'Zona de Descanso (Off-Topic)', 'Música chiptune, setups gamer, cine, anime y charlas libres entre jugadores.', 'coffee', 5)
on conflict (id) do nothing;

-- 2. Hilos de Conversación
create table public.forum_threads (
  id uuid primary key default gen_random_uuid(),
  category_id text not null references public.forum_categories(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  game_id uuid references public.games(id) on delete set null,
  title text not null check (length(title) between 3 and 150),
  content text not null check (length(content) between 5 and 10000),
  is_pinned boolean not null default false,
  is_locked boolean not null default false,
  views_count int not null default 0,
  replies_count int not null default 0,
  last_reply_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Índices de consulta de alta velocidad
create index idx_threads_category_feed 
  on public.forum_threads(category_id, is_pinned desc, last_reply_at desc);
create index idx_threads_user 
  on public.forum_threads(user_id, created_at desc);
create index idx_threads_game 
  on public.forum_threads(game_id) where game_id is not null;

-- 3. Respuestas a los Hilos
create table public.forum_replies (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.forum_threads(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reply_to_id uuid references public.forum_replies(id) on delete set null,
  content text not null check (length(content) between 1 and 8000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_replies_thread_order 
  on public.forum_replies(thread_id, created_at asc);

-- 4. Reacciones a las Respuestas
create table public.forum_reactions (
  reply_id uuid not null references public.forum_replies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reaction_type text not null check (reaction_type in ('like', 'gg', 'mind_blown', 'game_over')),
  primary key (reply_id, user_id)
);

-- 5. Triggers Atómicos para contadores y notificaciones

-- 5.1. Actualizar contador de respuestas y fecha de última actividad en el hilo
create or replace function public.on_forum_reply_created()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.forum_threads
  set replies_count = replies_count + 1,
      last_reply_at = new.created_at,
      updated_at = now()
  where id = new.thread_id;
  return new;
end;
$$;

create trigger trigger_forum_reply_stats
  after insert on public.forum_replies
  for each row execute function public.on_forum_reply_created();

-- 5.2. Notificar al autor del hilo o al usuario citado
create or replace function public.notify_forum_reply()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  thread_author_id uuid;
  quoted_author_id uuid;
begin
  -- Obtener autor del hilo
  select user_id into thread_author_id from public.forum_threads where id = new.thread_id;

  -- Si es respuesta a un mensaje específico (cita)
  if new.reply_to_id is not null then
    select user_id into quoted_author_id from public.forum_replies where id = new.reply_to_id;
    if quoted_author_id is not null and quoted_author_id <> new.user_id then
      insert into public.notifications (user_id, actor_id, kind)
      values (quoted_author_id, new.user_id, 'forum_quote');
    end if;
  end if;

  -- Notificar al creador del hilo si no es quien responde ni fue ya citado
  if thread_author_id is not null and thread_author_id <> new.user_id and thread_author_id <> coalesce(quoted_author_id, '00000000-0000-0000-0000-000000000000'::uuid) then
    insert into public.notifications (user_id, actor_id, kind)
    values (thread_author_id, new.user_id, 'forum_reply');
  end if;

  return new;
end;
$$;

create trigger trigger_forum_notifications
  after insert on public.forum_replies
  for each row execute function public.notify_forum_reply();

-- 5.3. Incremento atómico de lecturas (Views)
create or replace function public.increment_thread_views(p_thread_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.forum_threads
  set views_count = views_count + 1
  where id = p_thread_id;
end;
$$;

-- 6. Row Level Security (RLS)
alter table public.forum_categories enable row level security;
alter table public.forum_threads enable row level security;
alter table public.forum_replies enable row level security;
alter table public.forum_reactions enable row level security;

-- Categorías: Lectura pública
create policy forum_categories_read on public.forum_categories for select using (true);

-- Hilos: Lectura pública, creación para autenticados, edición solo para el autor
create policy forum_threads_read on public.forum_threads for select using (true);
create policy forum_threads_create on public.forum_threads for insert to authenticated
  with check (user_id = auth.uid());
create policy forum_threads_update on public.forum_threads for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy forum_threads_delete on public.forum_threads for delete to authenticated
  using (user_id = auth.uid());

-- Respuestas: Lectura pública, creación para autenticados (si el hilo no está cerrado)
create policy forum_replies_read on public.forum_replies for select using (true);
create policy forum_replies_create on public.forum_replies for insert to authenticated
  with check (
    user_id = auth.uid() and 
    exists (select 1 from public.forum_threads where id = thread_id and not is_locked)
  );
create policy forum_replies_update on public.forum_replies for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy forum_replies_delete on public.forum_replies for delete to authenticated
  using (user_id = auth.uid());

-- Reacciones
create policy forum_reactions_read on public.forum_reactions for select using (true);
create policy forum_reactions_manage on public.forum_reactions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Permisos
grant select on public.forum_categories, public.forum_threads, public.forum_replies, public.forum_reactions to anon, authenticated;
grant insert, update, delete on public.forum_threads, public.forum_replies, public.forum_reactions to authenticated;
grant execute on function public.increment_thread_views(uuid) to anon, authenticated;

commit;
```

---

## 3. Arquitectura de Navegación e Interfaz

### 3.1. Rutas
1. **`/forum` (Directorio de Canales):**
   - Tarjetas retro para las 5 categorías principales con iconos, descripción y estadísticas (`N hilos`, `N mensajes`, última actividad).
   - Bloque lateral o superior: *"Hilos más calientes"* (ordenados por respuestas recientes).
   - Botón destacado: `[+ Crear Nuevo Hilo]`.
2. **`/forum/[category]` (Muro de la Categoría):**
   - Tabla de hilos con estética retro/terminal:
     - Estado (`[Fijado]`, `[Cerrado]`, `[Normal]`).
     - Título del hilo y badge del juego asociado (si existe).
     - Autor con su avatar en miniatura y color de acento.
     - Métricas (`Respuestas`, `Vistas`).
     - Última respuesta (`@usuario · hace 10 min`).
   - Paginación cada 20 hilos.
3. **`/forum/[category]/[thread_id]` (Visualizador de Conversación):**
   - **Mensaje Principal:** Cabecera con título, fecha, autor y cuerpo en Markdown formateado con soporte para `||spoilers||` y código.
   - **Feed de Respuestas:** Cada respuesta muestra una tarjeta clásica de foro con:
     - Columna lateral: Avatar, nombre de usuario, estado de terminal actual y medallas del usuario.
     - Contenido del mensaje, botón `[Citar / Responder]` y selector de reacciones rápidas (`+1`, `gg`, etc.).
   - **Editor Inferior:** Caja de texto con previsualización para redactar la respuesta.
   - **Realtime:** Suscripción activa que avisa discretamente si ingresan nuevas respuestas mientras el usuario lee.

---

## 4. Nuevas Etiquetas en el Sistema de Notificaciones

En `src/app/notifications/page.tsx` y en el menú de la campanita (`<NotificationBell />`):
```ts
labels: {
  // ...existentes...
  forum_reply: 'respondió en tu hilo del foro',
  forum_quote: 'te citó en una respuesta del foro',
}
```

---

## 5. Criterios de Aceptación y Calidad

1. La creación de respuestas actualiza automáticamente `replies_count` y `last_reply_at` en el hilo padre mediante trigger atómico sin race conditions.
2. Un hilo cerrado (`is_locked = true`) rechaza nuevas respuestas tanto en la interfaz como a nivel de RLS en base de datos.
3. Las notificaciones a la campanita se emiten únicamente cuando quien responde es un usuario diferente al creador del hilo o citado.
4. El rendimiento de carga en `/forum` se mantiene por debajo de 300 ms mediante Server Components e índices optimizados.
