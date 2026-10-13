# Especificación Técnica: Módulo Screen // Bitácora de Cine, Series y Adaptaciones Gamer (TMDB)

## 1. Resumen Ejecutivo y Diagnóstico del Diseño Stitch

A partir del diseño generado y exportado por Google Stitch en:
`C:\Users\benja\Downloads\ABDM\Pictures\Instagram_Picture\stitch_savestate_screen_journal\` (`code.html` y `DESIGN.md`), se realizó un análisis exhaustivo para separar los **elementos arquitectónicos y visuales de gran valor** de las **invenciones e inconsistencias** generadas por Stitch que no corresponden al proyecto real de **SaveState**.

### Lo que Stitch inventó / Inconsistencias a descartar:
1. **Header & Navbar ficticio:** Stitch creó un `header` nuevo con enlaces que no existen (ej. *"Compañeros"*), omitió enlaces clave del navbar real (`/rift`, `/worlds`, `/lists`, etc.), agregó métricas simuladas desconectadas (`SYS.ONLINE`, `FPS: 60`, `LATENCY: 12ms`), usó una imagen externa arbitraria de avatar con un badge ficticio `LVL.42` y un logo no estandarizado.  
   **Adaptación real:** SaveState ya cuenta con `Header` (`src/components/header.tsx`) y `HeaderNav` (`src/components/header-nav.tsx`), `CommandMenu` (Ctrl+K) y `NotificationBell`. Solo se añade la ruta `/screen` con etiqueta `"Screen"` e icono de `lucide-react`.
2. **Footer ficticio:** Stitch generó un footer de *"TERMINAL OPERATIONS CORP © 2025"*.  
   **Adaptación real:** SaveState tiene su propio `site-footer` en `src/app/layout.tsx`. Se agrega el enlace a `"Screen"` dentro de la columna *Explorar*.
3. **Iconos de Google Material Symbols:** Stitch inyectó fuentes de Google Fonts y etiquetas `<span class="material-symbols-outlined">...</span>`.  
   **Adaptación real:** Se sustituye 100% por **`lucide-react`** (`Film`, `Tv`, `Star`, `Play`, `Check`, `Bookmark`, `Plus`, `ChevronLeft`, `ChevronRight`, `Gamepad2`, `ExternalLink`, etc.), manteniendo el bundle liviano y consistente.
4. **HTML estático autocontenido vs Arquitectura Next.js App Router:**  
   **Adaptación real:** Se desglosa en componentes modulares React bajo `src/components/screen/` y la página `src/app/screen/page.tsx`, consumiendo la API de TMDB en el servidor y Supabase para el estado de usuario.

### Lo que se rescata y adopta del diseño Stitch:
1. **Estética HUD Cyberpunk Terminal:** Superficies oscuras con scanlines CRT sutiles, micro-borders con acentos cian (`#00F0FF`), ámbar retro (`#FFB000`) y esmeralda (`#00FF66`).
2. **Hero Radar de Adaptaciones Gamer:** Banner cinemático de cabecera con carrusel de adaptaciones clave (*Arcane*, *The Last of Us*, *Fallout*, etc.), telemetría de temporada, barra de progreso personal y botón directo a la ficha del videojuego original.
3. **Barra de Filtros HUD y Búsqueda Terminal:** Pestañas de filtrado (Populares, Adaptaciones, Series, Películas, Estrenos, Mejor valoradas), búsqueda por teclado `>_` y selector de región para JustWatch.
4. **Grilla Asimétrica 8 + 4 (Cards + Sticky Drawer):**
   - **Columna Izquierda (8 cols):** Grilla responsiva de tarjetas con relación 2:3, póster, streaming chips (Netflix, Max, Prime), valoración numérica, barra de progreso y botón rápido `+1 Ep`.
   - **Columna Derecha (4 cols):** Drawer de telemetría detallada del título seleccionado (*Cyberpunk: Edgerunners*), selector de estado (Viendo, Backlog, Completada, Abandonada), sistema de estrellas, **checklist interactivo de episodios por temporada** y sección de streaming *"Dónde ver hoy"* powered by JustWatch.
5. **Bidireccionalidad Game-to-Screen:** Enlace cruzado entre el juego en `/games/[slug]` y su adaptación en `/screen`.

---

## 2. Arquitectura de Datos y Servicios

### 2.1 Proveedor Externo: The Movie Database (TMDB) API v3
- **Endpoints requeridos:**
  - `GET /trending/{media_type}/week?language=es-ES`: Títulos destacados y populares.
  - `GET /search/multi?query={q}&language=es-ES`: Búsqueda unificada de cine y series.
  - `GET /tv/{id}?append_to_response=credits,watch/providers,season/{n}&language=es-ES`: Detalle de series y episodios.
  - `GET /movie/{id}?append_to_response=credits,watch/providers&language=es-ES`: Detalle de largometrajes.
  - Proveedores de Streaming: Mapeados desde la propiedad `watch/providers` (suministrados por JustWatch en TMDB) según el país seleccionado (`CL`, `MX`, `ES`, `US`).
- **Variables de Entorno (`.env.local`):**
  ```env
  TMDB_API_KEY=tu_api_key_de_tmdb
  TMDB_READ_TOKEN=tu_read_access_token # Opcional si se usa Bearer Auth
  NEXT_PUBLIC_JUSTWATCH_DEFAULT_REGION=CL
  ```

### 2.2 Diccionario Curado de Adaptaciones Gamer ("Game-to-Screen Matrix")
Para enriquecer la experiencia y asegurar enlaces cruzados precisos entre TMDB e IGDB/SaveState:
```typescript
export interface GameAdaptationLink {
  tmdbId: number;
  mediaType: 'tv' | 'movie';
  title: string;
  gameSlug: string;       // Slug en SaveState (/games/[slug])
  gameTitle: string;
  developerOrPublisher: string;
  featuredOrder?: number; // Para el carrusel Radar Hero
}

export const GAME_ADAPTATIONS_MATRIX: GameAdaptationLink[] = [
  {
    tmdbId: 94605, // Arcane
    mediaType: 'tv',
    title: 'Arcane: League of Legends',
    gameSlug: 'league-of-legends',
    gameTitle: 'League of Legends',
    developerOrPublisher: 'Riot Games / Fortiche',
    featuredOrder: 1,
  },
  {
    tmdbId: 100088, // The Last of Us
    mediaType: 'tv',
    title: 'The Last of Us',
    gameSlug: 'the-last-of-us-part-i',
    gameTitle: 'The Last of Us',
    developerOrPublisher: 'Naughty Dog / HBO',
    featuredOrder: 2,
  },
  {
    tmdbId: 105248, // Cyberpunk: Edgerunners
    mediaType: 'tv',
    title: 'Cyberpunk: Edgerunners',
    gameSlug: 'cyberpunk-2077',
    gameTitle: 'Cyberpunk 2077',
    developerOrPublisher: 'CD Projekt Red / Studio Trigger',
    featuredOrder: 3,
  },
  {
    tmdbId: 106379, // Fallout
    mediaType: 'tv',
    title: 'Fallout',
    gameSlug: 'fallout-4',
    gameTitle: 'Fallout',
    developerOrPublisher: 'Bethesda / Kilter Films',
    featuredOrder: 4,
  },
  {
    tmdbId: 502356, // The Super Mario Bros. Movie
    mediaType: 'movie',
    title: 'Super Mario Bros. La película',
    gameSlug: 'super-mario-odyssey',
    gameTitle: 'Super Mario',
    developerOrPublisher: 'Nintendo / Illumination',
    featuredOrder: 5,
  },
  {
    tmdbId: 939243, // Sonic 3
    mediaType: 'movie',
    title: 'Sonic 3: La Película',
    gameSlug: 'sonic-frontiers',
    gameTitle: 'Sonic The Hedgehog',
    developerOrPublisher: 'SEGA / Paramount',
  },
  {
    tmdbId: 100883, // Castlevania: Nocturne
    mediaType: 'tv',
    title: 'Castlevania: Nocturne',
    gameSlug: 'castlevania-symphony-of-the-night',
    gameTitle: 'Castlevania',
    developerOrPublisher: 'Konami / Project 51',
  },
  {
    tmdbId: 87108, // Halo
    mediaType: 'tv',
    title: 'Halo: La Serie',
    gameSlug: 'halo-infinite',
    gameTitle: 'Halo',
    developerOrPublisher: '343 Industries / Paramount+',
  },
];
```

### 2.3 Base de Datos Supabase: Migración para Bitácora de Pantalla
```sql
-- Tabla para registrar el progreso y estado de visualización de los usuarios
CREATE TABLE IF NOT EXISTS public.user_screen_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tmdb_id INTEGER NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('tv', 'movie')),
  title TEXT NOT NULL,
  poster_path TEXT,
  backdrop_path TEXT,
  status TEXT NOT NULL DEFAULT 'watching' CHECK (status IN ('watching', 'plan_to_watch', 'completed', 'dropped')),
  rating NUMERIC(3, 1) CHECK (rating >= 0 AND rating <= 10),
  current_season INTEGER DEFAULT 1,
  current_episode INTEGER DEFAULT 0,
  total_episodes INTEGER DEFAULT 0,
  watched_episodes INTEGER[] DEFAULT '{}', -- Array con números de episodios vistos
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(user_id, tmdb_id, media_type)
);

-- RLS Policies
ALTER TABLE public.user_screen_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Los usuarios pueden ver sus propias entradas de pantalla"
  ON public.user_screen_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden insertar sus entradas de pantalla"
  ON public.user_screen_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden actualizar sus entradas de pantalla"
  ON public.user_screen_entries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden eliminar sus entradas de pantalla"
  ON public.user_screen_entries FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_screen_entries_user_status 
  ON public.user_screen_entries(user_id, status);
```

---

## 3. Desglose de Componentes Frontend

### 3.1 Estilos: `src/app/screen.css`
Define las clases HUD y tokens derivados de Tailwind y CSS variables de SaveState:
- `.screen-hud-card`: Contenedor oscuro con backdrop blur y borde sutil `rgba(0, 240, 255, 0.15)`.
- `.screen-hud-glow`: Borde activo y sutil resplandor cian `box-shadow: 0 0 16px -2px rgba(0, 240, 255, 0.25)`.
- `.screen-badge-streaming`: Pills específicos para Netflix, Max, Prime Video, Disney+, Crunchyroll.
- `.screen-scanline`: Overlay opcional con efecto CRT tenue.

### 3.2 Componentes Modulares (`src/components/screen/`):
1. **`screen-hero-radar.tsx`**:
   - Muestra el título destacado principal (ej. *Arcane*).
   - Selector carrusel (01 al 05) en la parte superior e inferior.
   - Barra de telemetría de visualización (`Episodio 6 / 9 - 66% completado`).
   - Botón `[+ Registrar Progreso]` (abre drawer) y enlace directo a la ficha del juego en SaveState (`🎮 Ficha de Juego: League of Legends`).
2. **`screen-filter-bar.tsx`**:
   - Pestañas rápidas: Populares, Adaptaciones Gamer, Series, Películas, Próximos Estrenos, Mejor Calificadas.
   - Input de búsqueda con indicador terminal `>_` y atajo Ctrl+K.
   - Selector de región JustWatch (por defecto Chile 🇨🇱 / soporte para LATAM y Global).
3. **`screen-media-grid.tsx` y `screen-card.tsx`**:
   - Renderiza la grilla de títulos (formato póster 2:3).
   - Chips flotantes: año, plataforma de streaming, nota promedio (TMDB), y chip del juego original (si es adaptación).
   - Barra de progreso del usuario y botón rápido `+1 Ep`.
   - Estado de tarjeta seleccionada (`ring-2 ring-primary-container shadow-[0_0_24px_rgba(0,240,255,0.35)]`).
4. **`screen-telemetry-drawer.tsx`**:
   - Panel lateral sticky (en desktop) o modal drawer (en móvil).
   - Banner de cabecera con backdrop.
   - Sinopsis en español.
   - Selector matricial de estado (Viendo, Por ver / Backlog, Completada, Abandonada).
   - Calificación personal en estrellas interactivas.
   - **Checklist interactivo de episodios:** Lista de episodios con checkbox, tachado y badges (`VISTO`, `▶ SIGUIENTE`, `PENDIENTE`). Al marcar un episodio, actualiza inmediatamente el conteo y persiste en Supabase.
   - Sección *"Dónde ver hoy"* con proveedores de streaming oficiales y enlace JustWatch.
   - Enlace a la IP de videojuego original vinculada en SaveState.

### 3.3 Integración en Navegación y Páginas Existentes:
1. **`src/components/header-nav.tsx`**:
   - Añadir enlace `{ href: '/screen', label: 'Screen', icon: Film }` (o `Tv`).
2. **`src/app/layout.tsx`**:
   - Añadir `<Link href="/screen">Screen (Cine y Series)</Link>` en la sección `Explorar` del footer.
3. **`src/app/games/[slug]/page.tsx`**:
   - Comprobar si el juego tiene adaptación en `GAME_ADAPTATIONS_MATRIX`.
   - Si existe, renderizar un widget HUD: *"Adaptación de Pantalla disponible en Screen // Ver ficha y episodios"*.

---

## 4. Plan de Implementación para Codex (Paso a Paso)

1. **FASE 1: Capa de Dominio y Servicios:**
   - Crear `src/domain/screen.ts` con tipos de datos (`ScreenMediaItem`, `ScreenUserProgress`, `ScreenEpisode`, `WatchProvider`).
   - Crear `src/integrations/tmdb/server.ts` con helpers tipados de TMDB y JustWatch.
   - Crear `src/domain/game-adaptations.ts` con la matriz de adaptaciones gamer y enlaces a IGDB.
2. **FASE 2: Base de Datos y Rutas API:**
   - Crear migración SQL en Supabase para `user_screen_entries`.
   - Crear endpoints `GET /api/screen/popular`, `GET /api/screen/search`, `POST /api/screen/progress` para guardar estado de visualización y episodios.
3. **FASE 3: Componentes de UI (Adaptación Fiel de Stitch):**
   - Crear `src/app/screen.css` con estilos cyberpunk/HUD y scanlines.
   - Construir `ScreenHeroRadar`, `ScreenFilterBar`, `ScreenMediaGrid`, `ScreenCard`, y `ScreenTelemetryDrawer`.
   - Asegurar el uso exclusivo de `lucide-react` para todos los iconos.
4. **FASE 4: Ensamblaje de Ruta y Enlaces Cruzados:**
   - Crear la página principal `src/app/screen/page.tsx`.
   - Integrar `/screen` en `src/components/header-nav.tsx` y en el footer de `src/app/layout.tsx`.
   - Enlazar la ficha de juego `/games/[slug]` con su serie/película correspondiente.
