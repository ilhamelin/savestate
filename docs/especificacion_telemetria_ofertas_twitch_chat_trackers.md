# Especificación Técnica: Telemetría en Vivo (CheapShark + Steam Charts + Twitch Live), Chat Directo entre Amigos y Hub Multi-Tracker Competitivo

## 1. Resumen Ejecutivo

Este documento especifica la arquitectura e implementación de las **5 grandes expansiones en tiempo real** para **SaveState**:

1. **💰 Rastreador de Ofertas y Precios Mínimos en Tiempo Real (CheapShark API + Steam Store Search)**: Comparador de precios en tiendas de PC (Steam, GOG, Humble, Epic, Fanatical, GreenManGaming, etc.), porcentaje de ahorro y registro del **precio mínimo histórico (`cheapestPriceEver`)** en la ficha de cada juego (`/games/[slug]`).
2. **🔴 Twitch Live Radar (Twitch Helix API)**: Integración directa reutilizando las credenciales `TWITCH_CLIENT_ID` y `TWITCH_CLIENT_SECRET` ya existentes en `src/integrations/igdb/server.ts` para mostrar cuántos canales y espectadores están transmitiendo el juego en vivo y renderizar los 4 streams principales en tiempo real.
3. **📈 Contador de Jugadores Simultáneos en Vivo de Steam (`ISteamUserStats/GetNumberOfCurrentPlayers`)**: Indicador luminoso en vivo (`🟢 X jugando ahora en Steam`) resolviendo automáticamente el `steamAppID` del juego sin requerir claves adicionales ni migraciones de base de datos.
4. **💬 Chat Directo en Tiempo Real entre Amigos (Supabase Realtime + Persistencia)**: Ventana flotante estilo Steam/Discord integrada en `PlayerFriendsWidget` con entrega instantánea mediante canales `broadcast` + `postgres_changes` de Supabase Realtime y tabla `public.friend_messages`.
5. **🎯 Ampliación del Hub de Trackers Competitivos (`/rift`)**: Expansión de `/rift` con selector de pestañas para consultar **League of Legends**, **Valorant (Riot ID Account + Shard Telemetry)** y **Genshin Impact (vía Enka.Network API en vivo por UID)**.

---

## 2. Bloques #1, #2 y #3: Telemetría en Vivo y Radar de Ofertas en `/games/[slug]`

### 2.1. Exportar `twitchAccessToken` en `src/integrations/igdb/server.ts`

Exportar un helper `twitchAccessToken()` que reutilice la función interna `accessToken()` en `src/integrations/igdb/server.ts` para que el servicio de Twitch Helix comparta el mismo token OAuth en caché sin duplicar peticiones a `id.twitch.tv`.

### 2.2. Nuevo Servicio `src/services/game-live-telemetry.ts`

Crear `src/services/game-live-telemetry.ts` con `unstable_cache` (TTL de 300 segundos / 5 minutos) y `Promise.allSettled`:

- **Resolución de `steamAppId` y Jugadores Simultáneos en Steam**:
  1. Consultar `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(title)}&l=spanish&cc=US` (`timeout: 4500ms`).
  2. Extraer `steamAppId = items?.[0]?.id`.
  3. Si existe `steamAppId`, consultar `https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=${steamAppId}` para obtener `response.player_count`.
- **Ofertas y Mínimo Histórico en CheapShark**:
  1. Consultar `https://www.cheapshark.com/api/1.0/deals?${steamAppId ? `steamAppID=${steamAppId}` : `title=${encodeURIComponent(title)}`}&pageSize=6` enviando cabecera `'User-Agent': 'SaveState/1.0 (+https://savestate.app)'`.
  2. Si el primer resultado incluye `gameID`, consultar `https://www.cheapshark.com/api/1.0/games?id=${gameID}` para obtener `cheapestPriceEver: { price, date }`.
  3. Mapear `storeID` a nombres legibles (`1: 'Steam'`, `2: 'GamersGate'`, `3: 'GreenManGaming'`, `7: 'GOG'`, `8: 'EA App'`, `11: 'Humble Store'`, `13: 'Ubisoft Store'`, `15: 'Fanatical'`, `21: 'WinGameStore'`, `23: 'GameBillet'`, `25: 'Epic Games Store'`, `27: 'Gamesplanet'`, `30: 'IndieGala'`) y construir el enlace `https://www.cheapshark.com/redirect?dealID=${deal.dealID}`.
- **Streams en Vivo en Twitch Helix**:
  1. Si `process.env.TWITCH_CLIENT_ID` y `process.env.TWITCH_CLIENT_SECRET` están configurados, obtener el Bearer token con `twitchAccessToken()`.
  2. Consultar `https://api.twitch.tv/helix/games?name=${encodeURIComponent(title)}`.
  3. Si devuelve `data[0]?.id`, consultar `https://api.twitch.tv/helix/streams?game_id=${data[0].id}&first=4` y transformar cada stream (`id`, `user_name`, `user_login`, `title`, `viewer_count`, `language`, `thumbnail_url` reemplazando `{width}x{height}` por `320x180`).

### 2.3. Componente `src/components/game-live-radar.tsx` e Integración en `src/app/games/[slug]/page.tsx`

- Crear `src/components/game-live-radar.tsx` como Server Component asíncrono envuelto en `<Suspense>` dentro de `src/app/games/[slug]/page.tsx` (justo debajo de `detail-grid`).
- Renderizar:
  - **Barra de Telemetría en Vivo**:
    - Píldora `🟢 {steamPlayers.toLocaleString('es-CL')} jugando ahora en Steam`
    - Píldora `🔴 {totalTopViewers.toLocaleString('es-CL')} espectadores en Twitch (Top 4)`
    - Píldora `🏷️ Mínimo histórico: $${historicalLow.price} USD`
  - **Sub-panel de Ofertas Activas (CheapShark)**: Lista compacta con tienda, precio normal tachado, precio de oferta resaltado, badge de descuento (`-XX%`) y botón `Ver oferta ↗`.
  - **Sub-panel de Twitch Live Radar**: Grid de hasta 4 transmisiones en vivo con miniatura 16:9, badge `🔴 EN VIVO · {viewers} esp.`, nombre del canal y enlace directo a `https://www.twitch.tv/${userLogin}`.

---

## 3. Bloque #4: Chat Directo en Tiempo Real entre Amigos (`FriendChatDrawer`)

### 3.1. Migración SQL `supabase/migrations/202610110025_friend_direct_messages.sql`

- Tabla `public.friend_messages`:
  - `id uuid primary key default gen_random_uuid()`
  - `sender_id uuid not null references public.profiles(id) on delete cascade`
  - `receiver_id uuid not null references public.profiles(id) on delete cascade`
  - `content text not null check (char_length(trim(content)) between 1 and 500)`
  - `created_at timestamptz not null default now()`
- RLS habilitado:
  - Lectura permitida si `auth.uid() in (sender_id, receiver_id)`.
  - Inserción permitida si `auth.uid() = sender_id` y existe una amistad `status = 'accepted'` en `public.friendships` entre `sender_id` y `receiver_id`.

### 3.2. Endpoint `src/app/api/chat/route.ts` y Componente `src/components/friend-chat-drawer.tsx`

- `GET /api/chat?friendId={uuid}`: Devuelve los últimos 50 mensajes entre el usuario autenticado y `friendId`. Si la tabla `friend_messages` aún no está creada en el entorno remoto (`42P01` / `PGRST205`), devuelve `{ data: { messages: [], persisted: false } }` con código 200 para no romper la experiencia.
- `POST /api/chat`: Valida `{ friendId, content }`, verifica amistad aceptada e inserta en `public.friend_messages` (con fallback no bloqueante si falta la migración).
- `FriendChatDrawer`:
  - Se abre al pulsar el botón `💬 Chat` junto a cualquier amigo aceptado en `src/components/player-friends-widget.tsx` (cuando `isOwner === true`).
  - Se suscribe al canal de Supabase Realtime `savestate:dm:${[currentUserId, friend.id].sort().join(':')}` usando eventos `broadcast` (`event: 'dm'`) para entrega instantánea en milisegundos entre pestañas/usuarios conectados, además de persistir en `/api/chat`.

---

## 4. Bloque #5: Hub Multi-Tracker Competitivo en `/rift` (LoL + Valorant + Genshin Impact)

### 4.1. Endpoint `src/app/api/tracker/multi/inspect/route.ts`

Soporta dos modos adicionales de telemetría competitiva en vivo:
1. **Genshin Impact (`mode: 'genshin'`, `uid: string`)**:
   - Valida que `uid` sea un número de 9 a 10 dígitos (`/^\d{9,10}$/`).
   - Consulta `https://enka.network/api/uid/${uid}` con cabecera `'User-Agent': 'SaveState/1.0 (+https://savestate.app)'`.
   - Devuelve `nickname`, `level` (Rango de Aventura), `worldLevel` (Nivel de Mundo), `signature`, `achievements` (`finishAchievementNum`), `abyss` (`${towerFloorIndex}-${towerLevelIndex}`), `fetterCount` y la lista `showcase` (`showAvatarInfoList` mapeada con nombre de personaje/elemento y nivel).
2. **Valorant (`mode: 'valorant'`, `riotId: string`, `region: 'latam' | 'br' | 'na' | 'eu' | 'ap' | 'kr'`)**:
   - Valida `Nombre#TAG`.
   - Si existe `process.env.RIOT_API_KEY`, consulta `https://americas.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}` y el shard activo de Valorant (`/riot/account/v1/active-shards/by-game/val/by-puuid/${puuid}`) para verificar la cuenta oficial de Riot, su `puuid`, región activa y estado competitivo en vivo.

### 4.2. Selector Multi-Tracker en `src/components/competitive-hub-tabs.tsx` y `src/app/rift/page.tsx`

- Añade una barra superior de pestañas en `/rift`:
  - `⚔️ League of Legends` (muestra el `ProfileLolTracker` actual sin regresiones).
  - `🎯 Valorant` (buscador por `Riot ID Nombre#TAG` + región y tarjeta HUD del agente/cuenta Riot verificada).
  - `✨ Genshin Impact` (buscador por `UID` de 9 dígitos conectado en vivo a Enka.Network con tarjetas de Rango de Aventura, Espiral del Abismo, Logros y Escaparate de Personajes).
