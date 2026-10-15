# Especificación Técnica: Tiempo Relativo de Última Actividad en Amigos

## 1. Objetivo y Requerimiento del Usuario

El usuario ha solicitado enriquecer el indicador de estado en la lista de amigos del perfil (`src/components/player-friends-widget.tsx`). Actualmente muestra de forma binaria:
- `● Activo`
- `● Inactivo`

La propuesta aprobada añade a la derecha de `"Inactivo"` el **tiempo transcurrido desde su última actividad** en formato relativo dinámico (segundos, minutos, horas, días o semanas), el cual se **actualiza automáticamente en vivo** a medida que transcurre el tiempo en el navegador:
- Si está en línea: `● Activo ahora`
- Si está inactivo: `● Inactivo · hace 45s`, `● Inactivo · hace 12 min`, `● Inactivo · hace 3 h`, `● Inactivo · hace 2 d`, etc.

---

## 2. Reglas de Formato Temporal Relativo

La función `formatLastActivity(lastSeenAt: string | null | undefined, nowMs: number)` aplicará las siguientes reglas en español:

| Tiempo Transcurrido | Formato Resultante | Ejemplo |
| :--- | :--- | :--- |
| **< 60 segundos** | `hace {s}s` (o `hace un momento`) | `hace 25s` |
| **1 a 59 minutos** | `hace {m} min` | `hace 8 min` |
| **1 a 23 horas** | `hace {h} h` | `hace 3 h` |
| **1 a 6 días** | `hace {d} d` | `hace 2 d` |
| **7 a 29 días** | `hace {w} sem` | `hace 2 sem` |
| **30 a 364 días** | `hace {m} m` | `hace 3 m` |
| **>= 365 días** | `hace +1 a` | `hace +1 a` |
| **Sin dato / nulo** | *(sin sufijo)* | `Inactivo` |

---

## 3. Arquitectura de Implementación

### A. Capa de Dominio (`src/domain/player-friends.ts`)
1. Extender `FriendProfile` con el campo opcional:
   ```ts
   export type FriendProfile = Pick<
     Profile,
     'id' | 'username' | 'avatar_url' | 'level' | 'terminal_status'
   > & {
     last_seen_at?: string | null;
   };
   ```
2. Implementar y exportar la función pura `formatLastActivity(lastSeenAt: string | null | undefined, nowMs?: number): string`.

### B. Capa de Base de Datos y Supabase Migration (`supabase/migrations/202610150031_player_friends_last_seen.sql`)
Para que la base de datos devuelva la fecha de última actividad de cada amigo sin requerir que el usuario haya iniciado sesión hoy, la función RPC `get_player_friends(p_user_id uuid)` calcula `last_seen_at` combinando:
1. La última actualización en la biblioteca (`user_games.updated_at`).
2. El último log o checkpoint registrado (`game_logs.created_at`).
3. La fecha de creación de la cuenta del jugador (`profiles.created_at`) como fallback infalible.

```sql
begin;

drop function if exists public.get_player_friends(uuid);

create function public.get_player_friends(p_user_id uuid)
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
    select max(activity_time) as last_active
    from (
      select ug.updated_at as activity_time
      from public.user_games ug
      where ug.user_id = p.id
      union all
      select gl.created_at as activity_time
      from public.game_logs gl
      where gl.user_id = p.id
    ) a
  ) act on true
  where f.status = 'accepted'
    and (f.sender_id = p_user_id or f.receiver_id = p_user_id)
  order by (playing.title is not null) desc, p.username, p.id;
$$;

revoke all on function public.get_player_friends(uuid) from public;
grant execute on function public.get_player_friends(uuid) to anon, authenticated;

commit;
```

### C. Componente Cliente Reactivo (`src/components/player-friends-widget.tsx`)
Para evitar discrepancias de hidratación SSR y asegurar que el tiempo transcurrido cambie dinámicamente en vivo mientras el usuario tiene la página abierta:
1. Crear el subcomponente interno `<FriendPresenceStatus isOnline={isOnline} lastSeenAt={profile.last_seen_at} />`.
2. Usar un `setInterval` de 30 segundos para recalcular `nowMs`.
3. Renderizar el `title` con la fecha absoluta para que el usuario pueda ver la hora exacta al posar el cursor (`title={new Date(lastSeenAt).toLocaleString('es-ES')}`).
