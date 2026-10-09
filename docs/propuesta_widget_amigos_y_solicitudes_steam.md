# Propuesta Técnica: Widget de Amigos y Gestión de Solicitudes Estilo Steam

**Fecha:** 9 de octubre de 2026  
**Rama de origen:** `research/antigravity`  
**Rama de destino:** `implementation/chatgpt` (Codex)  
**Objetivo:** Integrar en el perfil de jugador (`/players/[username]`) un widget visual de **Amigos** inspirado en la interfaz de Steam (con avatares, estado *"Jugando..."* en verde y medalla circular de nivel), sumando la gestión de **solicitudes recibidas y enviadas** cuando el usuario visualiza su propio perfil.

---

## 1. Análisis del Diseño y Referencia Visual (Steam)

En la captura de referencia se aprecian 4 elementos distintivos que definen la experiencia Steam:

```
┌────────────────────────────────────────────────────────┐
│  Amigos  14                                            │
├────────────────────────────────────────────────────────┤
│  [Avatar]  Gu4LL045                               (34) │
│            Últ. conexión: hace 14 días                 │
├────────────────────────────────────────────────────────┤
│  [Avatar]  Banco de Chile                         (24) │
│            En línea                                    │
├────────────────────────────────────────────────────────┤
│  [Avatar]  TheCheems                              (22) │
│            Jugando Overwatch®   <-- [Verde neón]       │
├────────────────────────────────────────────────────────┤
│  [Avatar]  Kaerdro                                (20) │
│            Últ. conexión: hace 17 días                 │
└────────────────────────────────────────────────────────┘
```

1. **Encabezado:** `"Amigos  14"` con el título en tipografía gamer y el contador en tono secundario atenuado.
2. **Item de Amigo:**
   * **Avatar cuadrado:** 36x36 px con borde temático.
   * **Nombre y enlace:** `@username` que navega directamente a su perfil `/players/[username]`.
   * **Subtítulo de Estado:**
     * Si tiene un juego con estado `playing`: `"Jugando [Título]"` en verde neón (`#4ade80` / `#a3e635`).
     * Si no tiene juego activo: su `terminal_status` (ej: *"En línea"*, *"Listo para jugar"*).
   * **Insignia circular de Nivel:**
     * Círculo con borde coloreado según el tier del jugador y su nivel numérico adentro (`(34)`, `(24)`, `(11)`).
     * En SaveState, esto aprovecha directamente `profile.level` (creado en la migración `017` de progresión).

---

## 2. Gestión de Solicitudes en el Perfil Propio

Cuando el usuario autenticado visita **su propio perfil** (`user.id === profile.id`), el widget incorpora pestañas superiores:

* `[ Amigos (14) ]`
* `[ Solicitudes Recibidas (3) ]` (con badge de alerta neón)
* `[ Solicitudes Enviadas (1) ]`

### 2.1. Solicitudes Recibidas:
Muestra la lista de jugadores que quieren ser tus amigos con dos botones de acción rápida con 1 clic:
* `[ ✔ Aceptar ]` -> invoca Server Action / `api('social', { action: 'respond', id, status: 'accepted' })`.
* `[ ✖ Rechazar ]` -> invoca Server Action / `api('social', { action: 'respond', id, status: 'rejected' })`.

### 2.2. Solicitudes Enviadas:
Muestra a quién le enviaste solicitud con opción:
* `[ ✖ Cancelar solicitud ]` -> invoca `api('social', { action: 'remove', id })`.

---

## 3. Arquitectura de Datos y Supabase (Migración 020)

### 3.1. Permisos RLS en `friendships`
Actualmente, la política `friends_read` restringe la lectura únicamente a los participantes:
```sql
using (sender_id = auth.uid() or receiver_id = auth.uid())
```
Para que los visitantes de un perfil público puedan ver su lista de amigos aceptados, la política debe permitir leer relaciones con `status = 'accepted'`:

```sql
-- Migración 202610090020_public_accepted_friendships.sql
begin;

drop policy if exists friends_read on public.friendships;

create policy friends_read on public.friendships
  for select to authenticated, anon
  using (
    status = 'accepted'
    or (auth.uid() is not null and (sender_id = auth.uid() or receiver_id = auth.uid()))
  );

commit;
```
> [!NOTE]
> Las solicitudes `pending` y `rejected` permanecen estrictamente privadas entre emisor y receptor.

### 3.2. Función RPC optimizada para Amigos (`get_player_friends`)
Para evitar N+1 queries al buscar los amigos, sus niveles y su juego en curso:

```sql
create or replace function public.get_player_friends(p_user_id uuid)
returns table (
  id uuid,
  username text,
  avatar_url text,
  level integer,
  terminal_status text,
  current_game text
) language sql stable security definer set search_path = '' as $$
  select 
    p.id,
    p.username,
    p.avatar_url,
    coalesce(p.level, 1) as level,
    p.terminal_status,
    (
      select g.title 
      from public.user_games ug 
      join public.games g on g.id = ug.game_id 
      where ug.user_id = p.id and ug.status = 'playing' 
      order by ug.updated_at desc 
      limit 1
    ) as current_game
  from public.friendships f
  join public.profiles p on p.id = (case when f.sender_id = p_user_id then f.receiver_id else f.sender_id end)
  where f.status = 'accepted'
    and (f.sender_id = p_user_id or f.receiver_id = p_user_id)
  order by (current_game is not null) desc, p.username asc;
$$;
```

---

## 4. Componente Visual: `src/components/player-friends-widget.tsx`

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { api } from '@/lib/client-api';

interface FriendItem {
  id: string;
  username: string;
  avatar_url: string | null;
  level: number;
  terminal_status: string;
  current_game: string | null;
}

interface RequestItem {
  id: string;
  profile: {
    id: string;
    username: string;
    avatar_url: string | null;
    level: number;
  };
}

export function PlayerFriendsWidget({
  friends,
  receivedRequests,
  sentRequests,
  isOwner,
}: {
  friends: FriendItem[];
  receivedRequests?: RequestItem[];
  sentRequests?: RequestItem[];
  isOwner: boolean;
}) {
  const [tab, setTab] = useState<'friends' | 'received' | 'sent'>('friends');
  const [busyId, setBusyId] = useState<string | null>(null);

  // Funciones de responder y cancelar usando la API existente...
  // Renderizado con estética cyberpunk/Steam idéntica a la referencia
}
```

### 4.1. Estilos del Nivel Circular (Badge Steam):
```css
.friend-level-circle {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
}
.level-gold   { border-color: #eab308; color: #fef08a; } /* Nivel 30+ */
.level-purple { border-color: #a855f7; color: #f3e8ff; } /* Nivel 20-29 */
.level-red    { border-color: #ef4444; color: #fee2e2; } /* Nivel 10-19 */
.level-bronze { border-color: #cd7f32; color: #fed7aa; } /* Nivel 5-9 */
.level-gray   { border-color: #64748b; color: #f8fafc; } /* Nivel 1-4 */
```

---

## 5. Ubicación en la Vista `/players/[username]`

En `src/app/players/[username]/page.tsx`:
1. **Pestaña en la barra de navegación:** Agregar pestaña `Amigos (${friends.length})` junto a *Biblioteca* y *Estadísticas*.
2. **Widget integrado:** Ubicado como panel en el perfil (al estilo de la barra lateral de Steam en pantallas anchas, o sección destacada colapsable en móvil).

---

## 6. Plan de Ejecución para Codex

1. Aplicar la migración SQL `202610090020_public_accepted_friendships.sql` (creando la política RLS y la función `get_player_friends`).
2. En `src/repositories/player.ts`, implementar la carga de amigos y solicitudes de amistad.
3. Crear el componente `src/components/player-friends-widget.tsx` con soporte para lista de amigos estilo Steam y gestión de solicitudes recibidas/enviadas.
4. Montar el widget en `src/app/players/[username]/page.tsx`.
5. Comprobar que `npm run check` pase sin errores.
