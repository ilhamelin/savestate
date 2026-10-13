# Especificación Técnica: Reemplazo de "Compañeros" por Chat Global en Tiempo Real (`/chat`) con Soporte de Imágenes y GIFs

## 1. Resumen y Objetivos
1. **Retiro de "Compañeros" (`/parties`)**:
   - Reemplazar el ítem de navegación `👥 Compañeros` en el navbar principal (`src/components/header-nav.tsx`) y en el pie de página (`src/app/layout.tsx`) por **`💬 Chat Global`** apuntando a `/chat`.
   - Redirigir de forma permanente cualquier visita o enlace antiguo a `/parties` hacia `/chat` (`redirect('/chat')`).
2. **Implementación de la Nueva Vista `/chat` ("Chat Global Arcade Lounge")**:
   - **Lectura abierta en tiempo real**: Cualquier visitante (incluso sin sesión) puede leer la conversación en vivo, ver las imágenes y los GIFs animados que publica la comunidad.
   - **Participación para usuarios registrados**: Los usuarios autenticados disponen de una caja de envío interactiva; los visitantes no autenticados ven un banner de invitación para iniciar sesión (`/login?next=/chat`).
   - **Soporte Multimedia Integral**:
     - Subida directa de archivos locales (**PNG**, **JPG**, **WebP**, **GIF animado** hasta 5 MB) a Supabase Storage (`chat-media`).
     - Soporte para adjuntar o pegar **enlaces directos de imágenes y GIFs** de internet (Giphy, Tenor, Imgur, Discord CDN, etc.) con previsualización inmediata.

---

## 2. Base de Datos, Storage y Realtime en Supabase

### 2.1. Migración SQL (`supabase/migrations/202610130028_global_chat.sql`)
```sql
begin;

-- 1. Tabla de Mensajes del Chat Global
create table if not exists public.global_chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text check (
    (content is not null and char_length(trim(content)) between 1 and 1000)
    or (content is null and media_url is not null)
  ),
  media_url text check (
    media_url is null
    or media_url ~ '^https?://[^\s]+$'
    or media_url ~ '^/storage/[^\s]+$'
  ),
  media_type text check (media_type is null or media_type in ('image', 'gif')),
  created_at timestamptz not null default now()
);

-- 2. Índice cronológico para paginación e historial
create index if not exists global_chat_messages_created_idx
  on public.global_chat_messages(created_at desc);

-- 3. Row Level Security
alter table public.global_chat_messages enable row level security;
revoke all on public.global_chat_messages from anon, authenticated;

grant select on public.global_chat_messages to anon, authenticated;
grant insert (user_id, content, media_url, media_type) on public.global_chat_messages to authenticated;

-- Lectura abierta para todos
create policy global_chat_select on public.global_chat_messages
  for select to anon, authenticated
  using (true);

-- Envío exclusivo para usuarios autenticados
create policy global_chat_insert on public.global_chat_messages
  for insert to authenticated
  with check (auth.uid() = user_id);

-- 4. Publicación en Realtime de Supabase
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'global_chat_messages'
  ) then
    alter publication supabase_realtime add table public.global_chat_messages;
  end if;
end $$;

-- 5. Bucket de Almacenamiento para Multimedia del Chat ('chat-media')
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-media',
  'chat-media',
  true,
  5242880, -- 5 MB
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

-- Políticas de Storage para 'chat-media'
create policy "chat_media_public_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'chat-media');

create policy "chat_media_auth_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'chat-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

commit;
```

---

## 3. Modelo de Dominio (`src/domain/global-chat.ts`)
1. **Tipos y Validación**:
   ```ts
   export type ChatMediaType = 'image' | 'gif';

   export interface ChatMessageAuthor {
     id: string;
     username: string;
     avatarUrl: string | null;
     title?: string | null;
   }

   export interface GlobalChatMessage {
     id: string;
     userId: string;
     content: string | null;
     mediaUrl: string | null;
     mediaType: ChatMediaType | null;
     createdAt: string;
     author: ChatMessageAuthor;
   }
   ```
2. **Funciones Puras de Validación**:
   - `validateChatMessagePayload(input, userId)`: comprueba que tenga texto (1–1000 caracteres) o `mediaUrl` válido (hasta 2000 caracteres, URL HTTPS segura o ruta local `/storage/...`).
   - `detectMediaType(urlOrFile)`: determina si es `'gif'` (extensión `.gif` o MIME `image/gif`) o `'image'`.
   - `sanitizeChatText(content)`: limpia espacios en blanco innecesarios y formatea menciones.

---

## 4. Endpoints Backend y Servicios (`src/services/global-chat.ts`)
1. **`GET /api/chat/messages`**:
   - Parámetros opcionales: `?before={isoTimestamp}&limit=50`.
   - Consulta `public.global_chat_messages` haciendo join con `profiles(id, username, avatar_url)` ordenado por `created_at desc`.
   - Devuelve `{ messages: GlobalChatMessage[], nextCursor: string | null }`.
2. **`POST /api/chat/messages`**:
   - Requiere sesión activa (`authenticated()`).
   - Aplica rate-limit en memoria (máximo 1 mensaje cada 1.5 segundos por usuario para prevenir flooding).
   - Inserta el mensaje en `global_chat_messages` con `auth.uid()`. Supabase Realtime propaga automáticamente el nuevo mensaje a todos los clientes suscritos.
3. **`POST /api/chat/upload`**:
   - Recibe `FormData` con el archivo multimedia (`file`), valida tamaño (≤ 5 MB) y tipo (`image/png`, `image/jpeg`, `image/webp`, `image/gif`).
   - Sube a `chat-media/{userId}/{timestamp}_{random}.{ext}` y devuelve `{ url: string, mediaType: 'image' | 'gif' }`.

---

## 5. Componentes Frontend (`src/components/global-chat-room.tsx` y `src/app/chat/page.tsx`)
1. **`src/app/chat/page.tsx`**:
   - Metadata: `title: 'Chat Global · Savestate'`.
   - Carga inicial del usuario actual (`currentUser()`), perfil (`currentViewerProfile()`) y los últimos 50 mensajes en el servidor para renderizado instantáneo.
   - Renderiza `<GlobalChatRoom initialMessages={messages} viewer={viewer} />`.
2. **`src/components/global-chat-room.tsx`**:
   - **Suscripción en Tiempo Real**:
     - Se suscribe a `supabase.channel('global-chat-channel')` escuchando `postgres_changes` con evento `INSERT` en la tabla `global_chat_messages`.
     - Al recibir un nuevo mensaje, busca el autor en caché o lo hidrata y lo anexa al final de la lista.
   - **Lista de Mensajes (`.chat-messages-container`)**:
     - Scroll automático al fondo cuando el usuario está cerca del final.
     - Botón flotante `↓ Nuevos mensajes` si el usuario está scrolleando mensajes antiguos y entran nuevos mensajes.
     - Botón superior `↑ Cargar mensajes anteriores` para paginación histórica con cursor.
   - **Visualización de Mensajes (`.chat-message-bubble`)**:
     - Avatar oficial del perfil, `username` en dorado/cian, fecha/hora local (`HH:mm`).
     - Renderizado de texto con formateo y detección de URLs.
     - Si incluye imagen o GIF (`mediaUrl`):
       - Miniatura o visualización completa con `loading="lazy"` y botón para abrir en lightbox o en pestaña nueva.
       - Si es GIF animado, badge sutil `GIF`.
   - **Caja de Envío (Composer)**:
     - Si está autenticado:
       - Área de texto multilínea (envío con `Enter`, salto con `Shift+Enter`).
       - Botón `📎 Imagen/GIF`: selector de archivos nativo con previsualización antes de enviar.
       - Botón `🔗 GIF / URL`: pequeño popover para pegar un enlace directo de Tenor, Giphy, Imgur, etc.
       - Botón `Enviar` con icono de avión de papel.
     - Si no está autenticado:
       - Muestra un banner estilizado: `🔒 Estás en modo espectador · Inicia sesión para participar en el Chat Global [Conectar / Registrarse]`.
