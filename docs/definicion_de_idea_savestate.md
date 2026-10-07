# 01. Definición de la Idea del Proyecto

---

# 🎮 Nombre del Proyecto: **SaveState** *(o ByteLog)*

> **Slogan:** *El diario de abordo cyberpunk para tu odisea gamer.*

Una plataforma social de catalogación y seguimiento de videojuegos (desde clásicos de 8-bits de los 80 hasta lanzamientos AAA modernos), envuelta en una interfaz web inspirada en terminales cyberpunk y estética **pixel art retro-futurista**.

---

## 🎨 1. Identidad Visual y Estilo

### Estética Cyberpunk + Pixel Art
* **Fondo oscuro profundo:** Tonos azulados y negros de terminal (`#08090C`, `#111319`) con acentos neón vibrantes: verde fósforo, cian eléctrico y magenta synthwave.
* **Tipografías retro:** Fuentes pixeladas legibles para títulos e interfaces (como *Silkscreen* o *Press Start 2P*) combinadas con fuentes monoespaciadas limpias (como *JetBrains Mono*) para lecturas largas de reseñas y sinopsis.
* **Elementos de interfaz (HUD):** Bordes con esquinas recortadas tipo "HUD de nave/mecha", botones pixelados escalonados y efectos sutiles configurables (efecto monitor CRT, scanlines y pequeñas micro-animaciones al guardar un juego).

### Personalización Extrema del Perfil
* **Avatares pixel art:** Modulares (estilo generador de personajes retro) o subida de imagen propia.
* **Banners animados y insignias:** Banners temáticos y "badges" desbloqueables (ej. *"Maestro de los 16-bits"*, *"Speedrunner Nocturno"*).
* **Marcos de avatar neón:** Marcos con estética neón/cyberpunk y temas de color personalizados para el perfil de cada usuario (Cian, Magenta, Verde Fósforo, Ámbar).

---

## 🕹️ 2. Funcionalidades Principales

### A. Catálogo y Búsqueda de Juegos
* **Motor de búsqueda global:** Juegos clasificados por consolas, épocas (retro y modernos), géneros, desarrolladores y motores de juego.
* **Fichas de juego estilo "Terminal de Datos":**
  * Portada pixelada/original, sinopsis, año y plataformas disponibles.
  * Puntuación comunitaria, tiempo medio de juego y estadísticas de la comunidad.
* **Fuente de datos:** Integración con la API de **IGDB** (gratuita de Twitch, la más completa del mundo con millones de juegos retro y actuales) o **RAWG**.

### B. Sistema de Tracking & Log (Diario de Juego)
* **Estados de biblioteca:**
  * `[Playing]` Jugando actualmente
  * `[Backlog]` Pendiente en la cola
  * `[Cleared]` Completado (con opción de marcar si fue 100% o historia principal)
  * `[Dropped]` Abandonado
  * `[Wishlist]` Lista de deseos
* **Logbook (Registro de partida):**
  * Fecha de inicio y fin.
  * Plataforma en la que lo jugaste (ej. "¿Lo jugaste en SNES original o en emulador?").
  * Horas invertidas y dificultad completada.

### C. Reseñas y Críticas
* **Puntuación cuantitativa:** Sistema de 5 disquetes/estrellas pixeladas o escala 1 a 10 con medios puntos.
* **Editor de reseñas:** Soporte para Markdown (negritas, cursivas, listas, citas).
* **Control de Spoilers:** Alerta de spoilers seleccionable que oculta el texto con un filtro visual hasta que el lector decide revelarlo.
* **Votos de la comunidad:** Reacciones temáticas a reseñas (upvotes tipo *"CRITICAL HIT"*, *"GAME OVER"*, *"GG"*).

### D. Red Social y Comunidad
* **Feed de Transmisión (Activity Feed):** Línea de tiempo donde ves en tiempo real lo que tus amigos acaban de completar, empezar o calificar.
* **Listas personalizadas y compartibles:**
  * Ejemplos: *"Juegos retro que envejecieron como el vino"*, *"Los mejores RPGs de la era PS1"*, *"Juegos Cyberpunk infravalorados"*.
* **Perfil Social:**
  * Tus 4 juegos favoritos fijados arriba (estilo *Letterboxd*).
  * Gráficos estilo radar / estadísticas pixel art: géneros más jugados, consola favorita, total de horas dedicadas.
  * Enlaces a perfiles externos (Steam, Discord, GitHub, Twitch, X/Twitter).
  * Lista de amigos con estado en vivo (*"Jugando actualmente a: Chrono Trigger"*).

---

## 🛠️ 3. Arquitectura Técnica Sugerida

| Componente | Opción Recomendada | Por qué |
| :--- | :--- | :--- |
| **Frontend** | **Next.js (React) o Astro** | Excelente SEO para las fichas de juegos, carga ultra rápida y soporte para componentes interactivos. |
| **Estilos** | **Tailwind CSS + Tokens Pixel UI** | Permite crear componentes pixel art y paletas cyberpunk de forma modular, rápida y responsiva. |
| **Base de Datos & Auth** | **Supabase o Firebase** | Autenticación de usuarios, base de datos en tiempo real (para el feed de amigos) y almacenamiento de imágenes/avatares. |
| **API de Videojuegos** | **IGDB API** | La mejor base de datos gratuita para videojuegos con metadatos completos y portadas en alta calidad. |

---

## 🚀 4. Plan de Acción (Fases de Desarrollo)

* **Fase 1 (MVP - El Núcleo):** Configuración del proyecto web con la estética básica (modo oscuro, fuentes pixel/mono, paleta cyberpunk) y conexión con la API de juegos.
* **Fase 2 (Usuarios y Tracking):** Login/registro de usuarios y guardado de estados de biblioteca en base de datos.
* **Fase 3 (Reseñas y Perfil):** Redacción de reseñas, puntuaciones, spoiler-blur y vista de perfil personal con Top 4 favoritos.
* **Fase 4 (Social):** Sistema de amigos, feed de actividad en tiempo real y personalización visual avanzada.
