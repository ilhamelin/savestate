# Especificación Técnica: Rediseño Visual y de Telemetría del Hero Radar en Screen (`/screen`)

## 1. Resumen y Objetivos

Alinear visual y funcionalmente el componente **Hero Radar** (`ScreenHeroRadar`) de la bitácora Screen (`/screen`) con el prototipo de alta fidelidad provisto por el usuario:

1. **Header Superior y Control de Carrusel Unificado**:
   - **Izquierda**: Indicador de emisión: `🔵 RADAR // TRANSMISIÓN DESTACADA | SLOT 01/05`.
   - **Derecha**: Controles del carrusel: `CAROUSEL < [══ . . . ] >` con flechas y barra de pastilla activa con dots para navegación fluida.
2. **Badges de Rango y Estado de Emisión**:
   - Badge 1: `✪ [ADAPTACIÓN GAMER // VALORADA #1]` (o ranking según el slot).
   - Badge 2: `🟢 TEMPORADA FINAL AL AIRE` o `🟢 EN EMISIÓN` / `🟢 DISPONIBLE COMPLETA` con dot verde pulsante.
3. **Título Principal y Subtítulo de Temporada**:
   - Título grande y audaz (`Arcane: League of Legends`, `The Last of Us`, etc.).
   - Subtítulo temático en cian neón: `Temporada 2 · El Clímax de Piltover y Zaun` (o subtítulo de arco narrativo de la adaptación).
4. **Tira de Metadatos Enriquecida**:
   - `⭐ 9.0/10 (48.2k votos)` (estrella y puntuación en dorado neón, conteo de votos en paréntesis).
   - `| 2024` (año de lanzamiento).
   - `| [ TV-16 ]` o `[ TV-MA ]` (caja con la clasificación de edad).
   - `| Riot Games / Fortiche` (estudios y creadores).
5. **Chips de Plataformas Streaming (JustWatch)**:
   - Badges estilizados de plataformas disponibles: `[ NETFLIX 4K ]`, `[ MAX ]`, `[ PRIME VIDEO ]`.
6. **Barra de Progreso y Telemetría del Usuario**:
   - Izquierda: `▶ TU PROGRESO DE TRANSMISIÓN`.
   - Derecha: `Episodio 6 / 9 (66% completado)` (o `Sin checkpoint // 0%`).
   - Barra con gradiente cian a verde esmeralda (`#00f0ff` -> `#00ff66`) y resplandor neón.
7. **Botonera de Acciones de Alta Fidelidad**:
   - `⊕ [+ REGISTRAR PROGRESO]`: Botón sólido en cian eléctrico (`#00f0ff`) con texto oscuro y resplandor (`box-shadow: 0 0 20px rgba(0, 240, 255, 0.45)`).
   - `[▶ Ver Tráiler]`: Botón outline con reproductor modal en YouTube.
   - `🎮 [Ficha de Juego: League of Legends] →`: Botón hacia la ficha del videojuego con icono `Gamepad2` y flecha.
8. **Footer del Hero: Cola de Radar y Calibración**:
   - Izquierda:
     - `COLA DE RADAR:` seguido de botones clicables para cada slot:
       `[ 01 Arcane T2 🔵 ]` (activo), `02 The Last of Us T2`, `03 Fallout`, `04 Castlevania: Nocturne`, `05 Super Mario Bros.`.
   - Derecha:
     - `⚙ CALIBRACIÓN: LATAM-SUR // JUSTWATCH API` (o según la región seleccionada).

---

## 2. Modelo y Metadatos en `src/domain/game-adaptations.ts`

Se amplía la matriz `GAME_ADAPTATIONS_MATRIX` para proveer los metadatos necesarios si no están cargados desde TMDB o en modo demo/offline:

```ts
export interface GameAdaptationLink {
  tmdbId: number;
  mediaType: 'tv' | 'movie';
  title: string;
  gameSlug: string;
  gameTitle: string;
  developerOrPublisher: string;
  featuredOrder?: number;
  // Campos del prototipo:
  subtitle?: string;
  rankBadge?: string;
  statusBadge?: string;
  certification?: string;
  shortTitle?: string;
  streamingBadges?: string[];
}
```

Valores preconfigurados:
- **Arcane**:
  - `shortTitle`: `'Arcane T2'`
  - `subtitle`: `'Temporada 2 · El Clímax de Piltover y Zaun'`
  - `rankBadge`: `'[ADAPTACIÓN GAMER // VALORADA #1]'`
  - `statusBadge`: `'TEMPORADA FINAL AL AIRE'`
  - `certification`: `'TV-16'`
  - `streamingBadges`: `['NETFLIX 4K', 'MAX']`
- **The Last of Us**:
  - `shortTitle`: `'The Last of Us T2'`
  - `subtitle`: `'Temporada 2 · El Precio de la Venganza'`
  - `rankBadge`: `'[ADAPTACIÓN GAMER // DESTACADA #2]'`
  - `statusBadge`: `'PRÓXIMAMENTE EN STREAMING'`
  - `certification`: `'TV-MA'`
  - `streamingBadges`: `['MAX 4K']`
- **Fallout**:
  - `shortTitle`: `'Fallout'`
  - `subtitle`: `'Temporada 1 · Bienvenidos al Yermo'`
  - `rankBadge`: `'[ADAPTACIÓN GAMER // DESTACADA #3]'`
  - `statusBadge`: `'TEMPORADA 2 EN PRODUCCIÓN'`
  - `certification`: `'TV-MA'`
  - `streamingBadges`: `['PRIME VIDEO']`
- **Castlevania: Nocturne**:
  - `shortTitle`: `'Castlevania: Nocturne'`
  - `subtitle`: `'Temporada 2 · La Revolución de Richter'`
  - `rankBadge`: `'[ADAPTACIÓN GAMER // DESTACADA #4]'`
  - `statusBadge`: `'EN EMISIÓN'`
  - `certification`: `'TV-MA'`
  - `streamingBadges`: `['NETFLIX']`
- **Super Mario Bros.**:
  - `shortTitle`: `'Super Mario Bros.'`
  - `subtitle`: `'Película Oficial · Reino Champiñón'`
  - `rankBadge`: `'[ADAPTACIÓN GAMER // TAQUILLA #1]'`
  - `statusBadge`: `'DISPONIBLE EN STREAMING'`
  - `certification`: `'PG'`
  - `streamingBadges`: `['MAX', 'PRIME VIDEO']`

---

## 3. Componente `src/components/screen/screen-hero-radar.tsx`

El componente se reestructura para incluir:
1. Barra superior de navegación y slots:
   - Slot actual `01/05` con dot cian.
   - Indicador de carrusel interactivo `< [══ . . . ] >`.
2. Sección de badges y encabezado.
3. Subtítulo en cian neón.
4. Tira de metadatos con estrella dorada, votos, año, caja de clasificación y estudios.
5. Plataformas de streaming con logos/chips de JustWatch.
6. Barra de progreso con gradiente esmeralda/cian y porcentaje en vivo.
7. Botonera con botón cian sólido resplandeciente (`⊕ [+ REGISTRAR PROGRESO]`), botón de tráiler y botón a la ficha del juego base.
8. Tira inferior con la cola de slots clicables (`COLA DE RADAR`) y la etiqueta de calibración regional.

---

## 4. Estilos Visuales (`src/app/screen.css`)

Se actualizan y perfeccionan los estilos de `.screen-hero`:
- `.screen-hero`: Gradiente ambiental cinematográfico de fondo combinado con el backdrop a media opacidad y viñeta lateral.
- `.screen-hero-top-row`: Header flex en dos extremos (indicador de slot a la izquierda, carrusel a la derecha).
- `.screen-carousel-pill`: Barra de slots activa con resplandor cian.
- `.screen-hero-badges`: Contenedor flex para los badges `#1` y estado de emisión.
- `.screen-hero-subtitle`: Color cian suave, tipografía estilizada.
- `.screen-hero-metadata`: Tira con separadores `|`, estrella en color oro `#f59e0b` y chip de edad `border: 1px solid #3a4d61`.
- `.screen-hero-stream-chips`: Chips de plataformas con colores de marca (Netflix, Max, Prime).
- `.screen-hero-primary-btn`: Fondo `#00f0ff`, color `#06090e`, `font-weight: 700`, sombra `0 0 20px rgba(0, 240, 255, 0.45)`.
- `.screen-hero-footer-row`: Footer con `COLA DE RADAR:` en monospace y pastilla activa para el slot seleccionado.
