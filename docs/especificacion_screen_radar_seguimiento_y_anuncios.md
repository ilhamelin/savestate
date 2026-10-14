# Especificación Técnica: Radar de Seguimiento de Capítulos, Cuenta Regresiva y Avisos a Discord en Screen (`/screen`)

## 1. Resumen y Objetivos

A partir del boceto y requerimiento del usuario, se implementa en la vista **Screen** (`/screen`) un sistema de **Seguimiento Activo de Próximos Capítulos y Estrenos** compuesto por:

1. **Botón de Seguimiento en la Ficha de Telemetría ("TELEMETRÍA // TV" y "TELEMETRÍA // MOVIE")**:
   - Ubicado dentro de `ScreenTelemetryDrawer`.
   - Permite al usuario marcar una serie o película para seguimiento (`★ Seguir serie` / `🔔 Seguir estrenos` ↔ `✓ Siguiendo en Radar`).
2. **Nueva Zona Inferior: "Radar de Seguimiento de Próximos Capítulos y Estrenos"**:
   - Ubicada directamente debajo del catálogo principal y sobre la atribución de TMDB / JustWatch.
   - Renderiza tarjetas horizontales para cada título seguido con la distribución solicitada:
     - **Foto**: Póster oficial / still del capítulo.
     - **Temporada y Capítulos**:
       - Temporada actual.
       - Capítulo actual (último visto) — Siguiente capítulo a estrenar/ver.
       - Fecha de salida del siguiente capítulo (o fecha de estreno para películas).
     - **Dónde ver**:
       - Logo oficial de la plataforma de streaming confirmada para la región (Netflix, Prime Video, Disney+, Max, etc. vía JustWatch/TMDB).
     - **Contador regresivo (Countdown Ticker)**:
       - Cuenta regresiva viva en tiempo real (`DDd : HHh : MMm : SSs`) hasta el momento de salida del próximo episodio o estreno de la película.
     - **Campana de Avisos a Discord (`# 📢-anuncios-savestate`)**:
       - Botón con icono de campana `🔔` que publica un anuncio oficial formateado en el canal `#📢-anuncios-savestate` de Discord.

---

## 2. Modelo de Dominio y Extracción de Datos TMDB

### 2.1. Ampliación del Modelo de Dominio (`src/domain/screen.ts`)

```ts
export interface ScreenFollowedMedia {
  tmdbId: number;
  mediaType: ScreenMediaType;
  title: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  currentSeason: number;
  currentEpisodeWatched: number;
  nextEpisodeNumber: number | null;
  nextEpisodeTitle: string | null;
  nextAirDate: string | null; // ISO YYYY-MM-DD
  providers: ScreenProvider[];
  followed: boolean;
  statusText: string;
}
```

### 2.2. Obtención de Datos de Próximos Capítulos desde TMDB
1. En series de televisión (`tv/{id}`):
   - TMDB provee en la respuesta del detalle:
     - `next_episode_to_air`: Objeto con `season_number`, `episode_number`, `name`, `air_date`, `still_path`.
     - `last_episode_to_air`: Objeto con el último capítulo emitido.
     - `status`: Estado de la serie (`Returning Series`, `Ended`, `In Production`).
   - El siguiente capítulo a ver se calcula combinando:
     - El progreso del usuario (último capítulo visto de la temporada).
     - La información de `next_episode_to_air` de TMDB.
2. En películas (`movie/{id}`):
   - `release_date`: Fecha de lanzamiento oficial.
   - `status`: `Post Production`, `Released`, `In Production`.

---

## 3. Arquitectura del Servicio y Persistencia

### 3.1. Persistencia de Seguimiento en `user_screen_entries`
- Se añade la columna `followed boolean not null default false` a `user_screen_entries`.
- En caso de que la columna aún no exista en Supabase, el backend degrada con tolerancia sin interrumpir la experiencia.
- Las consultas `screenEntries()` incluyen el campo `followed`.

### 3.2. Publicación de Avisos a Discord (`# 📢-anuncios-savestate`)
- Se implementa el servicio `announceScreenUpcomingToDiscord({ tmdbId, mediaType, title, nextAirDate, season, episode, providerName, posterUrl })`:
  1. Obtiene el canal autorizado `announcements` mediante `fetchAuthorizedChannels()`.
  2. Construye un Discord Embed estilizado:
     - Título: `📢 PRÓXIMO ESTRENO // SaveState Screen`
     - Campo 1: `Título`: `🍿 [Nombre]`
     - Campo 2: `Episodio / Estreno`: `Temporada [S] · Episodio [E]` o `Estreno en cines`
     - Campo 3: `Fecha de emisión`: `[Fecha]` (con timestamp de Discord `<t:...:R>` para cuenta regresiva nativa de Discord).
     - Campo 4: `Dónde ver`: `[Plataforma]`
     - Thumbnail: Carátula oficial.
     - Enlace al título en SaveState Screen.
  3. Envía el mensaje vía `discordRequest` con nonce de deduplicación.

---

## 4. Diseño de Componentes Frontend

### 4.1. Zona Inferior de Seguimiento (`src/components/screen/screen-watchlist-radar.tsx`)
1. **Contenedor**:
   - Ubicado bajo el layout principal en `ScreenHub`.
   - Encabezado temático con badge cian: `RADAR DE SEGUIMIENTO // PRÓXIMOS CAPÍTULOS Y ESTRENOS`.
2. **Fila de Ficha de Seguimiento**:
   - Layout CSS Grid responsive de 4 columnas principales:
     - `[Foto: 70px x 100px]`
     - `[Información de Temporada / Capítulos / Fecha: minmax(0, 1fr)]`
     - `[Dónde ver: 90px]`
     - `[Cuenta Regresiva & Botón Campana Discord: 220px]`
3. **Contador Regresivo en Vivo (`ScreenCountdown`)**:
   - `useEffect` con `setInterval(1000)` que calcula:
     - Días, Horas, Minutos, Segundos hasta `nextAirDate` a las 00:00 UTC (o medianoche local).
     - Si faltan > 0 segundos: `04d : 12h : 35m : 18s`.
     - Si es el día de emisión: `¡ESTRENO HOY!`.
     - Si la fecha ya pasó: `DISPONIBLE`.
     - Si no hay fecha fijada: `POR ANUNCIAR`.
4. **Botón Campana 🔔**:
   - Dispara llamada a `POST /api/screen/announce`.
   - Estado de envío con spinner y feedback: `✓ Aviso enviado a #📢-anuncios-savestate`.

### 4.2. Integración en `ScreenTelemetryDrawer` (`src/components/screen/screen-telemetry-drawer.tsx`)
- En la cabecera o junto a los botones de acción:
  - Botón interactivo:
    - Estado normal: `<button className="button outline small"><Bell size={14} /> Seguir en Radar</button>`
    - Estado siguiendo: `<button className="button small active"><Check size={14} /> Siguiendo</button>`
  - Al pulsar, guarda `followed: !progress.followed` y actualiza la lista del Radar inferior en tiempo real.

---

## 5. Estilos Visuales (`src/app/screen.css`)

```css
/* Zona del Radar de Seguimiento */
.screen-watchlist-section {
  margin-top: 2.5rem;
  padding-top: 2rem;
  border-top: 1px solid rgba(0, 240, 255, 0.2);
}

.screen-watchlist-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.25rem;
}

.screen-watchlist-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.screen-watchlist-card {
  display: grid;
  grid-template-columns: 80px minmax(0, 1fr) 110px 240px;
  gap: 1.25rem;
  align-items: center;
  background: #090e15;
  border: 1px solid #1a2736;
  border-radius: 6px;
  padding: 0.85rem 1rem;
  transition: border-color 0.15s;
}

.screen-watchlist-card:hover {
  border-color: rgba(0, 240, 255, 0.4);
}

.screen-watchlist-countdown {
  font-family: var(--font-mono, monospace);
  font-weight: 700;
  font-size: 1.05rem;
  color: var(--screen-cyan);
  text-shadow: 0 0 8px rgba(0, 240, 255, 0.4);
}

.screen-discord-bell-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.75rem;
  padding: 0.3rem 0.6rem;
}
```
