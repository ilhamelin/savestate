# SPEC-15: Capturas de Juego In-Game en Explorar (Hover Peek & QuickView Lightbox)

> **Documento:** Especificación Técnica Quirúrgica de Entrega  
> **Rama de Especificación:** `main`  
> **Rama Destino de Implementación:** `implementation/chatgpt` (crear rama `feature/game-screenshots-peek-lightbox`)  
> **Destinatario:** OpenAI Codex / Lead Engineer  
> **Estado:** Listo para Implementación  
> **Prioridad:** Media-Alta (Enriquecimiento visual, descubrimiento inmersivo de catálogo y experiencia de usuario)

---

## 1. Objetivo y Contexto

Actualmente, la sección **Explorar** (`/explore`) muestra las tarjetas de juego (`GameCard`) presentando únicamente la portada vertical (*cover art*), el año de lanzamiento, la valoración y las plataformas disponibles.

Sin embargo, para los jugadores es crucial poder ver el aspecto real de la jugabilidad (*in-game screenshots*) antes de decidir si investigar un juego o agregarlo a su biblioteca. 

El objetivo de **SPEC-15** es enriquecer el catálogo con el sistema híbrido **Hover Peek + QuickView Lightbox**:
1. **Extensión del Catálogo IGDB:** Incorporar el campo `screenshots.image_id` en las consultas del catálogo sin coste de cuota de red adicional, mapeándolos a URLs de alta velocidad en `images.igdb.com`.
2. **Hover Peek en Tarjeta (`GameCard`):** En entornos de escritorio (con cursor), al posar el mouse sobre la tarjeta, la portada se desvanece suavemente (*cross-fade*) para revelar un mini-carrusel con capturas in-game reales y mini-indicadores interactivos.
3. **QuickView Lightbox Modal (`GameScreenshotsModal`):** Un botón accesible con icono de cámara `📸 {N} fotos` permite abrir un visor inmersivo a pantalla completa con navegación por teclado (`←`, `→`, `Escape`), tira de miniaturas en alta resolución (720p/1080p) y enlace a la ficha técnica.
4. **Optimización Móvil y Accesibilidad:** En pantallas táctiles donde no existe `hover`, la tarjeta muestra su portada normal con la insignia interactiva `📸 {N} fotos` para abrir directamente el visor a pantalla completa. Respeta `prefers-reduced-motion`.

---

## 2. Lista Exacta de Archivos a Crear / Modificar

| Acción | Archivo | Responsabilidad |
|---|---|---|
| **Modificar** | `src/domain/model.ts` | Extender la interfaz `Game` agregando la propiedad opcional `screenshots?: string[];`. |
| **Modificar** | `src/integrations/igdb/query.ts` | Añadir `screenshots.image_id` al string de `fields` de la consulta IGDB, extender `IgdbGame` y mapear a URLs de CDN `https://images.igdb.com/igdb/image/upload/t_screenshot_big/{id}.jpg`. |
| **Modificar** | `src/services/catalogue.ts` | Aislar `screenshots` como columna transitoria (evitando colisiones en el `upsert` local de Supabase `games`) y enriquecer los juegos devueltos con su array de capturas. |
| **Crear** | `src/styles/game-screenshots.css` | Hoja de estilos dedicada con animaciones de transición para hover peek, mini-indicadores, badges de galería y estilos del modal Lightbox. |
| **Crear** | `src/components/game-screenshots-modal.tsx` | Componente modal accesible (diálogo accesible WAI-ARIA) con imagen ampliada, tira de miniaturas, flechas y atajos de teclado. |
| **Modificar** | `src/components/game-card.tsx` | Integrar el modo Hover Peek con previsualización de capturas, badges de fotos y disparador de apertura de galería. |
| **Modificar** | `src/components/explore.tsx` | Gestionar el estado del juego seleccionado para el modal Lightbox y renderizar `GameScreenshotsModal`. |
| **Crear** | `tests/unit/game-screenshots.test.ts` | Pruebas unitarias: mapeo y sanitización de URLs de screenshots en IGDB, aislamiento en `catalogue`, renderizado de insignias en `GameCard` y ciclo de vida del modal Lightbox. |

---

## 3. Contratos de Tipos Estrictos

### `src/domain/model.ts`

```typescript
export interface Game {
  id: string;
  igdb_id: number;
  title: string;
  slug: string;
  cover_url: string | null;
  screenshots?: string[]; // URLs completas HTTPS seguras en images.igdb.com
  release_year: number | null;
  platforms: string[];
  genres: string[];
  developer: string | null;
  publisher: string | null;
  series: string | null;
  synopsis: string | null;
  cached_at: string;
}
```

### `src/integrations/igdb/query.ts`

```typescript
export interface IgdbGame {
  id: number;
  name: string;
  slug: string;
  cover?: { image_id?: string };
  screenshots?: { image_id?: string }[];
  summary?: string;
  first_release_date?: number;
  total_rating?: number;
  platforms?: { name: string }[];
  genres?: { name: string }[];
  involved_companies?: { developer?: boolean; publisher?: boolean; company?: { name: string } }[];
  collections?: { name: string }[];
}
```

Mapeador seguro de URLs de capturas:
```typescript
const screenshots = (Array.isArray(game.screenshots) ? game.screenshots : [])
  .map((s) => s.image_id)
  .filter((id): id is string => typeof id === 'string' && /^[a-zA-Z0-9_]+$/.test(id))
  .map((id) => `https://images.igdb.com/igdb/image/upload/t_screenshot_big/${id}.jpg`);
```

---

## 4. Algoritmo y Flujo de Implementación

### 4.1. Extracción y Desacoplamiento de Datos (`src/services/catalogue.ts`)

Para preservar la prueba existente (`Catalogue uses IGDB ratings as fallback, preserves community priority and strips transient columns before upsert`):
1. `fetchCatalogue(filters)` devuelve juegos con `screenshots: string[]`.
2. Al preparar los registros para almacenar en Supabase `games`, se extrae `screenshots` junto con `first_release_date` e `igdb_rating`:
   ```typescript
   const igdbScreenshots = new Map<number, string[]>();
   const rows = games.map(({ first_release_date, igdb_rating, screenshots, ...row }) => {
     releaseDates.set(row.igdb_id, first_release_date);
     igdbRatings.set(row.igdb_id, igdb_rating ?? null);
     if (screenshots && screenshots.length) igdbScreenshots.set(row.igdb_id, screenshots);
     return row;
   });
   ```
3. Al enriquecer los juegos para responder al cliente:
   ```typescript
   return {
     ...game,
     screenshots: igdbScreenshots.get(game.igdb_id) ?? game.screenshots ?? [],
     release_date: ...,
     days_until_release: ...,
   };
   ```

### 4.2. Componente de Tarjeta con Hover Peek (`src/components/game-card.tsx`)

1. **Estado interno:** `hoverIndex` (por defecto `0`) e `isHovered` (booleano).
2. **Estructura visual:**
   - Contenedor `.cover` con `position: relative`.
   - **Capa Base:** Imagen de portada (`game.cover_url`).
   - **Capa Peek (si existen capturas):**
     - Al entrar el cursor (`onMouseEnter`), `isHovered = true`.
     - Imagen de captura in-game con `transition: opacity 0.25s ease`.
     - Barra de mini-indicadores (puntos o segmentos) en la parte inferior de la imagen. Al posar el mouse sobre un punto específico, cambia instantáneamente `hoverIndex` sin recargar.
     - Badge superior `📸 {game.screenshots.length} capturas` con botón para abrir Lightbox.
3. **Prop opcional:** `onOpenGallery?: (game: Game) => void` para delegar la apertura del visor Lightbox sin forzar la navegación a `/games/[slug]`.

### 4.3. Visor Inmersivo Lightbox (`src/components/game-screenshots-modal.tsx`)

1. **Accesibilidad:** `role="dialog"`, `aria-modal="true"`, foco atrapado en el modal.
2. **Navegación:**
   - Botón anterior (`◀`), botón siguiente (`▶`) e indicador numérico `1 / N`.
   - Soporte nativo para teclas: `ArrowLeft`, `ArrowRight` y `Escape` para cerrar.
3. **Tira de miniaturas:** Selector horizontal con borde activo en la captura actual.
4. **Acción directa:** Botón destacado "Ver ficha del juego ↗" hacia `/games/${game.slug}`.

---

## 5. Criterios de Aceptación Deterministas y Casos Borde

1. **Juegos sin Capturas:**
   - Si un juego no tiene capturas en IGDB, la tarjeta muestra su portada normal y no renderiza el botón de galería ni la capa de peek.
2. **Seguridad y Validación de URLs:**
   - Todos los identificadores de capturas deben validarse con `/^[a-zA-Z0-9_]+$/`. Cualquier identificador malicioso o con caracteres especiales debe ser descartado silenciosamente.
3. **Persistencia y Aislamiento de Base de Datos:**
   - La inserción en Supabase `games` no debe fallar por columnas inexistentes (la propiedad `screenshots` debe ser despojada antes del `upsert`).
4. **Movimiento Reducido (`prefers-reduced-motion: reduce`):**
   - El desvanecimiento y transiciones deben desactivarse de forma inmediata si el usuario tiene activada la preferencia de reducción de movimiento.
5. **Calidad de Código y Pruebas Unitarias:**
   - `npm test` debe pasar al 100% (446 tests existentes + nuevos tests de screenshots).
   - `npm run typecheck` debe compilar con 0 errores TypeScript.
   - `npm run lint` debe ejecutarse con 0 advertencias/errores ESLint.
   - `npm run format:check` 100% conforme con Prettier.
