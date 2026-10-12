# Inventario Completo de APIs, Servicios e Integraciones de Savestate (v2.8)

**Fecha:** 12 de octubre de 2026  
**Origen:** Auditoría e Investigación Técnica (`research/antigravity`)  
**Propósito:** Proporcionar una radiografía exhaustiva, actualizada y desglosada de todas las APIs, servicios externos, integraciones de upstream, endpoints internos, canales en tiempo real y librerías que impulsan la plataforma **Savestate**.

---

## 1. Mapa Global del Ecosistema

| Servicio / API | Proveedor | Tipo | Variables de Entorno | Estado en Proyecto |
|---|---|---|---|---|
| **Supabase Database** | Supabase / AWS | PostgreSQL 16 BaaS (26 migraciones) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | **Activo** (Core del sistema) |
| **Supabase Auth** | Supabase | Auth con PKCE & OAuth | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Activo** (Email, Google & Discord) |
| **Supabase Storage** | Supabase | Object Storage (WebP) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Activo** (Buckets `profiles` y `highlights`) |
| **Supabase Realtime** | Supabase | WebSocket (Postgres Changes, Presence, Broadcast) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Activo** (Feed, Notificaciones, Presencia Online y Chat 1-a-1) |
| **Twitch / IGDB API v4** | Twitch / Amazon | Catálogo, Radar de Lanzamientos y Live Streams | `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET` | **Activo** (Caché 24h + Live Telemetry) |
| **Steam Web API** | Valve Corporation | Biblioteca PC, Logros, Live Players y **Rust Tracker** | `STEAM_API_KEY` | **Activo** (Sync, Import, Stats AppID `252490`) |
| **PlayStation Network** | Sony Interactive Ent. | Trofeos, Platinos y Horas Reales (`playDuration`) | `PSN_NPSSO` (`psn-api`) | **Activo** (Sync directa por Online ID) |
| **Xbox Live (OpenXBL)**| xbl.io / Microsoft | Logros, Gamerscore y Minutos Jugados | `XBL_API_KEY` | **Activo** (Sync directa por Gamertag) |
| **Riot Games API + DataDragon** | Riot Games | **League of Legends** (Partidas, Rangos, Maestría) + **Valorant** Identidad/Shards | `RIOT_API_KEY` | **Activo** (Vista dedicada `/rift` y bot Discord) |
| **HenrikDev API** | HenrikDev | **Valorant** MMR, Rango Competitivo, RR e Historial | `HENRIK_API_KEY` (opcional, con fallback Riot) | **Activo** (Dual Tracker en `/rift` y bot Discord) |
| **Enka.Network API** | Enka.Network | **Genshin Impact** y **Honkai: Star Rail** (Builds por UID) | Pública (sin API Key, diccionarios cacheados 24h) | **Activo** (`/rift` y comando `/genshin`) |
| **CheapShark & GamerPower** | CheapShark / GamerPower | Ofertas en vivo en fichas de juegos y Radar de Juegos Gratis | Públicas (sin API Key) | **Activo** (Portada, fichas `/games/[slug]` y Discord) |
| **Discord API v10** | Discord Inc. | Bridge Multicanal, 8 Slash Commands, Linked Roles y Auto-Freebies | `DISCORD_BOT_TOKEN`, `DISCORD_CHANNEL_ID`, `DISCORD_PUBLIC_KEY`, `DISCORD_CLIENT_SECRET` | **Activo** (`/community`, `/api/discord/*`) |
| **Itch.io Monitor** | Itch.io | Rastreador de versiones e instaladores de juegos Indie | `CRON_SECRET` | **Activo** (Perfil y `/api/cron/check-itch`) |
| **LiveKit WebRTC** | LiveKit Cloud | Salas de voz Cyber-Radio en vivo para Party Lobbies | `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `NEXT_PUBLIC_LIVEKIT_URL` | **Activo / Opcional** (`/parties`) |
| **RSS Gaming & Anime Feeds** | Vandal, 3DJuegos, Eurogamer, RamenParaDos, AnmoSugoi | Noticias recientes de videojuegos, anime y manga con miniaturas | Públicas | **Activo** (Portada `/`) |
| **Vercel Platform** | Vercel | Hosting Serverless, Edge Network & Cron Jobs | Configuración de despliegue | **Activo** (Producción) |

---

## 2. Servicios de Infraestructura y Tiempo Real (Supabase)

### 2.1. Base de Datos Relacional (PostgreSQL 16)
* **Seguridad a Nivel de Filas (RLS):** Aplicada en el 100% de las tablas públicas (`profiles`, `games`, `user_games`, `play_logs`, `reviews`, `friendships`, `friend_messages`, `follows`, `activity_logs`, `posts`, `forum_threads`, `forum_posts`, `game_duels`, `party_requests`, `badges`, `user_badges`, `itch_trackers`).
* **Procedimientos Almacenados (RPCs destacados):**
  * `public.award_xp(p_user_id, p_amount, p_action, p_reference_id)`: Otorga XP de forma atómica y recalcula niveles.
  * `public.claim_igdb_request()`: Semáforo atómico de control de concurrencia para IGDB (< 4 req/s).
  * `public.can_view_library(owner_id)`: Valida la privacidad de bibliotecas según amistad aceptada o visibilidad pública.
  * `public.get_player_friends(p_user_id)`: Obtiene la lista de amigos aceptados con nivel y avatar.
  * `public.import_console_game(...)`: Registra o actualiza títulos, horas y progreso de trofeos/logros de consolas.

### 2.2. Supabase Realtime (3 Modos Activos)
1. **Postgres Changes (`activity_logs`, `notifications`, `friend_messages`):** Actualiza en vivo el feed de transmisión, la campana de notificaciones y el respaldo del chat de amigos.
2. **Realtime Presence (`savestate:presence` en `src/lib/presence.ts`):** Mantiene en memoria un conjunto reactivo de usuarios con la web abierta para mostrar la señal **`● Activo`** / **`○ Inactivo`** debajo del nombre del jugador en el widget de Amigos y en los perfiles sin desgastar la base de datos.
3. **Realtime Broadcast Privado (`friend_chat:*`):** Notifica instantáneamente nuevos mensajes privados 1-a-1 entre amigos autorizados por RLS.

---

## 3. Detalle de APIs de Trackers Competitivos y Telemetría (`/rift` y `/games/[slug]`)

### 3.1. Riot Games API + CommunityDragon / DataDragon (League of Legends)
* **Account-V1 (`/riot/account/v1/accounts/by-riot-id/{gameName}/{tagLine}`):** Resuelve cualquier Riot ID a su `puuid` global.
* **Summoner-V4 & League-V4:** Obtiene nivel de invocador, icono y rangos clasificatorios (Solo/Dúo y Flexible) con emblemas visuales para cada liga (`Hierro` a `Retador`).
* **Champion-Mastery-V4:** Obtiene el Top 3 de campeones con mayor nivel y puntos de maestría del jugador.
* **Match-V5 (`/lol/match/v5/matches/by-puuid/{puuid}/ids`):** Soporta paginación incremental (`start` + `count`), cálculo de medallas (`👑 MVP`, `⚡ PENTAKILL`, `% P/K`), analíticas de roles/campeones y publicación de momentos enriquecidos en Markdown hacia `/highlights`.

### 3.2. Valorant Dual Tracker (HenrikDev + Riot API Fallback)
* **Modo Primario (HenrikDev API con `HENRIK_API_KEY`):** Consulta en paralelo cuenta, MMR competitivo (rango, RR, cambio de puntos) e historial de las últimas partidas con agente, mapa, marcador y KDA.
* **Modo Fallback (Riot API con `RIOT_API_KEY`):** Verifica el Riot ID oficial, descubre el shard activo (`latam`, `br`, `na`, `eu`, `ap`, `kr`), consulta el Top 10 del Leaderboard competitivo regional (`VAL-CONTENT-V1` / `VAL-RANKED-V1`) y presenta la identidad verificada junto con el arte oficial de `valorant-api.com`.

### 3.3. Enka.Network (Genshin Impact & Honkai: Star Rail)
* **Genshin Impact (`/api/uid/{uid}`):** Extrae perfil público (Adventure Rank, Nivel de Mundo, Logros, Abismo Espiral) y el escaparate completo de hasta 8 personajes con nivel, constelaciones, amistad, talentos, arma, artefactos y estadísticas finales en español/inglés.
* **Honkai: Star Rail (`/api/hsr/uid/{uid}`):** Extrae perfil Trazacaminos y calcula las estadísticas de cada personaje sumando base de personaje + base del Cono de Luz + bonificaciones planas y porcentuales de Reliquias.

### 3.4. Rust Tracker (Valve Steamworks `ISteamUserStats`)
* **Endpoints:** `ISteamUser/ResolveVanityURL`, `ISteamUser/GetPlayerSummaries`, `IPlayerService/GetOwnedGames` y `ISteamUserStats/GetUserStatsForGame` (`appid=252490`).
* **Métricas extraídas:** Horas jugadas en Rust, logros desbloqueados y estadísticas acumuladas de combate (bajas JcJ, muertes, ratio K/D, headshots, precisión), supervivencia y recolección de recursos.

---

## 4. Endpoints Internos de Servidor (`/api/*`)

| Ruta | Método | Propósito |
|---|---|---|
| `/api/catalogue` | `GET` | Búsqueda reactiva de videojuegos en IGDB y caché local. |
| `/api/steam/sync` | `POST` | Sincronización en 1 clic de horas y logros de Steam. |
| `/api/steam/import` | `POST` | Previsualización firmada con HMAC-SHA256 e importación en lote de Steam. |
| `/api/consoles/import` | `POST` | Sincronización de PSN y Xbox Live con horas y progreso de trofeos/logros. |
| `/api/tracker/lol` | `GET` | Consulta paginada de perfil, rangos, maestría e historial de League of Legends. |
| `/api/tracker/inspect` | `POST` | Consulta unificada de perfiles para Valorant, Genshin Impact, Honkai: Star Rail y Rust. |
| `/api/tracker/radar` | `POST` | Consulta de telemetría en vivo (Steam players, Twitch viewers, ofertas CheapShark). |
| `/api/tracker/itch` | `GET/POST` | Gestión de juegos indie rastreados desde Itch.io. |
| `/api/cron/check-itch` | `GET/POST` | Cron job protegido por `CRON_SECRET` para detectar nuevas versiones en Itch.io. |
| `/api/cron/discord-freebies` | `GET/POST` | Cron job diario para anunciar juegos gratuitos de GamerPower en Discord. |
| `/api/discord/bridge` | `GET/POST` | Lectura multi-frecuencia (`general`, `checkpoints`, `announcements`) y envío a Discord. |
| `/api/discord/interactions` | `POST` | Receptor verificado con `Ed25519` para los 8 comandos Slash del bot de Discord. |
| `/api/discord/role-connection` | `GET` | OAuth2 y sincronización de Linked Roles de SaveState en Discord. |
| `/api/players/chat` | `GET/POST` | Historial y envío de mensajes directos privados 1-a-1 entre amigos aceptados. |
| `/api/favorites` | `POST` | Actualización de las 4 ranuras del Top 4 del perfil. |
| `/api/highlights` | `POST` | Creación, edición y reacciones en Momentos Gamer. |
| `/api/forum` | `POST` | Creación de hilos y respuestas en los tableros del foro. |
| `/api/arcade` | `POST` | Votación atómica en duelos comunitarios de juegos. |
| `/api/notifications` | `GET/POST` | Bandeja de notificaciones en tiempo real. |
| `/api/[resource]` | `POST` | Mutaciones de biblioteca, perfil (con temas estacionales y color Hex), listas, social y parties. |
