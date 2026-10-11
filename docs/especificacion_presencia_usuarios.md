# Especificación Técnica: Señal de Presencia en Tiempo Real (Online / Offline) en SaveState

## 1. Contexto y Objetivo
Actualmente, el widget **Amigos** (`PlayerFriendsWidget`) muestra el avatar, el `@username` y el nivel de cada amigo, después de que se retirara el texto estático de "Jugando X" porque inducía a confusión al no ser actividad en vivo.

El usuario desea añadir una **señal de actividad real** debajo del nombre del jugador (`@username`) que indique:
- **🟢 Activo** (o *En línea*): cuando el usuario tiene la web de SaveState abierta en ese momento.
- **⚫ Inactivo** (o *Desconectado*): cuando el usuario no está navegando en la web.

---

## 2. Análisis de Alternativas Técnicas

### Opción A: Supabase Realtime Presence (Recomendada ⭐)
Supabase incluye de forma nativa **Realtime Presence** sobre WebSockets (el mismo cliente `browserClient()` que ya usa `NotificationBell` en el Header).
- **Cómo funciona**:
  1. Cuando un usuario autenticado entra a cualquier página de SaveState, un hook o el componente global `NotificationBell` (que se monta en `Header` en todas las vistas) se une a un canal compartido de presencia: `db.channel('savestate:presence', { config: { presence: { key: userId } } })`.
  2. Al suscribirse (`SUBSCRIBED`), ejecuta `channel.track({ user_id: userId, online_at: new Date().toISOString() })`.
  3. Cuando el usuario cierra la pestaña, cierra el navegador o pierde conexión, el servidor WebSocket de Supabase detecta la desconexión automáticamente y emite el evento `leave` al instante (sin necesidad de escribir ni hacer polling en la base de datos PostgreSQL).
  4. Cualquier componente (como `PlayerFriendsWidget` o el perfil de un jugador) puede leer el conjunto de `userId`s conectados en tiempo real y mostrar:
     - `● Activo` (con punto verde neón `#38f89c` / clase `.friend-status-online`) si el `friend.id` está en el Set de presencia.
     - `○ Inactivo` (con punto gris `.muted` / clase `.friend-status-offline`) si no está presente.

- **Ventajas**:
  - **Cero migraciones SQL**: No requiere alterar tablas, ni políticas RLS, ni crear endpoints adicionales.
  - **Tiempo real puro (instantáneo)**: Si un amigo entra o sale de la web, el indicador cambia de `Inactivo` a `Activo` en vivo sin recargar la página.
  - **Cero desgaste de base de datos**: No hace `UPDATE profiles SET last_seen_at = now()` cada 30 segundos, ahorrando cuota de base de datos y llamadas serverless en Vercel.

### Opción B: Heartbeat en Base de Datos (`last_seen_at` en tabla `profiles`)
- Requiere migración SQL (`026_user_presence.sql`), un endpoint `POST /api/presence` llamado cada 60 segundos, y considerar "Activo" a quien tuvo actividad en los últimos 2 minutos.
- **Desventaja**: Si el usuario cierra la pestaña, sigue figurando como "Activo" hasta que expire la ventana de 2–3 minutos, y consume escrituras constantes en Postgres.

---

## 3. Diseño de Implementación (Arquitectura con Supabase Realtime Presence)

### 3.1. Store / Hook de Presencia Compartido (`src/lib/presence.ts` o `useOnlineUsers`)
Para no abrir múltiples canales WebSocket por separado, se crea un pequeño gestor singleton en el cliente (`src/lib/presence.ts`):
- Mantiene un `Set<string>` con los UUIDs de todos los usuarios activos en la web en ese momento.
- Expone:
  - `initPresence(userId?: string | null)`: se suscribe al canal `'savestate:online'`. Si hay `userId`, hace `channel.track({ user_id: userId })` al conectarse.
  - `useOnlineUsers()`: hook de React (`useSyncExternalStore` o `useState` + listener) que devuelve el `ReadonlySet<string>` de IDs conectados en tiempo real.

### 3.2. Emisión Global desde el Header (`src/components/header.tsx` / `NotificationBell` o `PresenceTracker`)
- En `Header`, incluso si un usuario navega por `/explore`, `/rift`, `/highlights` o `/players`, el cliente mantiene la sesión de presencia activa.
- Si el usuario está autenticado (`user.id`), se anuncia como activo en el canal global.
- Si un visitante mira la lista de amigos, el cliente también escucha el canal `'savestate:online'` para saber quiénes están activos.

### 3.3. Visualización en el Widget de Amigos (`src/components/player-friends-widget.tsx`)
En `FriendIdentity`:
```tsx
function FriendIdentity({
  profile,
  isOnline,
}: {
  profile: FriendProfile;
  isOnline: boolean;
}) {
  return (
    <Link className="friend-identity" href={`/players/${profile.username}`}>
      <span className="friend-avatar">
        {profile.avatar_url ? (
          <Image src={profile.avatar_url} alt="" width={36} height={36} unoptimized />
        ) : (
          <span aria-hidden="true">▣</span>
        )}
        <span
          className={`friend-presence-dot ${isOnline ? 'is-online' : 'is-offline'}`}
          aria-hidden="true"
        />
      </span>
      <span className="friend-copy">
        <strong>@{profile.username}</strong>
        <span className={`friend-presence-label ${isOnline ? 'is-online' : 'muted'}`}>
          {isOnline ? '● Activo' : '○ Inactivo'}
        </span>
      </span>
      <span
        className={`friend-level-circle friend-level-${friendLevelTier(profile.level)}`}
        aria-label={`Nivel ${profile.level}`}
      >
        {profile.level}
      </span>
    </Link>
  );
}
```
- Se aplica tanto en la pestaña **Amigos** como en **Solicitudes recibidas** y **Solicitudes enviadas**, para saber si cualquiera de esos usuarios está activo en la web en ese momento.

### 3.4. Estilos Visuales (`src/app/globals.css`)
- `.friend-presence-label`: fuente pequeña debajo de `@username`, con color verde neón (`#4ade80` / `var(--accent-green, #38f89c)`) y sutil brillo cuando está `.is-online`, y gris tenue (`var(--muted)`) cuando está inactivo.
- Opcionalmente, un pequeño punto indicador en la esquina del avatar (`.friend-presence-dot`).
