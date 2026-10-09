# Documento General de Arquitectura y Especificación (Savestate v1)

**Versión:** 1.0 (Master Unified Document)  
**Fecha:** 9 de octubre de 2026  
**Origen:** Equipo de Auditoría, Arquitectura e Investigación (`research/antigravity`)  
**Propósito:** Consolidar en un único documento maestro de referencia la visión del producto, la arquitectura técnica, el diseño de base de datos, el ecosistema de APIs, las mecánicas de gamificación y todas las funcionalidades implementadas en **Savestate**.

---

## 1. Visión del Producto y Filosofía

### 1.1. ¿Qué es Savestate?
**Savestate** es el diario de juego y la red social definitiva para jugadores de videojuegos, diseñada con una marcada estética retro-arcade y estándares de ingeniería web modernos. Inspira su filosofía en plataformas culturales como Letterboxd o Goodreads, adaptada integralmente a las particularidades del medio interactivo:
* **El concepto de Checkpoint:** Cada juego registrado no es una simple entrada en una lista, sino una partida viva que conserva horas jugadas, plataforma nativa, método de ejecución (hardware original vs emulador), dificultad, notas y fecha de finalización.
* **Memoria Colectiva Gamer:** Centraliza el historial multiplataforma de un jugador (PC, PlayStation, Xbox, consolas retro) en un perfil público personalizado que funciona como su "cuarto de juegos" (*Gamer Room*).
* **Comunidad Auténtica:** Lejos del ruido de las redes sociales convencionales, Savestate fomenta el debate crítico mediante reseñas estructuradas, captura de momentos (*highlights*), foros especializados y duelos en el Arcade.

### 1.2. Identidad Visual y Experiencia de Usuario (UI/UX)
* **Estética Cyber-Retro:** Interfaz inspirada en terminales CRT de los años 80 y 90, con líneas de escaneo (*scanlines*), tipografía monospace, bordes pixelados y acentos de color neón (Cian, Verde fósforo, Rosa neón y Ámbar).
* **Audio Procedural (ZzFX):** Sonidos retro de 8 bits generados matemáticamente en el navegador mediante Web Audio API para acciones clave (subidas de nivel, botones, checkpoints), con opción de silenciar en cualquier momento.
* **Microinteracciones y Efectos:** Paleta de comandos flotante (`Ctrl + K`), explosiones de confeti pixelado (`canvas-confetti`) al registrar platinos y transiciones fluidas que respetan `prefers-reduced-motion`.

---

## 2. Stack Tecnológico y Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                    NAVEGADOR / CLIENTE                      │
│   Next.js 15 (React 19) + Tailwind CSS + cmdk + zzfx        │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTPS / WSS
┌──────────────────────────────▼──────────────────────────────┐
│                  CAPA DE SERVIDOR (VERCEL)                  │
│   Server Components + Server Actions + API Routes (/api/*)  │
│   • psn-api (Sony PSN)        • OpenXBL REST (Xbox Live)    │
│   • Steam Web API (Valve)     • Twitch OAuth2 / IGDB API v4 │
└──────────────────────────────┬──────────────────────────────┘
                               │ SQL + RPCs + Auth + Realtime
┌──────────────────────────────▼──────────────────────────────┐
│                    BACKEND (SUPABASE)                       │
│   • PostgreSQL 16 con Row Level Security (RLS)              │
│   • Supabase Auth (PKCE, SSR Cookies, Discord & Google)     │
│   • Supabase Storage (Bucket 'profiles' - WebP 512KB)       │
│   • Supabase Realtime (WebSockets para activity_logs)       │
└─────────────────────────────────────────────────────────────┘
```

* **Frontend:** Next.js 15.x, React 19, TypeScript 5.x estricto, Tailwind CSS v4.
* **Backend as a Service:** Supabase (PostgreSQL 16, GoTrue Auth, Storage, Realtime).
* **Runtime & Despliegue:** Node.js 24 en infraestructura serverless de Vercel.
* **Seguridad de Servidor:** Paquete `server-only` para aislar código que manipula secretos, `isomorphic-dompurify` para sanitización de HTML y firmas HMAC-SHA256 con claves criptográficas privadas.

---

## 3. Ecosistema de Datos y Gaming APIs

Savestate unifica de manera nativa las cuatro principales fuentes del ecosistema de videojuegos:

| Integración | Protocolo / Proveedor | Propósito | Reglas y Caché |
|---|---|---|---|
| **Twitch / IGDB v4** | REST + Apicalypse (OAuth2 Client Credentials) | Catálogo maestro de +300.000 títulos, sinopsis, géneros y carátulas HD. | Límite atómico en BD (máx. 4 req/s vía `claim_igdb_request`). Caché local de 24h en tabla `games`. |
| **Steam Web API** | REST API v1/v2 (Valve) | Sincronización rápida y masiva de títulos de PC, minutos jugados (`playtime_forever`) y avatar. | Vistas previas firmadas con HMAC-SHA256 en servidor (`savestate.steam.v1:...`). |
| **PlayStation Network** | `psn-api` con token `PSN_NPSSO` | Importación directa de historial y trofeos ingresando el **PSN Online ID** (PS5 a PSP). | Identifica platinos y 100% de trofeos mapeando automáticamente a estado `cleared` / `platinum`. |
| **Xbox Live (OpenXBL)** | REST API v2 (`xbl.io`) | Importación directa de catálogo, logros y Gamerscore ingresando el **Xbox Gamertag** (Series X a 360). | Cabeceras estrictas (`Accept-Language: en-US`). Mapea títulos superados a `cleared`. |

---

## 4. Módulos y Funcionalidades del Sistema

### 4.1. Biblioteca del Jugador (Player Library)
* **Estados de Juego (6 categorías):**
  1. `Playing`: En curso activo.
  2. `Backlog`: Pendiente por jugar en la estantería.
  3. `Cleared`: Historia o campaña principal finalizada.
  4. `100% / Platinum`: Todos los trofeos, logros o contenido completado.
  5. `Dropped`: Juego abandonado o descartado.
  6. `Wishlist`: Lista de deseos.
* **Diario de Partidas y Sesiones Rápidas (`PlayLog` & `QuickSession`):**
  * Cada juego puede contener múltiples partidas independientes (rejugadas).
  * Registro de horas con precisión decimal, método de ejecución (`Hardware original`, `Emulador`, `Otro`), dificultad y notas personales.
  * Botón de sesión rápida para sumar minutos diarios sin editar formularios complejos.
* **Filtros Contextuales Inteligentes:**
  * **Plataforma:** Muestra únicamente las plataformas que el usuario **realmente tiene en sus partidas** (ej. `PC / Steam`, `PlayStation 5`, `Xbox`), eliminando consolas irrelevantes de catálogo.
  * **Género:** Lista exclusivamente los géneros de los juegos cargados en su biblioteca personal.
* **Paginación Ágil (5 juegos por página):**
  * Vista limitada a 5 tarjetas simultáneas con controles retro (`Anterior`, `Página X de Y`, `Siguiente`), garantizando tiempos de carga inmediatos y navegación cómoda.
* **«¿Qué juego hoy?» (Ruleta de Backlog):**
  * Algoritmo de selección aleatoria entre los títulos en Backlog del usuario, con filtros previos de plataforma y género para decidir la próxima aventura.

### 4.2. Perfil del Jugador y Estudio de Personalización (`/settings`)
* **Identidad Gamer (`ProfileIdentity`):**
  * Avatar y Banner personalizados alojados en Supabase Storage (WebP).
  * Wallpaper dinámico a pantalla completa para el perfil público.
  * Línea de estado interactiva estilo terminal Linux (`usuario@savestate:~$ Ready to play`).
  * Enlaces a redes sociales y tags públicos de PSN y Xbox Gamertag.
* **Top 4 Favoritos:** Vitrina de 4 títulos estrella fijados en la cabecera del perfil con portadas personalizables.
* **Gamer Room:** Entorno visual temático que rodea el perfil con paletas personalizables (Cian, Verde Hacker, Rosa Synthwave, Ámbar Retro).
* **Dossier de Estadísticas & Mis Consolas:**
  * Estantería de hardware donde el jugador marca qué consolas físicas posee.
  * Métrica **Clear Rate**: Porcentaje de efectividad entre juegos terminados y juegos empezados.
  * Desglose gráfico: Proporción entre partidas en Hardware Original vs Emulador.
* **SaveState Memory Card:** Generador en cliente de una tarjeta coleccionable retro en formato PNG (1200x630) con estética de Memory Card de PS1/GameCube con estadísticas y QR para compartir en redes.

### 4.3. Sistema de Niveles de Jugador, XP y Recompensas Desbloqueables
* **Mecánica de Experiencia (XP):**
  * Terminar juego (`Cleared`): **+150 XP**
  * Platinar juego (`Platinum`): **+300 XP**
  * Registrar sesión de juego: **+10 XP** (cooldown de 30 min)
  * Horas de juego acumuladas: **+15 XP por hora**
  * Escribir reseña detallada: **+75 XP**
  * Publicar momento / highlight: **+40 XP** (máx. 3 al día)
  * Primera vinculación de Steam, PSN o Xbox: **+200 XP**
  * Participar / ganar duelos en Arcade: **+15 XP / +50 XP**
* **Curva Matemática de Niveles:** $\text{Nivel} = \lfloor (\text{XP} / 100)^{1 / 1.65} \rfloor + 1$.
* **Recompensas Cosméticas por Niveles (Tiers I a V):**
  * **Marcos de Avatar exclusivos:** Bronce Arcade (Nvl 5), Famicom 8-Bit (Nvl 10), Cyber Neon (Nvl 15), Dorado 16-Bit (Nvl 20), CRT Glitch (Nvl 25), Platino Shimmer (Nvl 30), Vaporwave Sunset (Nvl 40), Holográfico Legendario (Nvl 50).
  * **Títulos de Jugador equipables:** *[Insert Coin]*, *[Button Masher]*, *[Backlog Explorer]*, *[Cartridge Blower]*, *[Save Scummer]*, *[Speedrunner]*, *[Achievement Hunter]*, *[Secret Boss]*, *[Final Boss]*.
  * **HUD de Progreso:** Insignia `[ ✦ LVL X ]` y barra interactiva con modal *"Camino de Recompensas"*.

### 4.4. Comunidad y Red Social Gamer
* **Feed de Actividad en Tiempo Real:** Canal WebSocket (`supabase_realtime`) que emite al instante partidas registradas, nuevos platinos y reseñas de la comunidad.
* **Momentos / Highlights (`/highlights`):** Publicación de capturas de pantalla, anécdotas y notas breves con sistema de reacciones temáticas:
  * `critical_hit` (Impacto crítico)
  * `gg` (Good Game)
  * `game_over` (Derrota)
* **Foros de la Comunidad (`/forum`):**
  * Categorías temáticas para debate, recomendaciones y hardware.
  * Formato Markdown procesado y sanitizado contra ataques XSS con DOMPurify.
* **Amistades y Privacidad:** Control estricto de bibliotecas. Si un perfil configura su biblioteca como privada, solo los usuarios con solicitud de amistad aceptada pueden explorarla.

### 4.5. Arcade y Duelos de Videojuegos (`/arcade`)
* **Duelos Comunitarios:** Enfrentamientos entre dos juegos de la misma época o género con votación atómica en tiempo real.
* **Party Requests (LFG):** Tablón de anuncios para encontrar compañeros de juego cooperativo o competitivo en diversas plataformas.

### 4.6. SaveState Wrapped (`/players/[username]/wrapped`)
* Módulo interactivo de resumen anual e histórico:
  * Total de horas registradas y juegos finalizados.
  * Desglose porcentual de géneros más jugados.
  * Título más jugado y medallas obtenidas durante el ciclo.

---

## 5. Endpoints de API Internos (`/api/*`)

| Endpoint | Método | Función | Seguridad |
|---|---|---|---|
| `/api/catalogue` | `GET` | Búsqueda reactiva de juegos en IGDB y base local. | Rate limit atómico en PostgreSQL. |
| `/api/steam/sync` | `POST` | Sincronización en 1 clic de horas de Steam. | Requiere sesión activa del usuario. |
| `/api/steam/import` | `POST` | Previsualización y carga masiva de juegos Steam. | Firma HMAC-SHA256 validada en servidor. |
| `/api/consoles/import` | `POST` | Sync de PSN/Xbox, auto-matching en IGDB y guardado. | Manejo de códigos 404/502/503 upstream. |
| `/api/favorites` | `POST` | Actualización de las 4 ranuras del Top 4 del perfil. | Límite estricto de 4 IDs válidos. |
| `/api/highlights` | `POST` | Publicación de momentos y fotos en el feed social. | Validación de formato y límites de texto. |
| `/api/forum` | `POST` | Publicación de hilos y respuestas en la comunidad. | Sanitización Markdown y anti-spam. |
| `/api/arcade` | `POST` | Emisión de votos en duelos de juegos. | 1 voto por jugador por duelo activo. |
| `/api/notifications` | `GET/POST` | Bandeja de notificaciones en vivo. | Aislamiento por `auth.uid() = user_id`. |
| `/api/[resource]` | `GET/POST` | Endpoint genérico para colecciones de usuario. | Validación de sesión y políticas RLS. |

---

## 6. Historial de Migraciones de Base de Datos

El esquema se encuentra versionado cronológicamente en `supabase/migrations/`:

1. `202610070001_initial.sql`: Esquema base (`profiles`, `games`, `user_games`, `play_logs`, `reviews`, `friendships`, `follows`, `activity_logs`).
2. `202610070002_notifications_moderation.sql`: Tablas de notificaciones, reportes, sugerencias y roles administrativos (`moderator`, `admin`).
3. `202610070003_hardening.sql`: Triggers de coherencia, políticas RLS de lectura y escritura seguras.
4. `202610070004_lists.sql`: Sistema de listas personalizadas de juegos (`user_lists`, `list_items`).
5. `202610070005_review_interactions.sql`: Comentarios y reacciones en reseñas.
6. `202610070006_highlights.sql`: Publicación de momentos, comentarios y reacciones `gg`/`critical_hit`.
7. `202610070007_arcade_and_badges.sql`: Sistema arcade, solicitudes de grupo (`party_requests`) y medallas (`badges`).
8. `202610070008_forum.sql`: Foros de discusión (`forum_categories`, `forum_threads`, `forum_replies`).
9. `202610070009_steam_persistence.sql`: Persistencia de Steam ID, contador de sincronizaciones y última fecha.
10. `202610070010_top4_wallpaper.sql`: Columnas para Top 4 favoritos y URL de wallpaper de perfil.
11. `202610070011_profile_studio.sql`: Campos de personalización visual (tema de habitación, bio, redes).
12. `202610070012_owned_platforms.sql`: Vitrina de hardware propio (`owned_platforms text[]`).
13. `202610070013_steam_sync_function.sql`: Procedimiento almacenado para sincronización rápida de partidas.
14. `202610070014_community_social_enhancements.sql`: Índices y triggers para actividad social.
15. `202610070015_performance_and_security.sql`: Índices de texto completo y optimización de consultas.
16. `202610080016_console_imports.sql`: Columnas `psn_id`, `xbox_gamertag` y RPC `import_console_game`.
17. `202610090017_player_levels.sql`: Columnas `xp`, `level`, `equipped_title`, `equipped_frame`, tabla `user_xp_events`, trigger `validate_equipped_rewards` y función `award_xp`.

---

## 7. Guía Maestra de Variables de Entorno (`.env.local`)

```env
# ==========================================
# SUPABASE (Base de Datos, Auth, Storage)
# ==========================================
NEXT_PUBLIC_SUPABASE_URL=https://TU_PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=TU_CLAVE_ANON_PUBLICA
SUPABASE_SERVICE_ROLE_KEY=TU_CLAVE_PRIVADA_SERVICE_ROLE

# ==========================================
# CATÁLOGO TWITCH / IGDB
# ==========================================
TWITCH_CLIENT_ID=TU_TWITCH_CLIENT_ID
TWITCH_CLIENT_SECRET=TU_TWITCH_CLIENT_SECRET

# ==========================================
# VALVE STEAM WEB API
# ==========================================
STEAM_API_KEY=TU_STEAM_API_KEY

# ==========================================
# CONSOLAS (PlayStation Network & Xbox Live)
# ==========================================
PSN_NPSSO=TU_COOKIE_NPSSO_DE_SONY_64_CHARS
XBL_API_KEY=TU_API_KEY_DE_OPENXBL

# ==========================================
# ENTORNO
# ==========================================
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 8. Criterios de Calidad y Verificación

Todo código integrado en Savestate debe cumplir la suite de calidad del proyecto:
1. `npm run lint`: 0 errores en ESLint con configuración estricta de React Hooks y Accesibilidad.
2. `npm run typecheck`: TypeScript en modo estricto (`tsc --noEmit`).
3. `npm test`: Suite de pruebas unitarias nativas con Node.js runner (cubriendo notas, fórmulas de XP, filtros, fechas y seguridad).
4. `npm run format:check`: Código formateado homogéneamente con Prettier.
5. Código de salida: `npm run check` debe finalizar con código `0` antes de desplegar a Vercel con `npx vercel --prod`.
