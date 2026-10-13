# Estudio y Especificación Técnica: Auditoría de Rendimiento y Optimización Integral de SaveState

**Fecha:** 13 de octubre de 2026  
**Rama de origen:** `research/antigravity`  
**Rama de destino:** `implementation/chatgpt` (Codex)  
**Objetivo:** Documentar los cuellos de botella de rendimiento, cascadas de consultas a base de datos (waterfalls), reconexiones innecesarias de WebSockets, over-fetching de columnas en Supabase y peso de bundles detectados en el código actual de SaveState, junto con el plan exacto de optimización sin alterar ninguna funcionalidad ni contrato de pruebas existente.

---

## 1. Resumen Ejecutivo del Diagnóstico

¿Es necesario optimizar lo aplicado hasta ahora? **Sí.** Aunque la arquitectura general es sólida y segura, el crecimiento reciente de módulos (Trackers competitivos de Genshin/HSR/Rust/Valorant, Radar en Vivo, Notificaciones Realtime, Foro y Ficha de Juegos) ha introducido **7 cuellos de botella medibles** que afectan la velocidad de navegación entre páginas, el tiempo de respuesta del servidor (TTFB) y el consumo de memoria/red:

| # | Área / Archivo | Problema Detectado | Impacto |
|---|---|---|---|
| **1** | `src/services/notifications.ts` y `src/app/notifications/page.tsx` | **5 consultas secuenciales (`await` en cascada)** a Supabase después de leer las notificaciones, en un endpoint que el `Header` consulta constantemente. | Reduce la latencia de `/api/notifications` y `/notifications` en **~70% (de 5 RTTs a 1 RTT)**. |
| **2** | `src/components/notification-bell.tsx` | `pathname` está incluido en las dependencias del `useEffect` que abre el canal WebSocket de Supabase Realtime y llama a `/api/notifications`. | En **cada clic de navegación** se destruye y recrea la conexión WebSocket y se dispara un fetch extra. |
| **3** | `src/repositories/player.ts` (`libraryFor`) y `src/app/lists/[id]/page.tsx` | Consultas independientes (`user_games` general + `user_games` favoritos; `user_lists` + `list_items`) ejecutadas de forma secuencial en vez de `Promise.all`. | Ahorra **1 RTT completo** en cada carga de `/library`, `/players/[username]` y `/lists/[id]`. |
| **4** | `src/app/games/[slug]/page.tsx` | `<GameForum gameId={game.id} />` es un Server Component asíncrono renderizado **sin `<Suspense>`**, bloqueando el SSR de toda la ficha del juego; además hace `select('*')` dos veces sobre `profiles` para obtener solo `id, username`. | Mejora drástica del **TTFB / Streaming SSR** en `/games/[slug]` y menor payload desde Supabase. |
| **5** | `src/app/feed/page.tsx` y `src/app/settings/page.tsx` | **Over-fetching en `profiles`**: `/feed` descarga `select('*')` de todos los amigos/seguidos aunque no aparezcan en los 50 eventos visibles; `/settings` descarga `select('*')` solo para leer `username`. | Reduce hasta en **80%** el tamaño de respuesta de perfiles en `/feed` y `/settings`. |
| **6** | `src/services/genshin-enka-store.ts` y `src/services/hsr-enka-store.ts` | Los diccionarios de Enka (`~1 MB` en HSR y `~400 KB` en Genshin) se deserializan desde `unstable_cache` en cada request sin un singleton ligero en memoria de proceso (`memoryCache`), y `genshin-enka-store.ts` duplica caché entre `fetch` (`revalidate: 86400`) y `unstable_cache`. | Respuesta instantánea (`0 ms` de parseo) en consultas repetidas de Genshin y HSR. |
| **7** | `src/components/competitive-hub-tabs.tsx` y `src/components/profile-wallpaper.tsx` | Los 4 visores pesados (`GenshinProfileView`, `RustProfileView`, `ValorantProfileView`, `HsrProfileView`) se importan estáticamente en el bundle inicial de `/rift`, y `ProfileWallpaper` renderiza fondos de `700 KB` sin `decoding="async"`. | Reduce el **JS inicial de `/rift`** mediante code-splitting (`next/dynamic`) y evita bloqueo de decodificación de imagen. |

---

## 2. Plan Detallado de Optimización por Módulo

### 2.1. Eliminar Cascadas (Waterfalls) en Notificaciones (`src/services/notifications.ts` y `src/app/notifications/page.tsx`)

1. **En `src/services/notifications.ts` (`notificationSummary`):**
   Una vez obtenidos `rows = recent.data ?? []`, calcular todos los IDs necesarios (`actorIds`, `badgeIds`, `threadIds`, `requestActors`, `trackerIds`) y ejecutar las **5 consultas de enriquecimiento en un único `await Promise.all([...])`**:
   ```ts
   const actorIds = [...new Set([...rows.map((n) => n.actor_id), user.id])];
   const badgeIds = [...new Set(rows.flatMap((row) => (row.badge_id ? [row.badge_id] : [])))];
   const threadIds = [
     ...new Set(rows.flatMap((row) => (row.forum_thread_id ? [row.forum_thread_id] : []))),
   ];
   const requestActors = [
     ...new Set(rows.filter((row) => row.kind === 'friend_request').map((row) => row.actor_id)),
   ];
   const trackerIds = [
     ...new Set(rows.flatMap((row) => (row.itch_tracker_id ? [row.itch_tracker_id] : []))),
   ];

   const [profiles, badges, threads, friendships, trackers] = await Promise.all([
     rows.length
       ? db.from('profiles').select('id,username').in('id', actorIds)
       : Promise.resolve({ data: [], error: null }),
     badgeIds.length
       ? db.from('badges').select('id,name').in('id', badgeIds)
       : Promise.resolve({ data: [], error: null }),
     threadIds.length
       ? db.from('forum_threads').select('id,category_id').in('id', threadIds)
       : Promise.resolve({ data: [], error: null }),
     requestActors.length
       ? db
           .from('friendships')
           .select('id,sender_id,created_at')
           .eq('receiver_id', user.id)
           .eq('status', 'pending')
           .in('sender_id', requestActors)
       : Promise.resolve({ data: [], error: null }),
     trackerIds.length
       ? db
           .from('itch_trackers')
           .select('id,metadata')
           .in('id', trackerIds)
           .eq('user_id', user.id)
       : Promise.resolve({ data: [], error: null }),
   ]);
   [profiles, badges, threads, friendships, trackers].forEach((r) => dbCheck(r.error));
   ```

2. **En `src/app/notifications/page.tsx`:**
   Aplicar exactamente la misma paralelización con `Promise.all` para `players`, `badges`, `threads` y `trackers`, y cambiar `.from('profiles').select('*')` por `.from('profiles').select('id,username')`.

---

### 2.2. Evitar Reconexión de WebSocket en cada cambio de ruta (`src/components/notification-bell.tsx`)

En `src/components/notification-bell.tsx`:
- Quitar `pathname` del array de dependencias del `useEffect` principal que crea el canal `db.channel(\`notifications:${userId}:${id}\`)` (dejando `[userId, id, revision]`).
- De esta forma, el canal WebSocket Realtime permanece conectado durante toda la sesión de navegación del usuario sin desmontarse ni disparar un `fetch('/api/notifications')` redundante en cada clic del menú principal.

---

### 2.3. Paralelizar Consultas en `libraryFor` (`src/repositories/player.ts`) y `/lists/[id]` (`src/app/lists/[id]/page.tsx`)

1. **En `src/repositories/player.ts` (`libraryFor`):**
   Ejecutar la consulta de los 500 juegos recientes y la consulta de favoritos (`not('favorite_position', 'is', null)`) en paralelo con `Promise.all`:
   ```ts
   const [rowsResult, favoritesResult] = await Promise.all([
     db
       .from('user_games')
       .select('*', { count: 'exact' })
       .eq('user_id', userId)
       .order('updated_at', { ascending: false })
       .limit(500),
     db
       .from('user_games')
       .select('*')
       .eq('user_id', userId)
       .not('favorite_position', 'is', null)
       .order('favorite_position'),
   ]);
   dbCheck(rowsResult.error);
   dbCheck(favoritesResult.error);
   ```

2. **En `src/app/lists/[id]/page.tsx`:**
   Ejecutar la lectura de `user_lists` y `list_items` en paralelo mediante `Promise.all`, ya que ambas filtran por el `id` de la URL.

---

### 2.4. Desbloquear el Streaming SSR y eliminar Over-fetching en `/games/[slug]` (`src/app/games/[slug]/page.tsx`)

1. **Envolver `<GameForum gameId={game.id} />` en `<Suspense>`:**
   ```tsx
   <Suspense
     fallback={
       <section className="panel muted" aria-busy="true">
         Cargando debates y momentos de la comunidad…
       </section>
     }
   >
     <GameForum gameId={game.id} />
   </Suspense>
   ```
2. **Proyectar únicamente `id,username` en `profiles` y unificar la lectura de autores:**
   - En lugar de hacer dos consultas `.from('profiles').select('*')` (una para autores de entradas y otra secuencial para autores de comentarios), recopilar todos los `authorIds` (`entries.map(e => e.user_id)` + `commentRows.data?.map(c => c.user_id)`), o proyectar únicamente `.select('id,username')` en ambas para no transferir objetos completos de perfil innecesarios.

---

### 2.5. Eliminar Over-fetching de Perfiles en `/feed` (`src/app/feed/page.tsx`) y `/settings` (`src/app/settings/page.tsx`)

1. **En `src/app/feed/page.tsx`:**
   - Filtrar los perfiles solicitados únicamente a los usuarios que realmente aparecen en los eventos cargados:
     `const eventUserIds = [...new Set((events ?? []).map((event) => event.user_id))];`
   - Consultar `eventUserIds.length ? db.from('profiles').select('*').in('id', eventUserIds) : Promise.resolve({ data: [], error: null })` en lugar de pedir los perfiles de todos los `ids` seguidos aunque no tengan actividad.
2. **En `src/app/settings/page.tsx`:**
   - Cambiar `db.from('profiles').select('*').in('id', ids)` por `db.from('profiles').select('id,username').in('id', ids)`.

---

### 2.6. Caché en Memoria de Proceso para Diccionarios Pesados de Enka (`src/services/genshin-enka-store.ts` y `src/services/hsr-enka-store.ts`)

1. **En `src/services/genshin-enka-store.ts`:**
   - En `storeJson`, usar `cache: 'no-store'` (igual que en `hsr-enka-store.ts`) para evitar que Next.js intente guardar por duplicado `loc.json` en el Data Cache individual además del `unstable_cache` agregado.
   - Añadir una caché en memoria de módulo (`let memoryEnkaStore: { data: EnkaStore; expiresAt: number } | null = null`, TTL de 30 minutos en RAM además del `unstable_cache` de 24h) para evitar deserializar cientos de KB de JSON en cada petición consecutiva al inspector de Genshin.
2. **En `src/services/hsr-enka-store.ts`:**
   - Añadir el mismo wrapper ligero en memoria (`memoryHsrStore` con TTL de 30 minutos en RAM sobre `getHsrEnkaStore`) para evitar deserializar `~950 KB` (`avatars.json` + `weapons.json` + `hsr.json`) en cada petición consecutiva.

---

### 2.7. Code-Splitting Dinámico en `/rift` (`src/components/competitive-hub-tabs.tsx`) y Decodificación Asíncrona en `ProfileWallpaper`

1. **En `src/components/competitive-hub-tabs.tsx`:**
   - Importar `GenshinProfileView`, `ValorantProfileView`, `HsrProfileView` y `RustProfileView` mediante `dynamic` de `next/dynamic` (o lazy loading con fallback ligero) para que el navegador solo descargue el JS del visor que el usuario consulta activamente.
2. **En `src/components/profile-wallpaper.tsx`:**
   - Añadir `decoding="async"` al `<img className="wallpaper-image" src={url} alt="" decoding="async" />` para que la decodificación de los wallpapers de alta resolución no bloquee el hilo principal de pintado.

---

## 3. Plan de Verificación

1. Ejecutar `npm test` para verificar que todas las pruebas unitarias y de integración (`tests/unit/**` y `tests/integration/**`) siguen pasando al 100%.
2. Ejecutar `npm run build` para comprobar que el árbol de rutas y los imports dinámicos compilan sin advertencias ni errores de TypeScript.
3. Verificar que la navegación entre páginas con sesión iniciada ya no reconecta el canal WebSocket de `NotificationBell` en cada clic y que `/api/notifications`, `/games/[slug]`, `/feed`, `/library` y `/rift` responden con menor latencia.
