# Documentación Integral y Completa
## Proyecto: **SaveState** (Tracker & Social Cataloging Network Gamer)

---

# 1. Definición de la Idea del Proyecto

> **Slogan:** *El diario de abordo cyberpunk para tu odisea gamer.*

Una plataforma social de catalogación y seguimiento de videojuegos (desde clásicos de 8-bits de los 80 hasta lanzamientos AAA modernos), envuelta en una interfaz web inspirada en terminales cyberpunk y estética **pixel art retro-futurista**.

### Identidad Visual y Estilo
* **Fondo oscuro profundo:** Tonos azulados y negros de terminal (`#08090C`, `#111319`) con acentos neón: verde fósforo, cian eléctrico y magenta synthwave.
* **Tipografías retro:** Fuentes pixeladas legibles para títulos e interfaces (*Silkscreen*) combinadas con fuentes monoespaciadas limpias (*JetBrains Mono*) para lecturas largas de reseñas.
* **Elementos de interfaz (HUD):** Bordes con esquinas recortadas tipo "HUD de nave/mecha", botones pixelados y efectos sutiles configurables (efecto monitor CRT, scanlines y animaciones al guardar).
* **Personalización del Perfil:** Avatares pixel art modulares o subida propia, banners temáticos, "badges" desbloqueables y temas de color personalizados.

### Módulos Principales
* **Catálogo y Búsqueda:** Motor global indexando consolas retro y actuales vía IGDB API. Fichas de juego estilo terminal con metadatos y notas comunitarias.
* **Sistema de Tracking & Logbook:** 6 estados de biblioteca (`Playing`, `Backlog`, `Cleared`, `100% / Platinum`, `Dropped`, `Wishlist`), registro de plataforma jugada, horas y fechas.
* **Reseñas y Críticas:** Puntuación cuantitativa (1-10 o disquetes/estrellas), editor Markdown, alerta obligatoria de spoilers con filtro de desenfoque y reacciones (*Critical Hit*, *GG*).
* **Red Social y Comunidad:** Feed de actividad en tiempo real, listas compartibles, perfil con Top 4 favoritos, enlaces a redes externas y amigos.

---

# 2. Especificación de Requerimientos de Software (SRS)

### Actores del Sistema
* **Invitado (Guest):** Explora catálogo, lee reseñas y perfiles públicos.
* **Jugador (Player):** Autenticado, gestiona biblioteca, reseña, personaliza perfil e interactúa socialmente.
* **Moderador / Administrador:** Modera reportes, spoilers y contenido indebido.

### Requerimientos Funcionales (RF Clave)
* **RF-01 a 04:** Registro/login (email y OAuth), recuperación de contraseña y privacidad de perfil.
* **RF-05 a 09:** Búsqueda en tiempo real con filtros avanzados (consola, género, año), fichas técnicas detalladas y registro manual de títulos/hacks.
* **RF-10 a 14:** Gestión de 6 estados de juego, registro de plataforma jugada y horas, Top 4 favoritos fijados y listas temáticas.
* **RF-15 a 19:** Puntuación con disquetes, reseñas Markdown, control estricto de spoilers y reacciones comunitarias.
* **RF-20 a 25:** Perfil altamente personalizable (avatar pixel art, banner, tema neón, terminal bash y estadísticas de biblioteca).
* **RF-26 a 29:** Seguimiento y amigos, feed de actividad en tiempo real, buscador de jugadores y notificaciones internas.

### Requerimientos No Funcionales (RNF Clave)
* **RNF-01 (UI/UX):** Estética temática Pixel Art / Cyberpunk accesible y legible.
* **RNF-02 (Rendimiento):** Búsquedas y fichas en menos de 1.5 segundos.
* **RNF-03 (Seguridad):** Sanitización estricta de Markdown (DOMPurify) contra XSS y sesiones seguras.
* **RNF-04 (Responsividad):** Adaptabilidad total a móviles y pantallas táctiles.
* **RNF-05 (Accesibilidad):** Cumplimiento WCAG AA y opción de desactivar efectos CRT/scanlines.

---

# 3. Arquitectura del Sistema y Modelo de Datos

### Topología
Arquitectura **Fullstack Serverless / Híbrida** con Next.js (App Router, Server Components y Edge Routes) junto con **Supabase (PostgreSQL 16)** para autenticación, persistencia y WebSockets en tiempo real. Proxy interno para consultas a IGDB API.

### Modelo Entidad-Relación (ERD)
* `USERS` (id, username, email, avatar_url, banner_url, theme_color, terminal_status, social_links, is_private)
* `GAMES` (id, igdb_id, title, slug, cover_url, release_year, platforms, genres, developer, synopsis, cached_at)
* `USER_GAMES` (id, user_id, game_id, status, platform_played, rating, hours_played, start_date, finish_date, is_favorite)
* `REVIEWS` (id, user_id, game_id, rating, content, has_spoilers, created_at)
* `REVIEW_REACTIONS` (id, review_id, user_id, reaction_type)
* `USER_LISTS` (id, user_id, title, description, is_private) & `LIST_ITEMS` (id, list_id, game_id, position_index, note)
* `FRIENDSHIPS` (id, sender_id, receiver_id, status)
* `ACTIVITY_LOGS` (id, user_id, event_type, target_game_id, event_data)

---

# 4. Stack Tecnológico y Configuración

* **Frontend:** Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS v4, Lucide React, canvas-confetti.
* **Tipografías:** `Silkscreen` (títulos pixelados) y `JetBrains Mono` (lectura).
* **Backend & Base de Datos:** Supabase (PostgreSQL 16, RLS, GoTrue Auth, Realtime WebSockets, Storage).
* **Gaming API:** Twitch Developer / IGDB API v4.
* **Seguridad:** `isomorphic-dompurify` para desinfección de Markdown.

---

# 5. Diseño de Interfaz (UI/UX) y Wireframes

* **Tokens Neón:** `void-950` (`#08090C`), `neon-cyan` (`#00F0FF`), `acid-green` (`#00FF66`), `synth-pink` (`#FF0055`), `retro-amber` (`#FFB800`).
* **Bordes Pixelados:** Sombras CSS escalonadas sin desenfoque (`box-shadow: 0 -3px 0 0 ...`).
* **Wireframes Diseñados:** Barra de navegación HUD global, tarjeta de juego con portada y badges, perfil gamer con Top 4 favoritos y terminal bash editable, ficha técnica con spoiler-protector interactivo.

---

# 6. Plan de Gestión y Matriz de Riesgos

* **R-01 (Rate Limit / Caída de IGDB):** Ingesta perezosa en PostgreSQL local y caché en Edge de 24h. Modo offline de contingencia con catálogo local.
* **R-02 (XSS en Reseñas):** Doble sanitización estricta con DOMPurify y CSP.
* **R-03 (Fatiga Visual):** Jerarquía tipográfica dividida (solo títulos en pixel font) y conmutador para desactivar efectos CRT.
* **R-04 (Almacenamiento de Medios):** Galería de avatares predefinidos y compresión WebP en cliente (máx. 500 KB).
* **R-05 (Spoilers Masivos):** Desenfoque obligatorio por defecto (*blur reveal*) y botón de reporte preventivo.

---

# 7. Roadmap del Proyecto por Hitos

* **Hito 0: Fundaciones & Design System:** Tokens Tailwind v4, tipografías, primitivos HUD y conmutador CRT.
* **Hito 1 (MVP-A): Catálogo y Búsqueda:** Proxy IGDB, buscador global con `Ctrl + K`, filtros y fichas de juegos con caché.
* **Hito 2 (MVP-B): Autenticación y Tracking:** Supabase Auth, gestión de los 6 estados de biblioteca, registro de plataforma y horas.
* **Hito 3: Reseñas, Puntuación y Spoilers:** Editor Markdown, calificación gráfica, spoiler blur y reacciones.
* **Hito 4: Perfil Gamer Cyberpunk:** Top 4 juegos fijados, personalización de temas neón, terminal bash y estadísticas.
* **Hito 5: Red Social y Feed:** Seguimiento y amigos, feed de actividad en tiempo real y listas comunitarias.
* **Hito 6: Optimización y Lanzamiento:** Auditorías Lighthouse (>90), compresión WebP y despliegue en producción.
