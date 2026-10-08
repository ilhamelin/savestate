# Propuesta Técnica: Fase 1 — Campanita de Notificaciones y Edición de Momentos
**Fecha:** 7 de octubre de 2026  
**Origen:** Auditoría e Investigación (`research/antigravity`)  
**Destino:** Equipo de Implementación (`implementation/chatgpt` / Codex)  
**Propósito:** Especificar la integración de notificaciones en la barra de navegación principal (Header) y el ciclo de vida completo de edición de publicaciones en "Momentos Gamer" (Highlights).

---

## 1. Alcance Funcional

Esta fase consolida el bucle de interacción social y usabilidad inmediata:
1. **Campanita de Notificaciones en el Header:** Los usuarios autenticados dispondrán de un punto de acceso directo y visible a sus notificaciones entrantes con contador de no leídas (`unreadCount`) y menú flotante HUD.
2. **Alertas automáticas por interacciones en Momentos:** Cuando otro jugador comente o reaccione a una publicación en `/highlights`, el autor recibirá una notificación en tiempo real.
3. **Edición de Publicaciones de Momentos:** El autor de un post podrá editar título, contenido, categoría, visibilidad y multimedia desde la propia tarjeta del momento sin perder las reacciones ni comentarios ya existentes.

---

## 2. Nueva Migración SQL: `202610070007_moment_notifications.sql`

La tabla `public.notifications` (creada en la migración 002) almacena `(user_id, actor_id, kind, read_at, created_at)`.  
Esta nueva migración incorpora los triggers para conectar las tablas de momentos (`post_comments` y `post_reactions`) con el sistema de notificaciones:

```sql
begin;

-- 1. Función trigger para notificar interacciones en Momentos Gamer
create or replace function public.notify_post_interaction()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  recipient uuid;
  post_title text;
begin
  -- Obtener el autor de la publicación
  select user_id, title into recipient, post_title
  from public.posts
  where id = new.post_id;

  -- Si el autor existe y no es quien realiza la acción, registrar notificación
  if recipient is not null and recipient <> new.user_id then
    insert into public.notifications (user_id, actor_id, kind)
    values (
      recipient,
      new.user_id,
      case 
        when tg_table_name = 'post_comments' then 'post_comment'
        else 'post_reaction'
      end
    );
  end if;

  return new;
end;
$$;

-- 2. Triggers sobre comentarios y reacciones de posts
drop trigger if exists post_comments_notify on public.post_comments;
create trigger post_comments_notify
  after insert on public.post_comments
  for each row execute function public.notify_post_interaction();

drop trigger if exists post_reactions_notify on public.post_reactions;
create trigger post_reactions_notify
  after insert on public.post_reactions
  for each row execute function public.notify_post_interaction();

commit;
```

---

## 3. Especificación de Componentes de Frontend

### 3.1. `<NotificationBell />` en `src/components/header.tsx`
* **Ubicación:** En la sección `.header-actions` del Header, junto al botón de búsqueda y el toggle CRT.
* **Comportamiento:**
  - Consulta las notificaciones no leídas (`read_at is null`) del usuario actual.
  - Muestra un badge retro fluorescente con el conteo (`[ 1 ]`, `[ 3 ]` o punto indicador si hay novedades).
  - Al hacer clic, abre un popover flotante con las últimas 5 notificaciones recibidas, tiempo relativo (`hace 5 min`) y acceso directo al post o perfil involucrado.
  - Incluye botón `"Ver todas las señales"` que redirige a `/notifications`.
  - Opción rápida de *"Marcar todas como leídas"*.

### 3.2. Etiquetas en `src/app/notifications/page.tsx`
Extender el diccionario de tipos de notificación (`labels`):
```ts
const labels: Record<string, string> = {
  follow: 'empezó a seguirte',
  friend_request: 'te envió una solicitud de amistad',
  friend_accepted: 'aceptó tu amistad',
  comment: 'comentó tu reseña',
  reaction: 'reaccionó a tu reseña',
  post_comment: 'comentó en tu momento gamer',
  post_reaction: 'reaccionó a tu momento gamer',
};
```

### 3.3. Edición de Publicaciones en `post-card.tsx`
* **Botón de Acción:** En la cabecera de la tarjeta del post, si `currentUser.id === post.user_id`, se muestra un botón con icono de lápiz/ajustes `[Editar]`.
* **Modo Edición:**
  - Puede desplegarse en un modal retro o cambiar la tarjeta a estado de formulario en línea (`isEditing = true`).
  - Pre-carga los valores actuales: `title`, `content`, `category`, `media_type`, `youtube_video_id` o `image_urls`.
  - Permite guardar o cancelar la edición.
* **Server Action / Servicio (`updatePostAction`):**
  - Valida límites de longitud (título 3-120 caracteres, contenido hasta 5000, regex de YouTube).
  - Ejecuta `UPDATE public.posts SET title = ..., content = ..., category = ..., is_private = ..., updated_at = now() WHERE id = ... AND user_id = auth.uid()`.
  - Si la publicación cambia a `is_private = true`, la política restrictiva aplicada en la migración 006 ocultará automáticamente el evento en `activity_logs`.
  - Invalida la caché del feed (`revalidatePath('/highlights')`).

---

## 4. Criterios de Aceptación y Verificación

1. Un usuario A que comente o reaccione al momento de un usuario B genera una fila en `notifications` visible para el usuario B.
2. El usuario B ve encenderse el badge de la campana en el Header en su próxima navegación o actualización.
3. El usuario autor puede editar el título o texto de su momento gamer y los cambios persisten de inmediato con fecha de actualización.
4. Un usuario distinto al autor no ve controles de edición y cualquier intento de `UPDATE` por API es rechazado por RLS.
