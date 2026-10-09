# Inventario Completo de APIs, Servicios e Integraciones de Savestate

**Fecha:** 9 de octubre de 2026  
**Origen:** Auditoría e Investigación Técnica (`research/antigravity`)  
**Propósito:** Proporcionar una radiografía exhaustiva, clara y desglosada de todas las APIs, servicios externos, integraciones de upstream, microservicios internos y librerías que impulsan la plataforma **Savestate**.

---

## 1. Mapa Global del Ecosistema

| Servicio / API | Proveedor | Tipo | Variables de Entorno | Estado en Proyecto |
|---|---|---|---|---|
| **Supabase Database** | Supabase / AWS | PostgreSQL 16 BaaS | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | **Activo** (Core del sistema) |
| **Supabase Auth** | Supabase | Auth con PKCE & OAuth | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Activo** (Google & Discord) |
| **Supabase Storage** | Supabase | Object Storage (WebP) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Activo** (Bucket `profiles`) |
| **Supabase Realtime** | Supabase | WebSocket Pub/Sub | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Activo** (`activity_logs`) |
| **Twitch / IGDB API** | Twitch / Amazon | Catálogo de Videojuegos | `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET` | **Activo** (Caché local 24h) |
| **Steam Web API** | Valve Corporation | Catálogo y Partidas PC | `STEAM_API_KEY` | **Activo** (Sync rápido e import) |
| **PlayStation Network** | Sony Interactive Ent. | Trofeos y Títulos PSN | `PSN_NPSSO` (psn-api) | **Activo** (Sync directa por ID) |
| **Xbox Live (OpenXBL)**| xbl.io / Microsoft | Logros y Gamerscore | `XBL_API_KEY` | **Activo** (Sync directa por GT) |
| **Vercel Platform** | Vercel | Hosting & Edge Runtime | N/A (Configuración del deploy) | **Activo** (Producción) |

---

## 2. Servicios de Infraestructura y Base de Datos (Supabase)

### 2.1. Base de Datos Relacional (PostgreSQL 16)
* **Descripción:** Base de datos relacional principal con seguridad a nivel de filas (**Row Level Security - RLS**) aplicada obligatoriamente en todas las tablas del esquema.
* **Seguridad y Acceso:**
  * **Cliente Público (`anon`):** Accede mediante cookies SSR seguras. Solo puede leer y escribir lo permitido estrictamente por las políticas RLS del usuario autenticado (`auth.uid() = user_id`).
  * **Cliente Administrativo (`service_role`):** Clave privada de servidor utilizada exclusivamente para la ingesta del catálogo de juegos, asignación atómica de puntos de experiencia (`award_xp`) y tareas de backend fuera del alcance del usuario.
* **Procedimientos Almacenados (RPCs nativos):**
  * `public.award_xp(p_user_id, p_amount, p_action, p_reference_id)`: Otorga XP de forma atómica y recalcula niveles previniendo duplicados.
  * `public.claim_igdb_request()`: Semáforo atómico de control de concurrencia para peticiones a IGDB.
  * `public.can_view_library(owner_id)`: Valida la privacidad de bibliotecas según amistad o visibilidad pública.
  * `public.import_console_game(...)`: Registra o actualiza títulos y partidas importadas desde PlayStation y Xbox.

### 2.2. Supabase Auth (Gestión de Identidad)
* **Flujo de Sesión:** Implementa **PKCE (Proof Key for Code Exchange)** con intercambio de tokens en la ruta de retorno `/auth/callback` y gestión de cookies seguras `httpOnly` vía `@supabase/ssr`.
* **Proveedores Soportados:**
  * **Email y Contraseña:** Con verificación obligatoria por correo y recuperación vía `/auth/confirm?token_hash=...`.
  * **OAuth Social:** Integración directa con **Discord** y **Google**. Las credenciales OAuth se configuran en el dashboard de Supabase (sin exponer claves en el código).

### 2.3. Supabase Storage (Almacenamiento de Multimedia)
* **Bucket:** `profiles` (público para lectura).
* **Políticas de Seguridad:**
  * Formato admitido: Estrictamente imágenes **WebP**.
  * Tamaño máximo por archivo: **512 KB (512.000 bytes)**.
  * Aislamiento por usuario: Cada jugador solo puede escribir en su propia carpeta asignada:
    * `profiles/{USER_UUID}/avatar.webp`
    * `profiles/{USER_UUID}/banner.webp`

### 2.4. Supabase Realtime (WebSockets)
* **Canal:** `supabase_realtime`.
* **Tablas publicadas:** `activity_logs`.
* **Propósito:** Transmitir en vivo actualizaciones de actividad (nuevos checkpoints, reseñas, subidas de nivel y momentos) hacia el Feed social de la plataforma sin recargar la página.

---

## 3. APIs Externas de Videojuegos (Upstream Gaming APIs)

### 3.1. Twitch / IGDB API (Internet Game Database)
* **Función:** Es la enciclopedia central de juegos de Savestate. Provee títulos, sinopsis, fechas de lanzamiento, plataformas, géneros, desarrolladoras y portadas oficiales.
* **Autenticación:**
  * **Endpoint OAuth2:** `https://id.twitch.tv/oauth2/token`
  * **Método:** `POST` con flujo `grant_type=client_credentials`.
  * **Variables:** `TWITCH_CLIENT_ID` y `TWITCH_CLIENT_SECRET`.
  * **Tokens:** El servidor solicita el token en memoria, lo renueva automáticamente 60 segundos antes de expirar y jamás lo expone al navegador.
* **Consultas de Catálogo:**
  * **Endpoint:** `https://api.igdb.com/v4/games`
  * **Sintaxis:** Lenguaje de consulta nativo de IGDB (Apicalypse) en formato `text/plain`.
  * **Optimización y Límites:**
    * **Rate Limiting:** Máximo 4 peticiones por segundo controladas atómicamente por la base de datos (`claim_igdb_request`).
    * **Caché de Metadatos:** Los juegos consultados se almacenan en la tabla `public.games` con una vida útil de 24 horas (`cached_at`).
    * **Fallback:** Si IGDB no responde o alcanza su cuota, el sistema utiliza de forma transparente el catálogo local ya almacenado en PostgreSQL.
  * **Portadas:** Construcción de URLs en formato `https://images.igdb.com/igdb/image/upload/t_cover_big/{image_id}.jpg`.

---

### 3.2. Valve Steam Web API
* **Función:** Sincronizar automáticamente la biblioteca de juegos de PC del usuario, sus horas reales de juego y su identidad en Steam.
* **Autenticación:**
  * **Variable:** `STEAM_API_KEY` (clave privada registrada en Steam Developer Portal).
  * **Base URL:** `https://api.steampowered.com/`
* **Endpoints Utilizados:**
  1. `ISteamUser/ResolveVanityURL/v0001/`: Resuelve URLs personalizadas (ej: `steamcommunity.com/id/tunombre`) al formato numérico de 64 bits (`SteamID64`).
  2. `IPlayerService/GetOwnedGames/v0001/`:
     * Parámetros: `steamid`, `include_appinfo=1`, `include_played_free_games=1`.
     * Retorna: Listado completo de juegos del usuario, identificadores `appid`, nombres oficiales, iconos y minutos totales jugados (`playtime_forever`).
  3. `ISteamUser/GetPlayerSummaries/v0002/`: Obtiene el nombre de jugador de Steam, avatar y estado del perfil.
* **Seguridad Criptográfica:**
  * Las vistas previas de importación de Steam se firman en el servidor utilizando **HMAC-SHA256** con la clave `SUPABASE_SERVICE_ROLE_KEY` (`savestate.steam.v1:...`), impidiendo que el cliente manipule las horas de juego o los IDs antes de importarlos.

---

### 3.3. Sony PlayStation Network (PSN)
* **Función:** Extraer y sincronizar automáticamente el historial de juegos jugados, plataformas (`PS5`, `PS4`, `PS3`, `PS Vita`, `PSP`), trofeos obtenidos y platinos completados directamente mediante el **PSN Online ID** público del jugador (ej: `Cristian131x`).
* **Autenticación y Dependencia:**
  * **Librería:** `psn-api` (zero-dependency, compatible con Node.js 24).
  * **Secreto de Servidor:** Variable `PSN_NPSSO` (cookie de sesión SSO de Sony de 64 caracteres).
* **Flujo de Peticiones:**
  1. `exchangeNpssoForAccessCode(process.env.PSN_NPSSO)`: Canjea la cookie por un código de acceso temporal.
  2. `exchangeAccessCodeForAuthTokens(accessCode)`: Obtiene el token de autenticación JWT de Sony.
  3. `makeUniversalSearch(auth, onlineId, 'SocialAllAccounts')`: Resuelve el PSN ID al identificador interno numérico `accountId`.
  4. `getUserTitles(auth, accountId, { limit: 100, offset: 0 })`: Obtiene la colección paginada de juegos, plataformas nativas y progreso de trofeos.
* **Mapeo a Savestate:**
  * Si el juego tiene el trofeo de Platino (`earnedTrophies.platinum > 0`) o progreso 100%, se registra como `cleared` / `platinum`. De lo contrario, queda en `playing`.

---

### 3.4. Microsoft Xbox Live (OpenXBL)
* **Función:** Sincronizar automáticamente el catálogo de títulos jugados, Gamerscore, logros y plataformas (`Xbox Series X|S`, `Xbox One`, `Xbox 360`, `PC`) ingresando el **Xbox Gamertag** público (ej: `ilhamelin`).
* **Autenticación:**
  * **Proveedor:** OpenXBL (`https://xbl.io/`).
  * **Variable:** `XBL_API_KEY` enviada en el encabezado `X-Authorization`.
  * **Encabezados Requeridos:** `Accept: application/json` y `Accept-Language: en-US`.
* **Endpoints Utilizados:**
  1. `GET https://api.xbl.io/v2/friends/search?gt={gamertag}`:
     * Busca el Gamertag en el directorio de Xbox.
     * Extrae el identificador único del jugador (`xuid`) desde el objeto `profileUsers`.
  2. `GET https://api.xbl.io/v2/achievements/player/{xuid}`:
     * Obtiene el listado completo de títulos jugados con su puntuación de logros (`currentGamerscore` vs `totalGamerscore`) y dispositivos asociados (`devices`).
* **Mapeo a Savestate:**
  * Si `currentGamerscore >= totalGamerscore` y el juego está completado, se cataloga automáticamente con estado `cleared`.

---

## 4. Endpoints y Rutas de API Internas (`/api/*`)

Savestate expone endpoints de servidor estructurados bajo Next.js App Router para conectar la interfaz con los servicios de backend:

| Ruta | Método | Propósito | Seguridad / Control |
|---|---|---|---|
| `/api/catalogue` | `GET` | Busca juegos en tiempo real contra IGDB y el catálogo local. | Rate-limit atómico y sanitización de query. |
| `/api/steam/sync` | `POST` | Dispara la sincronización rápida del perfil de Steam conectado. | Sesión activa del usuario; actualiza horas y partidas. |
| `/api/steam/import` | `POST` | Previsualiza e importa en lote la colección completa de Steam. | Validación HMAC-SHA256 contra adulteración. |
| `/api/consoles/import` | `POST` | Ejecuta acciones de consolas: `sync` (PSN/Xbox), `match` (IGDB), `commit` y guardado de ID. | Control de errores 404, 502 y 503 upstream. |
| `/api/favorites` | `POST` | Asigna o reordena los juegos en las 4 ranuras del Top 4 del perfil. | Valida máximo 4 ranuras y pertenencia del juego. |
| `/api/highlights` | `POST` | Publica momentos, capturas de pantalla y notas en el Feed. | Validación de URLs de imagen y longitud de texto. |
| `/api/forum` | `POST` | Crea temas de debate, respuestas y reacciones en los foros. | Sanitización Markdown y protección contra spam. |
| `/api/arcade` | `POST` | Registra votos en duelos de juegos y desafíos de la comunidad. | Un voto por usuario por duelo activo. |
| `/api/notifications` | `GET` / `POST` | Consulta notificaciones pendientes y las marca como leídas. | Filtrado estricto por `user_id = auth.uid()`. |
| `/api/[resource]` | `GET` / `POST` | Endpoint genérico para colecciones de usuario bajo RLS. | Supabase SSR Client con validación de sesión. |

---

## 5. Arquitectura de Servicios de Dominio (`src/services/*`)

El código de negocio está encapsulado en servicios modulares que separan la lógica de datos de la interfaz gráfica:

1. **`progression.ts` (Sistema de Niveles & XP):**
   * Gestiona el otorgamiento de experiencia mediante el RPC `award_xp`.
   * Dispara recompensas por terminar juegos (+150 XP), platinos (+300 XP), sesiones (+10 XP), reseñas (+75 XP) y momentos (+40 XP).
   * Controla los desbloqueos de títulos y marcos de avatar según el nivel alcanzado (Niveles 1 al 50).
2. **`console-import.ts`:**
   * Coordina la ingesta de PlayStation y Xbox: obtención de datos desde upstream, búsqueda de coincidencias en IGDB y persistencia atómica en `user_games` y `play_logs`.
3. **`steam-sync.ts` & `steam.ts`:**
   * Gestiona la vinculación de cuentas de Steam, resolución de nombres de usuario y actualización periódica de horas jugadas.
4. **`badges.ts`:**
   * Consulta el catálogo de medallas retro (`badges`) y verifica qué insignias ha desbloqueado el jugador en `user_badges`.
5. **`forum.ts` & `forum-markdown.ts`:**
   * Administra categorías, hilos y respuestas de la comunidad, procesando el formato Markdown de forma segura.
6. **`highlights.ts`:**
   * Gestiona la creación de momentos de juego con capturas, texto y sistema de reacciones retro (`critical_hit`, `gg`, `game_over`).
7. **`wrapped.ts`:**
   * Genera el resumen anual / histórico de estadísticas del jugador (SaveState Wrapped) con gráficos de géneros, horas y títulos más jugados.
8. **`arcade.ts`:**
   * Administra duelos entre dos juegos, cálculo de porcentajes de votos y solicitudes de compañeros de juego (LFG / Party Requests).

---

## 6. Librerías de Interfaz, Audio y Seguridad

| Librería / Módulo | Propósito en Savestate | Características Técnicas |
|---|---|---|
| **`zzfx` (ZzFX Micro Sound)** | Efectos de sonido retro procedurales | Generador de audio de 8 bits usando **Web Audio API**. Genera sonidos nostálgicos (Level Up, clicks, errores) en milisegundos sin descargar archivos `.mp3` o `.wav`. |
| **`canvas-confetti`** | Animación visual de celebración | Efectos de confeti pixelado en pantalla completa al registrar un juego platinado, ganar un duelo o subir de nivel. |
| **`cmdk`** | Paleta de comandos retro flotante | Barra de búsqueda rápida invocable con `Ctrl + K` / `Cmd + K` para navegar instantáneamente por la biblioteca, explorar o buscar usuarios. |
| **`marked`** | Procesador de Markdown | Compila reseñas y publicaciones en formato Markdown rico (negritas, listas, citas, código). |
| **`isomorphic-dompurify`** | Sanitizador de seguridad HTML | Limpia el HTML resultante de Markdown para neutralizar cualquier intento de inyección de código malicioso (**Cross-Site Scripting / XSS**). |
| **`lucide-react`** | Iconografía SVG | Conjunto de iconos vectoriales ligeros y optimizados para la interfaz. |
| **`@tailwindcss/postcss`** | Motor de estilos visuales | Sistema de diseño retro-neón con soporte de temas CRT, terminal de comandos, paletas de color y fuentes monospace. |

---

## 7. Guía de Variables de Entorno (`.env.local`)

Para que todas las APIs y servicios funcionen en local o en Vercel, este es el resumen de las variables configurables:

```env
# ==========================================
# 1. SUPABASE (Base de Datos, Auth y Storage)
# ==========================================
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_clave_publica_anon
SUPABASE_SERVICE_ROLE_KEY=tu_clave_privada_service_role

# ==========================================
# 2. TWITCH / IGDB (Catálogo Maestro de Juegos)
# ==========================================
# Obtenidas en: https://dev.twitch.tv/console/apps
TWITCH_CLIENT_ID=tu_twitch_client_id
TWITCH_CLIENT_SECRET=tu_twitch_client_secret

# ==========================================
# 3. STEAM (Importación y Sincronización PC)
# ==========================================
# Obtenida en: https://steamcommunity.com/dev/apikey
STEAM_API_KEY=tu_steam_api_key

# ==========================================
# 4. CONSOLAS (PlayStation Network & Xbox Live)
# ==========================================
# Sony NPSSO (obtenida tras iniciar sesión en ca.account.sony.com/api/v1/ssocookie):
PSN_NPSSO=tu_cookie_npsso_de_64_caracteres

# OpenXBL API Key (obtenida en https://xbl.io/):
XBL_API_KEY=tu_openxbl_api_key

# ==========================================
# 5. APLICACIÓN Y TESTS
# ==========================================
NEXT_PUBLIC_APP_URL=http://localhost:3000
TEST_DATABASE_URL= # Opcional: solo para tests de integración SQL aislados
```

---

## 8. Conclusión

El ecosistema de **Savestate** combina:
1. **Un backend serverless y reactivo en Supabase** con seguridad estricta basada en RLS.
2. **Las 4 grandes redes del videojuego moderno unificadas:**
   * **PC:** Valve Steam Web API.
   * **PlayStation:** Sony PSN API con soporte PS5 a PSP.
   * **Xbox:** OpenXBL con soporte Series X a 360.
   * **Catálogo Global:** Twitch / IGDB con más de 300.000 títulos y caché local.
3. **Mecanismos defensivos integrados:** Control de concurrencia atómico, HMAC-SHA256 contra manipulación de datos, sanitización XSS con DOMPurify y cuotas diarias contra bots o spam.
