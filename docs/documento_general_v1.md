# Documento General de Arquitectura y Especificación (Savestate v2.8)

**Versión:** 2.8 (Master Unified Document — Actualizado)  
**Fecha:** 12 de octubre de 2026  
**Origen:** Equipo de Auditoría, Arquitectura e Investigación (`research/antigravity`)  
**Propósito:** Consolidar en un único documento maestro de referencia la visión del producto, la arquitectura técnica, el diseño de base de datos (26 migraciones), el ecosistema de APIs, los trackers competitivos y de rol (`/rift`), la personalización visual avanzada y todas las funcionalidades implementadas en **Savestate**.

---

## 1. Visión del Producto y Filosofía

### 1.1. ¿Qué es Savestate?
**Savestate** es el diario de juego, hub competitivo y red social definitiva para jugadores de videojuegos, diseñada con una marcada estética retro-arcade y estándares de ingeniería web modernos. Inspira su filosofía en plataformas culturales como Letterboxd o Goodreads, adaptada integralmente a las particularidades del medio interactivo:
* **El concepto de Checkpoint:** Cada juego registrado no es una simple entrada en una lista, sino una partida viva que conserva horas jugadas, plataforma nativa, método de ejecución (hardware original vs emulador), progreso de logros/trofeos, dificultad, notas y fecha de finalización.
* **Memoria Colectiva y Habitación Gamer:** Centraliza el historial multiplataforma de un jugador (PC/Steam, PlayStation, Xbox, consolas retro, juegos Indie de Itch.io y títulos competitivos/gacha) en un perfil público personalizado que funciona como su "cuarto de juegos" (*Gamer Room*).
* **Comunidad Auténtica en Tiempo Real:** Savestate fomenta la conexión real mediante presencia online instantánea, chat directo privado entre amigos, salas de voz Cyber-Radio (LiveKit WebRTC), puente multi-frecuencia con Discord, captura de momentos (*highlights*), foros especializados y radar de ofertas y lanzamientos.

### 1.2. Identidad Visual y Experiencia de Usuario (UI/UX)
* **Estética Cyber-Retro & Personalización Total:** Interfaz inspirada en terminales CRT y cabinas arcade con tipografía monospace/pixel (`JetBrains Mono` y `Silkscreen`), fondo oficial *Retro Grid*, 8 habitaciones gamer (incluyendo ediciones estacionales de **🎃 Halloween** y **🎄 Navidad**), 12 avatares pixel-art de galería, 6 wallpapers vectoriales/ambientales y selector de color libre con **paleta interactiva + código Hexadecimal (`#RRGGBB`)**.
* **Audio Procedural (ZzFX):** Sonidos retro de 8 bits generados matemáticamente en el navegador mediante Web Audio API para acciones clave, con opción de silenciar en ajustes.
* **Microinteracciones y Accesibilidad:** Paleta de comandos flotante (`Ctrl + K`), explosiones de confeti pixelado (`canvas-confetti`) al registrar platinos y transiciones fluidas que respetan `prefers-reduced-motion`.

---

## 2. Stack Tecnológico y Arquitectura

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          NAVEGADOR / CLIENTE                            │
│  Next.js 15 (React 19) + Tailwind CSS v4 + cmdk + zzfx + LiveKit WebRTC │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ HTTPS / WSS
┌────────────────────────────────────▼────────────────────────────────────┐
│                        CAPA DE SERVIDOR (VERCEL)                        │
│  Server Components (Suspense Streaming) + API Routes (/api/*) + Cron    │
│  • Twitch OAuth2 / IGDB API v4    • Steam Web API & SteamUserStats      │
│  • psn-api (Sony PSN)             • OpenXBL REST (Xbox Live)            │
│  • Riot Games API + DataDragon    • HenrikDev API (Valorant MMR/Matches)│
│  • Enka.Network (Genshin & HSR)   • CheapShark & GamerPower (Ofertas)   │
│  • Discord Bot REST + Ed25519     • Itch.io Scraping / RSS / LiveKit    │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ SQL + RPCs + Auth + Realtime
┌────────────────────────────────────▼────────────────────────────────────┐
│                          BACKEND (SUPABASE)                             │
│  • PostgreSQL 16 con Row Level Security (RLS) en todas las tablas       │
│  • Supabase Auth (PKCE, SSR Cookies, Discord & Google OAuth)            │
│  • Supabase Storage (Buckets 'profiles' y 'highlights' - WebP)          │
│  • Supabase Realtime (Postgres Changes, Presence Online y Broadcast DM) │
└─────────────────────────────────────────────────────────────────────────┘
```

* **Frontend:** Next.js 15.x, React 19, TypeScript 5.x estricto, Tailwind CSS v4.
* **Backend as a Service:** Supabase (PostgreSQL 16, GoTrue Auth, Storage, Realtime Presence & Broadcast).
* **Runtime & Despliegue:** Node.js 24 en infraestructura serverless de Vercel con Cron Jobs automatizados.
* **Seguridad de Servidor:** Paquete `server-only`, `isomorphic-dompurify` para sanitización XSS, verificación criptográfica `Ed25519` para Discord Interactions y firmas `HMAC-SHA256`.

---

## 3. Ecosistema de Datos y Gaming APIs

Savestate integra de manera nativa **10 fuentes del ecosistema global de videojuegos**:

| Integración | Proveedor / Protocolo | Propósito en Savestate | Caché y Seguridad |
|---|---|---|---|
| **Twitch / IGDB v4** | Twitch OAuth2 + Apicalypse | Catálogo de +300.000 juegos, radar de próximos lanzamientos y espectadores en vivo en Twitch. | Rate-limit atómico (`claim_igdb_request`), caché local de 24h en `games`. |
| **Steam Web API** | Valve REST (`ISteamUser`, `IPlayerService`, `ISteamUserStats`) | Importación/sync de biblioteca PC, logros al 100%, jugadores simultáneos y tracker de **Rust** (AppID `252490`). | Firma HMAC-SHA256 en vistas previas y rate-limit por cuenta. |
| **PlayStation Network** | `psn-api` (`PSN_NPSSO`) | Sincronización de juegos, horas reales jugadas (`playDuration`), trofeos y platinos (PS5, PS4, PS3, Vita, PSP). | Mapeo automático de platinos y progreso de trofeos en `console_progress`. |
| **Xbox Live (OpenXBL)** | REST v2 (`xbl.io`) | Sincronización de catálogo, minutos jugados, Gamerscore y porcentaje de logros por título. | Cabeceras validadas en servidor; persistencia en `console_progress`. |
| **Riot Games API + DataDragon** | Riot Regional/Platform REST (`RIOT_API_KEY`) | **Rift Tracker**: Historial de partidas de **League of Legends**, rangos con emblemas, maestría de campeones, medallas MVP/Pentakill e identidad de **Valorant**. | Validación estricta de `Nombre#TAG`, caché de 60s y publicación rica en Momentos. |
| **HenrikDev Valorant API** | REST (`HENRIK_API_KEY` + fallback Riot) | Tracker dual de **Valorant**: MMR, rango competitivo, RR, winrate e historial de partidas con fallback a Riot API. | Consultas en paralelo con tolerancia a fallos parciales. |
| **Enka.Network API** | REST + Diccionarios GitHub | Trackers de **Genshin Impact** y **Honkai: Star Rail**: vitrina de personajes por UID, armas/conos de luz, artefactos/reliquias, constelaciones/eidolones y estadísticas calculadas. | Caché diaria de diccionarios en español/inglés y orígenes CSP restringidos. |
| **CheapShark & GamerPower** | REST Públicas | Radar de **Juegos Gratis (100% OFF)** en Portada/Discord y comparador del mejor precio histórico en fichas de juegos. | Caché de 5 a 60 minutos y anuncios automáticos en Discord con nonce anti-duplicados. |
| **Itch.io Tracker** | Extractor Server-Side + Cron | Seguimiento de juegos indie en desarrollo, detección automática de nuevas versiones/devlogs y notificaciones. | Protección SSRF estricta (solo dominios `*.itch.io`) y cron diario `/api/cron/check-itch`. |
| **Discord API v10** | Bot Token + Webhook + Ed25519 + OAuth2 | Puente de chat en 3 canales, 8 comandos Slash (`/web`, `/perfil`, `/juego`, `/gratis`, `/lol`, `/valorant`, `/genshin`, `/savestate`) y Roles Vinculados. | Firma Ed25519 obligatoria y ACK diferido para comandos lentos. |

---

## 4. Módulos y Funcionalidades del Sistema

### 4.1. Portada Dinámica, Noticias y Radar de Lanzamientos (`/`)
* **Noticias Recientes de Videojuegos, Anime y Manga:** Lector RSS agregador en español (Vandal, 3DJuegos, Eurogamer, AnmoSugoi, Ramen Para Dos) con miniaturas extraídas, filtros por fuente y paginación.
* **Radar de Juegos Gratis (Freebies):** Panel en vivo impulsado por GamerPower que alerta sobre juegos y DLCs gratuitos por tiempo limitado en Steam, Epic Games Store y GOG.
* **Radar de Próximos Lanzamientos (IGDB Countdown):** Escaparate de los lanzamientos más esperados con cuenta regresiva en días y filtros por plataforma.

### 4.2. Fichas de Juegos con Telemetría en Vivo (`/games/[slug]`)
* **Radar del Juego en Vivo (Suspense Streaming):**
  * **Steam Live Players:** Cantidad exacta de jugadores conectados simultáneamente dentro del título en Steam.
  * **Twitch Live Streams:** Espectadores en vivo y canales transmitiendo el juego en ese instante.
  * **Mejor Oferta Activa (CheapShark):** Precio más bajo actual comparado con el precio normal y porcentaje de descuento directo para comprar.

### 4.3. Hub Competitivo y de Trackers (`/rift`)
Cinco trackers especializados reunidos en una vista dedicada con fondo ambiental de *Arcane* e iconos oficiales para cada juego:
1. **League of Legends (Riot API):**
   * Búsqueda por `Nombre#TAG` y servidor (`LAS`, `LAN`, `NA`, `BR`, `EUW`, `KR`, etc.), con **Cuenta Fijada** y **Búsquedas Recientes**.
   * Tarjetas de rango Solo/Dúo y Flexible con **emblemas visuales por liga** (Hierro a Retador), LP y winrate.
   * **Top 3 Campeones con Más Maestría**, analíticas de **Roles y Campeones más jugados**, filtros por cola (`Todas`, `Solo/Dúo`, `Normales`, `ARAM`, `Arena`, `Otros`), **Medallas Arcade** (`👑 MVP`, `⚡ PENTAKILL`, `% P/K`), paginación **"Cargar más partidas"** y botón **`🚀 Publicar en Momentos`** que genera un post estructurado en Markdown con todas las estadísticas del combate.
2. **Valorant (HenrikDev + Riot Dual Tracker):**
   * Rango competitivo, RR, nivel de cuenta, historial de partidas con agente, mapa, resultado y KDA, más tarjeta de identidad cruzada Riot.
3. **Genshin Impact (Enka.Network):**
   * Consulta por UID de 9 dígitos: Nivel de Aventura, Mundo, Logros, Abismo Espiral y vitrina interactiva de personajes con nivel, constelaciones, amistad, talentos, arma equipada, set de 5 artefactos y estadísticas finales (PV, ATQ, DEF, Prob./Daño Crítico, Recarga).
4. **Honkai: Star Rail (Enka.Network):**
   * Consulta por UID: Nivel Trazacaminos, Equilibrio, Universo Simulado y builds completas de personajes con Vía, Elemento, Eidolones, Cono de Luz, Reliquias y cálculo exacto de atributos.
5. **Rust (Steamworks Stats API):**
   * Consulta por SteamID64, URL de perfil o vanity name: horas totales en Rust, logros desbloqueados y estadísticas acumuladas de combate (bajas, muertes, K/D, disparos a la cabeza), supervivencia y recolección de recursos.

### 4.4. Perfil del Jugador Optimizado y Estudio de Personalización (`/players/[username]` & `/settings`)
* **Optimización de Carga y Pestañas Interactivas (`ProfileContentTabs`):**
  * Cálculo de Dossier en memoria reutilizando la consulta de biblioteca (ahorro del 40% de viajes a Supabase).
  * Barra de navegación unificada y organización inferior en 3 pestañas sin scroll infinito: **`🎮 Biblioteca`**, **`📊 Dossier y Estadísticas`** y **`🏆 Logros y Memory Card`**.
* **Señal de Actividad en Tiempo Real (`● Activo` / `○ Inactivo`):**
  * Impulsada por **Supabase Realtime Presence** (`src/lib/presence.ts`). Muestra al instante debajo del `@username` (tanto en la cabecera del perfil como en el widget de **Amigos** y solicitudes) si el jugador se encuentra navegando dentro de la web en ese momento.
* **Personalización Visual Avanzada (`ProfileStudio`):**
  * **8 Habitaciones Gamer (`room_theme`):** `Terminal CRT`, `Consola portátil`, `Estantería retro`, `👾 Cabina Arcade 80s`, `⚡ Cyberdeck HUD`, `🌅 Santuario Vaporwave`, **`🎃 Noche de Halloween (Spooky)`** y **`🎄 Cabaña de Navidad (Holiday)`**.
  * **12 Avatares de Galería Pixel-Art (`public/avatars/`):** 4 clásicos (`cyan`, `green`, `pink`, `amber`), 4 festivos (`halloween_pumpkin`, `halloween_ghost`, `christmas_santa`, `christmas_snowman`) y 4 personajes (`retro_robot`, `space_invader`, `cyber_samurai`, `wizard_mage`).
  * **6 Wallpapers Predefinidos + Subida Propia:** Incluye los nuevos fondos `🎃 Halloween` y `🎄 Navidad`.
  * **8 Colores Predefinidos + Paleta Libre y Código Hex (`#RRGGBB`):** Selector de color interactivo y entrada hexadecimal con vista previa en vivo y respaldo retrocompatible automático (`_savestate_appearance`).

### 4.5. Mensajería Directa entre Amigos, Voz y Comunidad
* **Chat Directo Privado 1-a-1 (`FriendChatModal`):**
  * Mensajería privada entre amigos aceptados dentro del widget de Amigos, protegida por RLS en la tabla `friend_messages` y sincronizada en vivo mediante canales privados de Supabase Realtime Broadcast.
* **Salas de Voz Cyber-Radio (`/parties` + LiveKit WebRTC):**
  * Lobbies de voz en tiempo real integrados en las solicitudes de grupo (LFG) con controles de micrófono, participantes hablando y desconexión limpia.
* **Momentos (`/highlights`), Foros (`/forum`) y Transmisión (`/feed`):**
  * Publicaciones con soporte de hasta 4 capturas WebP, videos de YouTube/Shorts, incrustaciones sociales, reacciones gamer (`critical_hit`, `gg`, `game_over`) y comentarios.

---

## 5. Historial Completo de Migraciones SQL (`supabase/migrations/`)

1. `202610070001_initial.sql`: Esquema fundacional (`profiles`, `games`, `user_games`, `play_logs`, `reviews`, `friendships`, `follows`, `activity_logs`).
2. `202610070002_notifications_moderation.sql`: Sistema de notificaciones, reportes, sugerencias y moderación.
3. `202610070003_hardening.sql`: Endurecimiento de políticas RLS, permisos y funciones seguras.
4. `202610070004_highlights.sql`: Tablas de momentos gamer (`posts`, reacciones y comentarios).
5. `202610070005_highlights_privacy.sql`: Visibilidad privada ("Solo yo") en momentos.
6. `202610070006_highlights_privacy_guard.sql`: Guardas adicionales de privacidad para multimedia de momentos.
7. `202610070007_moment_notifications.sql`: Triggers de notificaciones al reaccionar o comentar momentos.
8. `202610070008_arcade_and_parties.sql`: Duelos comunitarios (`game_duels`, `duel_votes`), LFG (`party_requests`) y columna `room_theme`.
9. `202610070009_badges.sql`: Catálogo de medallas retro (`badges`, `user_badges`) y evaluación automática.
10. `202610070010_steam_import.sql`: Soporte de vinculación e importación de biblioteca desde Steam.
11. `202610080011_forum_boards.sql`: Tableros y canales del foro comunitario (`forum_threads`, `forum_posts`).
12. `202610080012_owned_platforms.sql`: Columna `owned_platforms` para vitrina de consolas propias.
13. `202610080013_profile_wallpapers.sql`: Columna `wallpaper_url` y políticas de almacenamiento en bucket `profiles`.
14. `202610080014_steam_sync_ratelimit.sql`: Sincronización rápida de Steam con control de frecuencia.
15. `202610080015_steam_sync_account_guard.sql`: Protección de integridad de cuenta en sincronizaciones de Steam.
16. `202610080016_console_imports.sql`: Columnas `psn_id`, `xbox_gamertag` y RPC `import_console_game`.
17. `202610090017_player_levels.sql`: Sistema de niveles, `xp`, `level`, `equipped_title`, `equipped_frame` y `award_xp`.
18. `202610090018_console_progress.sql`: Columna JSONB `console_progress` en `play_logs` para trofeos PSN y logros Xbox.
19. `202610090019_steam_achievements_progress.sql`: Sincronización de porcentaje de logros de Steam en `console_progress`.
20. `202610090020_public_accepted_friendships.sql`: RPC `get_player_friends` para el widget social de amigos.
21. `202610090021_discord_bridge.sql`: Soporte para el puente comunitario con Discord.
22. `202610090022_itch_tracker.sql`: Tabla `itch_trackers` para seguimiento de juegos indie de Itch.io.
23. `202610100023_itch_monitor.sql`: Monitor automatizado de actualizaciones e instaladores de Itch.io.
24. `202610110025_custom_themes_and_seasonal_rooms.sql`: Ampliación de `theme_color` (8 presets + código `#RRGGBB` libre), `room_theme` (8 habitaciones incluyendo Halloween y Navidad) y promoción automática de respaldos de compatibilidad.
25. `202610110026_friend_direct_messages.sql`: Tabla `friend_messages` con RLS estricto entre amigos aceptados y políticas de Realtime Broadcast privado.

---

## 6. Guía Maestra de Variables de Entorno (`.env.local`)

```env
# 1. SUPABASE (Base de Datos, Auth, Storage, Realtime)
NEXT_PUBLIC_SUPABASE_URL=https://TU_PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=TU_CLAVE_ANON_PUBLICA
SUPABASE_SERVICE_ROLE_KEY=TU_CLAVE_PRIVADA_SERVICE_ROLE

# 2. CATÁLOGO TWITCH / IGDB & STREAMS EN VIVO
TWITCH_CLIENT_ID=TU_TWITCH_CLIENT_ID
TWITCH_CLIENT_SECRET=TU_TWITCH_CLIENT_SECRET

# 3. VALVE STEAM WEB API (Biblioteca PC, Logros, Live Players y Tracker de Rust)
STEAM_API_KEY=TU_STEAM_API_KEY

# 4. CONSOLAS (PlayStation Network & Xbox Live)
PSN_NPSSO=TU_COOKIE_NPSSO_DE_SONY_64_CHARS
XBL_API_KEY=TU_API_KEY_DE_OPENXBL

# 5. RIFT TRACKER COMPETITIVO (League of Legends & Valorant)
RIOT_API_KEY=TU_RIOT_GAMES_API_KEY
HENRIK_API_KEY=TU_HENRIKDEV_API_KEY_OPCIONAL

# 6. DISCORD BRIDGE, BOT INTERACTIONS Y LINKED ROLES
DISCORD_BOT_TOKEN=TU_DISCORD_BOT_TOKEN
DISCORD_CHANNEL_ID=ID_CANAL_GENERAL
DISCORD_CHECKPOINTS_CHANNEL_ID=ID_CANAL_CHECKPOINTS_OPCIONAL
DISCORD_ANNOUNCEMENTS_CHANNEL_ID=ID_CANAL_ANUNCIOS_OPCIONAL
DISCORD_WEBHOOK_URL=TU_WEBHOOK_URL_OPCIONAL
DISCORD_APPLICATION_ID=1557446548982464652
DISCORD_PUBLIC_KEY=6ae28438c8aabef52a28b13d1f5ef1714c9ce11a71a5b47b70d466d247981450
DISCORD_CLIENT_SECRET=TU_DISCORD_OAUTH_CLIENT_SECRET
DISCORD_INVITE_URL=https://discord.gg/532ZQzVXCp

# 7. SALAS DE VOZ (LIVEKIT OPCIONAL) & CRON JOBS
LIVEKIT_API_KEY=TU_LIVEKIT_KEY_OPCIONAL
LIVEKIT_API_SECRET=TU_LIVEKIT_SECRET_OPCIONAL
NEXT_PUBLIC_LIVEKIT_URL=wss://TU_PROYECTO.livekit.cloud
CRON_SECRET=SECRETO_ALEATORIO_MIN_32_CARACTERES

# 8. ENTORNO
NEXT_PUBLIC_APP_URL=https://savestate-eight.vercel.app
```

---

## 7. Criterios de Calidad y Verificación Continua

Todo cambio en Savestate se valida con `npm run check`:
1. `npm run lint`: 0 errores en ESLint.
2. `npm run typecheck`: TypeScript estricto (`tsc --noEmit`).
3. `npm test`: Suite de **125+ pruebas unitarias y de servicios** con el runner nativo de Node.js 24.
4. `npm run format:check`: Formato verificado con Prettier.
5. Despliegue en producción verificado en Vercel (`npx vercel --prod`).
