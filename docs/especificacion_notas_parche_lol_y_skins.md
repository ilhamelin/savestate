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

---

## 5. Mejoras de Jerarquía Visual, Espaciado y Denotación Semántica de Estadísticas (Verde / Rojo)

### 5.1. Espaciado entre Opciones Superiores, Barra de Retorno y Título del Parche
- En `Vista 2`, separar visualmente la barra de filtros superior, la barra `.patch-nav` (`← Volver a parches 2026` / `↗ Nota oficial de Riot`), el título del parche (`<h3 className="patch-title">`) y la botonera de secciones (`.patch-tabs`):
  - `.lol-patch-hub`: `margin-top: 1.35rem;`
  - `.patch-nav`: `margin-bottom: 1.25rem; padding-bottom: 0.85rem; border-bottom: 1px solid var(--line);`
  - `.patch-title`: `margin: 0.35rem 0 1.2rem; font-size: 1.35rem; color: #f8fafc; letter-spacing: 0.02em;`
  - `.patch-tabs`: `margin: 0 0 1.4rem; gap: 0.55rem;`

### 5.2. Denotación Semántica de Estadísticas en `Campeones`, `ARAM: Caos` y `ARAM` (Verde = Positivo, Rojo = Negativo)
- Implementar en `src/domain/lol-patch-notes.ts` el analizador puro `analyzePatchStatChange(line: string): ParsedStatChange`:
  - Separa `label` (antes de `:`), `before` (antes de `⇒`) y `after` (después de `⇒`).
  - Extrae los valores numéricos de `before` y `after` (soportando decimales con coma como `3,5`, rangos `5 - 30` o `22-12` y escalados `20/30/40`).
  - Identifica si el `label` es una estadística **inversa** donde una reducción numérica es positiva para el campeón (`/enfriamiento|recarga|coste|costo|man[aá]|energ[ií]a necesaria|da[ñn]o recibido|tiempo de|retardo|demora/i`):
    - **Positivo (`buff` — Verde)**: Cuando una estadística directa sube (ej. `Relación de PH: 50 % ⇒ 67 %`, `Escudo: 60-240 ⇒ 80-320`) o cuando una estadística inversa baja (ej. `Enfriamiento de la W: 22-12 ⇒ 18-12`, `Recarga de los meeps: 8 s ⇒ 5 s`), o cuando la línea empieza por `Nuevo:`.
    - **Negativo (`nerf` — Rojo)**: Cuando una estadística directa baja (ej. `Daño: 5 - 30 (+25 % del DA adicional) ⇒ 5 - 25 (+20 % del DA adicional)`, `Daño de ataque por nivel: 3,5 ⇒ 3`) o cuando una estadística inversa sube (ej. `Daño recibido: 105 % ⇒ 108 %`), o cuando empieza por `Eliminado:`.
    - **Ajuste (`adjust` — Cian/Ámbar)**: Cuando los rangos se redistribuyen o es un cambio mecánico sin dirección numérica única.
- **Renderizado visual (`<StatChangeRow />`)**:
  - **Badge lateral**: `▲ MEJORA` (verde `#4ade80`), `▼ REDUCCIÓN` (rojo `#f87171`), o `◆ AJUSTE` (cian `#38bdf8`).
  - **Atributo (`label`)**: En dorado claro (`#f3e5ab`, `font-weight: 600`).
  - **Valor anterior (`before`)**: En gris atenuado tachado (`#94a3b8`, `text-decoration: line-through`, fondo sutil `#1e293b99`).
  - **Flecha `⇒`**: En dorado (`#d4af37`).
  - **Valor nuevo (`after`)**:
    - Si es positivo (`buff`): **Píldora y texto en Verde brillante (`color: #4ade80; background: rgba(34, 197, 94, 0.15); border: 1px solid rgba(74, 222, 128, 0.45); font-weight: 700;`)**.
    - Si es negativo (`nerf`): **Píldora y texto en Rojo coral (`color: #f87171; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(248, 113, 113, 0.45); font-weight: 700;`)**.
    - Si es ajuste (`adjust`): **Píldora y texto en Cian (`color: #38bdf8; background: rgba(56, 189, 248, 0.14); border: 1px solid rgba(56, 189, 248, 0.4); font-weight: 700;`)**.
  - Además, cada tarjeta de campeón muestra junto a su nombre un badge general del campeón (`▲ BUFF`, `▼ NERF` o `◆ AJUSTADO`).

### 5.3. Rediseño Visual de `ARAM: Caos`, `ARAM` y `Corrección de errores y mejoras de calidad`
1. **`ARAM: Caos` y `ARAM`**:
   - Mostrar el resumen introductorio en un bloque destacado `.patch-mode-intro` con borde izquierdo dorado y mejor interlineado.
   - Renderizar cada campeón o grupo (`Bardo`, `Garen`, `K'Sante`, `Lee Sin`, `Swain`, etc.) dentro de su propia tarjeta `.patch-mode-card` con borde lateral según su balance general (`buff`/`nerf`/`adjust`), cabecera destacada y todas sus líneas de cambio renderizadas con `<StatChangeRow />` (colores verdes y rojos en lugar de texto blanco plano).
2. **`Corrección de errores y mejoras de calidad`**:
   - Reemplazar la lista monótona de texto blanco por tarjetas/filas estilizadas `.patch-bug-item` con fondo alternado, borde izquierdo de acento y un badge `🛠️ FIX` (o `✨ MEJORA`).
   - Atenuar en gris (`#94a3b8`) el prefijo repetitivo (`"Hemos corregido un error que provocaba que"` / `"Hemos corregido un error que impedía que"`), resaltar en dorado/cian las teclas de habilidad (`(Q)`, `(W)`, `(E)`, `(R)`, `(Pasiva)`, `la R de`, `la Q de`, `la E de`, `la W de`) con badges `.patch-inline-key` y destacar los términos clave del resto de la oración para una lectura rápida y escaneable.


