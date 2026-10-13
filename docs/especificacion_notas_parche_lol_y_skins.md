# Especificación Técnica: Hub Interactivo de Notas de Parche de League of Legends (2026) y Videos de `@SkinSpotlights`

## 1. Objetivo y Alcance
Integrar dentro de la sección **"Noticias Recientes"** (`src/components/recent-news-section.tsx`) un nuevo filtro/pestaña **"Notas de parche LoL"** (con badge dinámico indicando la versión más reciente detectada, ej. `Parche 26.20`) que rastree automáticamente la página oficial de Riot Games (`https://www.leagueoflegends.com/es-es/news/tags/patch-notes/`) para capturar todas las actualizaciones de **League of Legends del año 2026** (versiones `26.1`, `26.2`, ..., `26.20` y futuras que se publiquen en 2026).

La experiencia cuenta con **dos vistas integradas dentro del mismo bloque de "Noticias Recientes"** y un **modal emergente de video**:
1. **VISTA 1 (Listado de Parches 2026)**: Lista interactiva de todas las notas de la versión de League of Legends lanzadas durante 2026 (excluyendo parches de TFT / Teamfight Tactics), ordenadas de la más reciente a la más antigua.
2. **VISTA 2 (Dashboard Detallado del Parche Seleccionado)**: Se abre **dentro del mismo contenedor de "Noticias Recientes"** al hacer clic sobre cualquier parche de la Vista 1:
   - **Barra superior (`NAVBAR`)**:
     - Botón `← Volver a parches 2026` para regresar a la Vista 1.
     - Selector/pestañas de las **5 secciones oficiales del parche**:
       1. `Vista General (Resumen + Campeones + Correcciones + Skins)` (vista principal de 2 columnas del diagrama).
       2. `Campeones`
       3. `ARAM: Caos` *(visible/habilitado cuando el parche incluya esta sección)*
       4. `ARAM` *(visible/habilitado cuando el parche incluya esta sección)*
       5. `Corrección de errores y mejoras de calidad`
       6. `Próximos aspectos y chromas`
   - **Layout de 2 Columnas (según el diagrama arquitectónico)**:
     - **Columna Izquierda**:
       - **Bloque Superior (Imagen Resumen del Parche)**: Muestra la infografía oficial de *"Los platos fuertes de la versión"* (`patch-patch-highlights`) con opción de ampliar a pantalla completa y texto de resumen.
       - **Bloque Inferior (`Campeones` / `ARAM` / `ARAM: Caos`)**: Lista vertical de tarjetas por campeón (`patch-change-block`), cada una con el icono oficial de Data Dragon, nombre del campeón, cita de contexto (`blockquote`) y cambios por habilidad (`Pasiva`, `Q`, `W`, `E`, `R`, `Estadísticas básicas`) con sus iconos de habilidad y valores antes/después.
     - **Columna Derecha**:
       - **Bloque Superior (`Corrección de errores y mejoras de calidad`)**: Lista estructurada con scroll interno de todas las correcciones de bugs y mejoras de calidad del parche (`#patch-bugfixes-and-qol-changes`).
       - **Bloque Inferior (`Próximos aspectos y chromas`)**: Grid paginado / carrusel deslizable (`2×2` por página con controles `← / →` y puntos indicadores si hay más de 4 aspectos/chromas) que muestra el splash art oficial de cada skin/chroma nueva del parche.
3. **Modal Emergente de Video (`@SkinSpotlights`)**:
   - Al hacer clic en cualquier tarjeta de **Próximos aspectos y chromas** en la Vista 2, se abre una ventana modal con el reproductor de YouTube embebido (`youtube-nocookie.com/embed/{videoId}`) del video correspondiente buscado automáticamente dentro del canal oficial `https://www.youtube.com/@SkinSpotlights/videos` (`/@SkinSpotlights/search?query=...`), además de mostrar el splash art en alta resolución y enlace directo al video en `@SkinSpotlights`.

---

## 2. Arquitectura de Datos y Endpoints Backend

### 2.1. Fuente Oficial de Riot Games (`__NEXT_DATA__`)
Riot sirve tanto el índice de etiquetas como cada artículo de notas de parche mediante Next.js SSR con un bloque `<script id="__NEXT_DATA__" type="application/json">`:

1. **Índice de Parches (`https://www.leagueoflegends.com/es-es/news/tags/patch-notes/`)**:
   - Dentro de `props.pageProps.page.blades`, el blade con `type === 'articleCardGrid'` contiene el arreglo `items`.
   - Filtrado requerido para **League of Legends 2026**:
     - `publishedAt` perteneciente al año `2026` (`publishedAt.startsWith('2026-')`) **o** versión en el título `26.X` (`/26\.\d+/i.test(title)` o `/patch-26-\d+/i.test(url)`).
     - Excluir notas de *Teamfight Tactics* (`!/teamfight|tft/i.test(title)` y `!/teamfight-tactics/i.test(url)`).
   - Campos de cada elemento del listado (`LolPatchListItem`):
     - `id`: slug extraído de `action.payload.url` (ej. `'league-of-legends-patch-26-20-notes'`).
     - `version`: número de versión extraído del título o slug (ej. `'26.20'`).
     - `title`: título oficial (ej. `'Notas de la versión 26.20 de League of Legends'`).
     - `publishedAt`: fecha ISO (`'2026-10-06T18:00:00.000Z'`).
     - `url`: URL absoluta (`'https://www.leagueoflegends.com/es-es/news/game-updates/league-of-legends-patch-26-20-notes/'`).
     - `slugPath`: ruta relativa validada (`/es-es/news/game-updates/...`).
     - `bannerUrl`: `item.media?.url` (imagen de portada del parche).
     - `description`: `item.description?.body || ''`.

2. **Detalle de un Parche (`https://www.leagueoflegends.com/es-es/news/game-updates/{slug}/`)**:
   - En `props.pageProps.page.blades`, el blade con `type === 'patchNotesRichText'` contiene `richText.body` (HTML estructurado oficial de Riot).
   - **Secciones identificables por `<h2 id="...">` o texto del `<h2>`**:
     - **Imagen Resumen (`Los platos fuertes de la versión` / `id="patch-patch-highlights"`)**:
       - Extraer el primer `<img src="...">` dentro del bloque que sigue a `Los platos fuertes de la versión` y el párrafo `<p>` descriptivo.
     - **Campeones (`<h2 id="patch-champions">Campeones</h2>`)**:
       - Cada campeón viene dentro de `<div class="patch-change-block ...">`:
         - `name`: texto de `<h3 class="change-title">`.
         - `iconUrl`: `<img src="...">` dentro de `<a class="reference-link">` (normalizando prefijos `https://am-a.akamaihd.net/image?f=` si se desea o conservando la URL válida).
         - `summary`: texto de `<blockquote class="blockquote context">`.
         - `abilities`: cada sub-bloque separado por `<hr class="divider">` con `<h4 class="change-detail-title ...">` (extrayendo el icono de la habilidad `<img src="...">` si existe y el título como `Pasiva - ...`, `Q - ...`, `Estadísticas básicas`) seguido de sus listas `<ul><li>...</li></ul>` (conservando el formato de texto limpio o fragmentos `label` + `change`).
     - **ARAM: Caos (`<h2 id="patch-aram:-mayhem">ARAM: Caos</h2>`)** y **ARAM (`<h2 id="patch-aram">ARAM</h2>`)**:
       - Extraer el texto introductorio (`blockquote`), sub-encabezados (`<h4 class="change-detail-title">`) y bloques de cambios por campeón/aumento (`<p><strong>Nombre</strong></p><ul><li>...</li></ul>` o `.patch-change-block`).
     - **Corrección de errores y mejoras de calidad (`<h2 id="patch-bugfixes-and-qol-changes">Corrección de errores y mejoras de calidad</h2>`)**:
       - Extraer todos los `<li>` dentro de esta sección como un arreglo de strings limpios (`bugfixes: string[]`), además de subtítulos `<h4 class="change-detail-title">` si están agrupados.
     - **Próximos aspectos y chromas (`<h2 id="patch-upcoming-skins-and-chromas">Próximos aspectos y chromas</h2>`)**:
       - Cada tarjeta de skin/chroma está en `<div class="skin-box">`:
         - `title`: texto de `<h4 class="skin-title">` (ej. `'Sett HEARTSTEEL - Live My Life de prestigio'`).
         - `imageUrl`: atributo `src` de `<img>` o `href` de `<a class="skins">` (splash art HD en `cmsassets.rgpub.io`).
         - `category`: `'skin'` o `'chroma'` (si el título o bloque indica chromas o aspectos).

---

### 2.2. Resolución de Videos en `@SkinSpotlights` (`https://www.youtube.com/@SkinSpotlights/videos`)
Para abrir el video emergente de cada skin sin depender de una API key de pago:
1. Crear un resolver en `src/services/lol-patch-notes.ts` y endpoint `GET /api/lol-patches/skin-video?skin={skinTitle}&champion={championName}`:
2. **Normalización bilingüe de búsqueda para `@SkinSpotlights`**:
   - Como el canal `@SkinSpotlights` titula sus videos en inglés (aunque incluye el nombre del campeón que es idéntico en español e inglés, ej. `Sett`, `Ezreal`, `Kog'Maw`, `Ambessa`), construir una lista priorizada de consultas sobre `https://www.youtube.com/@SkinSpotlights/search?query=...`:
     1. Traducción ligera de términos frecuentes en español a inglés (`de prestigio` → `Prestige`, `barón clásico` → `Classic Baron`, `de porcelana` → `Porcelain`, `elegida/o del lobo` → `Chosen of the Wolf`, `luna sangrienta` → `Blood Moon`, `flor espiritual` → `Spirit Blossom`, `proyecto` → `PROJECT`, `guardianes de las estrellas` → `Star Guardian`, `corte feérica` → `Faerie Court`, `empíreo` → `Empyrean`, `noche de sustos` → `Fright Night`, `reinos mecha` → `Mecha Kingdoms`, eliminando conectores `de`, `del`, `la`, `el`) + `'Skin Spotlight'`.
     2. Nombre del campeón detectado en el título de la skin + `'Skin Spotlight'`.
   - Parsear los bloques `"videoRenderer":{"videoId":"...","title":{"runs":[{"text":"..."}]}}` de la respuesta de `/@SkinSpotlights/search`:
     - Priorizar el primer resultado cuyo título contenga el nombre del campeón y `'Skin Spotlight'` (prefiriendo la versión final sobre `'Pre-Release'`, o usando `'Pre-Release'` si es un parche recién salido).
     - Devolver `{ videoId, title, youtubeUrl: 'https://www.youtube.com/watch?v=' + videoId, embedUrl: 'https://www.youtube-nocookie.com/embed/' + videoId + '?autoplay=1&rel=0', channelUrl: 'https://www.youtube.com/@SkinSpotlights/videos' }`.

---

## 3. Rutas API en Next.js
1. **`GET /api/lol-patches`**:
   - Devuelve `{ patches: LolPatchListItem[], latestVersion: string | null, fetchedAt: string }` con caché en memoria / `revalidate = 900` (15 minutos) para detectar cualquier parche nuevo de 2026 apenas salga en Riot.
2. **`GET /api/lol-patches/[slug]`**:
   - Recibe el `slug` del parche (ej. `league-of-legends-patch-26-20-notes`), obtiene y parsea el detalle del parche (`LolPatchDetail`), y lo devuelve con caché de 30 minutos:
     ```ts
     export interface LolPatchDetail {
       id: string;
       version: string;
       title: string;
       publishedAt: string;
       url: string;
       bannerUrl: string;
       highlightsImageUrl: string | null;
       highlightsSummary: string | null;
       champions: LolChampionPatchChange[];
       aramMayhem: LolModePatchSection | null;
       aram: LolModePatchSection | null;
       bugfixes: string[];
       skins: LolUpcomingSkin[];
     }
     ```
3. **`GET /api/lol-patches/skin-video`**:
   - Recibe `?title=...` (nombre de la skin en el parche), consulta `@SkinSpotlights` con caché en memoria por título, y devuelve el `videoId` y metadatos del video para el modal emergente.

---

## 4. Diseño de Interfaz en `src/components/recent-news-section.tsx` y `src/components/lol-patch-notes-hub.tsx`
1. **Botón en la barra de filtros de "Noticias Recientes"**:
   - Junto a `Todas`, `Vandal`, `IGN` y `Anime & Manga`, agregar el botón **`Notas de parche LoL`** con un badge dorado/azul Hextech que muestre la versión actual más reciente (ej. `26.20`).
2. **VISTA 1 (Lista de Parches 2026)**:
   - Muestra todos los parches de LoL de 2026 en filas estilizadas horizontalmente (tal como en el boceto de **Vista 1** del usuario), con:
     - Badge de versión (`PARCHE 26.20`), miniatura del banner oficial, título completo, fecha de publicación formateada (`es-CL`), etiqueta `NUEVO` en el parche más reciente y botón `Ver notas del parche →`.
3. **VISTA 2 (Detalle del Parche Seleccionado)**:
   - Se renderiza **dentro del mismo contenedor de "Noticias Recientes"** reemplazando la Vista 1 al seleccionar un parche:
   - **`NAVBAR` Superior**:
     - Botón `← Volver a parches 2026` a la izquierda.
     - Título del parche activo y enlace a la nota oficial de Riot.
     - Pestañas de navegación rápida: `Vista General (2 Columnas)`, `Campeones (N)`, `ARAM: Caos` (si existe), `ARAM` (si existe), `Correcciones (N)`, `Skins y Chromas (N)`.
   - **Grid de 2 Columnas (en `Vista General`)**:
     - **Columna Izquierda**:
       - **Div Superior (`Los platos fuertes de la versión`)**: Imagen resumen oficial del parche con zoom/lightbox opcional y resumen de aspectos destacados.
       - **Div Inferior (`Campeones`)**:
         - Muestra **hasta 3 campeones por página** y se pagina de **3 en 3** (`rows.slice(champPage * 3, (champPage + 1) * 3)`), incluyendo controles de paginación (`← Anterior`, `{champPage + 1} / {champPages}`, `Siguiente →`) cuando haya más de 3 campeones.
         - Cada tarjeta muestra su avatar oficial, frase de contexto de Riot y desglose de cambios por habilidad (`Pasiva`, `Q`, `W`, `E`, `R`, `Estadísticas básicas`) con sus iconos.
     - **Columna Derecha**:
       - **Div Superior (`Corrección de errores y mejoras de calidad`)**: Panel con scroll estilizado más largo (`min-height: 560px; max-height: 760px;` en `Vista General`) listando todas las correcciones del parche.
       - **Div Inferior (`Próximos aspectos y chromas`)**: Grid `2×2` con controles de slider (`← Anterior` / `Siguiente →` + indicadores de página) para deslizar cuando haya más de 4 skins/chromas. Cada tarjeta muestra el splash art, nombre del aspecto/chroma y un badge `▶ Ver Spotlight`.
4. **Ventanas Emergentes Centradas (`<dialog className="patch-media-dialog">`)**:
   - **Centrado en pantalla**: Como `src/app/globals.css` aplica un reset global `* { margin: 0; }`, el elemento `<dialog>` pierde el `margin: auto` nativo del navegador y se pega arriba a la izquierda. Por ello, `.patch-media-dialog` debe definir explícitamente `margin: auto; inset: 0; position: fixed;` para quedar perfectamente centrado vertical y horizontalmente en el viewport.
   - **Modal de Skins (Solo Video, Sin Imagen)**:
     - Cuando el modal se abre para una **skin** (`skin !== null`), debe mostrar **únicamente el reproductor de video de `@SkinSpotlights` (`<iframe>`)** (más su título y botones de enlace a YouTube), **sin renderizar la imagen (`PatchImage` / `.patch-modal-art`) debajo del video**.
   - **Modal de Imagen Resumen (`Los platos fuertes de la versión`)**:
     - Solo cuando `skin === null` y se abre para ampliar la imagen resumen (`image !== null`), se renderiza `<PatchImage src={image} className="patch-modal-art" />` centrada en pantalla.
   - Cierre con `Escape`, botón `✕ Cerrar` o clic en el backdrop fuera del modal.

