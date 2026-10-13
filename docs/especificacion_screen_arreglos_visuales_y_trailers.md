# Especificación Técnica: Arreglos Visuales del Grid, Tráiler Oficial en 1 Clic y Plataformas "¿Dónde Ver?" en Screen (`/screen`)

## 1. Resumen y Objetivos
Optimizar la interfaz y las capacidades multimedia de la vista **Screen** (`/screen` — bitácora de cine, series y adaptaciones gamer):
1. **Corrección del Descuadre Visual del Grid y del Drawer Lateral**:
   - Ajustar `.screen-layout` y `.screen-media-grid` de forma fluida (`repeat(auto-fill, minmax(180px, 1fr))`) para que los pósteres no se aprieten contra el drawer lateral (`TELEMETRÍA // MOVIE`) ni corten tarjetas en 4 columnas forzadas.
   - Corregir el contenedor `.screen-drawer` (altura `calc(100vh - 140px)`, scroll suave `scrollbar-gutter: stable` y padding inferior) para que el banner, título, sinopsis y checklists de episodios no se corten.
   - Alinear verticalmente la barra de búsqueda y el selector de región JustWatch (`align-items: end`), igualando alturas (42px) y estilos.
   - Corregir cualquier desborde o solapamiento en el navbar entre `Screen` y `Biblioteca`.
2. **Tráiler Oficial en 1 Clic (YouTube Modal)**:
   - Extraer el tráiler oficial (`trailerVideoId: string | null`) desde TMDB (`append_to_response: 'credits,watch/providers,videos'`).
   - Botón interactivo **`▶ Ver Tráiler`** en el Hero Radar y en la ficha de Telemetría.
   - Reproductor modal centrado con `<iframe>` de YouTube (`https://www.youtube-nocookie.com/embed/{trailerVideoId}?autoplay=1`).
3. **Logos Interactivos de Plataformas "¿Dónde Ver?" (JustWatch)**:
   - Rediseñar la sección `Dónde ver hoy` en `ScreenTelemetryDrawer`:
     - Mostrar los **logos oficiales a color** (`https://image.tmdb.org/t/p/original/...`) de cada plataforma (Netflix, Prime Video, Max, Disney+, Apple TV+, Crunchyroll, etc.) agrupados por tipo:
       - `Suscripción` (Flatrate)
       - `Alquiler / Compra`
     - Chips interactivos con efecto hover y enlace directo a la plataforma en JustWatch.

---

## 2. Dominio y Servicios Backend (`src/domain/screen.ts` y `src/services/screen.ts`)

### 2.1. Ampliación del Modelo de Dominio (`src/domain/screen.ts`)
1. Añadir `trailerVideoId: string | null` a:
   - `ScreenMediaItem`: `trailerVideoId?: string | null`
   - `ScreenDetail`: `trailerVideoId: string | null`
2. Helper puro `extractTmdbTrailerId(videosRaw: unknown): string | null`:
   - Busca en `results` el primer video con:
     - `site === 'YouTube'` y `type === 'Trailer'` (priorizando idioma español o inglés).
     - Si no hay 'Trailer', acepta 'Teaser'.
     - Devuelve la clave `key` (11 caracteres alfanuméricos) o `null`.

### 2.2. Obtención de Tráilers desde TMDB (`src/services/screen.ts`)
1. En `getScreenMediaDetail(tmdbId, mediaType, region, season)`:
   - Cambiar:
     `append_to_response: 'credits,watch/providers'`
     a:
     `append_to_response: 'credits,watch/providers,videos'`
   - Extraer `trailerVideoId = extractTmdbTrailerId(raw.videos)`.
2. En `getRadarFeaturedMedia(region)`:
   - Asegurarse de que los títulos destacados del radar incluyan su `trailerVideoId` correspondiente (por ejemplo en el fallback de *Fallout*, incluir el tráiler oficial `0kAAqslOS64` o resolverlo mediante TMDB).

---

## 3. Estilos y Correcciones Visuales (`src/app/screen.css`)

### 3.1. Reorganización Fluida del Grid y Drawer (`.screen-layout` y `.screen-media-grid`)
```css
/* Layout adaptativo: catálogo a la izquierda, drawer de telemetría a la derecha */
.screen-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 380px;
  gap: 1.5rem;
  align-items: start;
}

/* Grid fluido de pósteres: se ajusta a 3 columnas cuando el drawer está abierto, o 4-5 sin drawer */
.screen-media-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 1rem;
}

/* Drawer lateral con scroll suave sin cortes */
.screen-drawer-column {
  position: sticky;
  top: 130px;
  min-width: 0;
}

.screen-drawer {
  max-height: calc(100vh - 150px);
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--screen-cyan) #0b1018;
  scrollbar-gutter: stable;
  padding: 1rem 1rem 2rem;
  border: 1px solid rgba(0, 240, 255, 0.35);
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.6);
  border-radius: 6px;
}

.screen-drawer-art {
  margin: 0.5rem -1rem 0.8rem;
  overflow: hidden;
  border-radius: 4px;
}

.screen-drawer-art img {
  width: 100%;
  height: auto;
  aspect-ratio: 16 / 9;
  max-height: 190px;
  object-fit: cover;
  display: block;
}
```

### 3.2. Alineación de la Barra de Búsqueda y Selector de Región (`.screen-search-row`)
```css
.screen-search-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 220px;
  gap: 1rem;
  align-items: end;
}

.screen-search-row input,
.screen-search-row select {
  height: 42px;
  padding: 0 13px;
  background: #090e15;
  border: 1px solid #2e3e4f;
  color: #f2f4f8;
  border-radius: 4px;
  font-family: inherit;
  font-size: 0.85rem;
}

.screen-search-row input:focus,
.screen-search-row select:focus {
  border-color: var(--screen-cyan);
  outline: 0;
  box-shadow: 0 0 12px rgba(0, 240, 255, 0.25);
}
```

### 3.3. Plataformas "¿Dónde Ver?" con Chips y Logos Interactivos
```css
.screen-providers-group {
  margin: 0.8rem 0;
}

.screen-providers-group h4 {
  font-size: 0.75rem;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0.4rem 0;
}

.screen-providers-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.screen-provider-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.35rem 0.65rem;
  background: #0f1722;
  border: 1px solid #2d3b4b;
  border-radius: 4px;
  font-size: 0.78rem;
  color: #e2e8f0;
  transition: border-color 0.15s, transform 0.15s;
}

.screen-provider-chip:hover {
  border-color: var(--screen-cyan);
  transform: translateY(-1px);
  color: #fff;
}

.screen-provider-chip img {
  width: 22px;
  height: 22px;
  border-radius: 3px;
  object-fit: cover;
}
```

---

## 4. Componentes Frontend (`src/components/screen/`)

1. **Modal de Tráiler Embebido (`src/components/screen/screen-trailer-modal.tsx`)**:
   - Componente dialog centrado (`position: fixed; inset: 0; margin: auto;`) que recibe `videoId: string` y `onClose: () => void`.
   - Renderiza el reproductor `16:9` de YouTube (`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`) con botón de cerrar `✕` y cierre al presionar `Escape` o hacer clic en el backdrop.
2. **Integración en `ScreenHeroRadar` (`src/components/screen/screen-hero-radar.tsx`)**:
   - En la botonera de acciones del título activo (junto a `+ Registrar progreso` y el botón del juego base), añadir el botón:
     `{current.trailerVideoId && <button type="button" className="button outline" onClick={() => setTrailerId(current.trailerVideoId)}>▶ Ver Tráiler</button>}`
3. **Integración en `ScreenTelemetryDrawer` (`src/components/screen/screen-telemetry-drawer.tsx`)**:
   - En el encabezado sobre el backdrop o junto al título, añadir el botón `▶ Tráiler` si `detail.trailerVideoId` existe.
   - Rediseñar la sección `Dónde ver hoy` usando `<div className="screen-providers-chips">` con los logos oficiales a color y enlaces directos de JustWatch.
