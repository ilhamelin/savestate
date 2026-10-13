# Especificación Técnica: Diagnóstico y Corrección Integral del Sistema de Búsqueda en `/explore` ("Explorar")

**Fecha:** 12 de octubre de 2026  
**Rama de origen:** `research/antigravity`  
**Rama de destino:** `implementation/chatgpt` (Codex)  
**Objetivo:** Corregir los errores funcionales, choques de filtros, fallos de validación en vivo y duplicidades de interfaz detectados en el buscador del catálogo global (`/explore` — `src/components/explore.tsx`, `src/integrations/igdb/query.ts`, `src/services/catalogue.ts`, `src/repositories/catalogue.ts` y `src/app/globals.css`).

---

## 1. Diagnóstico de Errores e Incoherencias Detectadas

Tras auditar el flujo completo desde `src/components/explore.tsx` hasta `/api/catalogue`, `igdbQuery`, `fetchCatalogue` y `localCatalogue`, se identificaron **6 problemas concretos**:

1. **Controles duplicados (`Modo del catálogo` vs `Ordenar por`) y desbordamiento de la grilla `.search-grid`**:
   - En `src/components/explore.tsx`, las 4 pestañas superiores (`🔥 Populares`, `🚀 Próximos Estrenos`, `⚡ Recientes`, `🕹️ Clásicos`) y el `<select>Ordenar por</select>` inferior modifican exactamente el mismo estado `sort` (`relevance`, `upcoming`, `recent`, `classics`) con nombres distintos.
   - Además, `.search-grid` en `src/app/globals.css` está definida para **5 columnas** (`grid-template-columns: 2fr repeat(4, 1fr)`), por lo que el 6.º elemento (`Ordenar por`) cae huérfano a una segunda fila.
   - Tampoco existe un botón rápido para **Limpiar filtros** cuando el usuario combina varios criterios.

2. **Filtro de `Plataforma` roto por exigir "Nombre exacto" interno de IGDB**:
   - Actualmente `Plataforma` es un `<input placeholder="Nombre exacto">` y `igdbQuery` ejecuta `platforms.name = "PC"`.
   - En IGDB, PC se llama `"PC (Microsoft Windows)"`, PS5 es `"PlayStation 5"`, PS1 es `"PlayStation"` y Switch es `"Nintendo Switch"`. Escribir `"PC"`, `"PS5"`, `"Switch"` o `"Xbox"` devuelve **0 juegos encontrados**.

3. **Error `400 Año inválido` mientras el usuario escribe un año en el campo `Año`**:
   - Cada pulsación en `<input type="number" min="1950" max="2100">` dispara `change('year', event.target.value)` con debounce de `300ms`.
   - Cuando el usuario intenta escribir `2024`, al teclear `"2"`, `"20"` o `"202"` se envía `/api/catalogue?year=202`, y `parseFilters` lanza `ValidationError('Año inválido.')` (`400 Bad Request`), vaciando el catálogo y mostrando un mensaje de error a mitad de la escritura.

4. **Choques lógicos imposibles entre las pestañas de época (`Clásicos` / `Próximos Estrenos`) y el filtro `Año`**:
   - Si el usuario está en `🕹️ Clásicos` (`first_release_date < 1262304000`, antes de 2010) e introduce `Año: 2023`, o está en `🚀 Próximos Estrenos` (`first_release_date > todaySec`) e introduce `Año: 2020`, `igdbQuery` concatena ambas condiciones excluyentes y devuelve **0 resultados**.

5. **Filtro `Nota comunitaria` (`minRating`) devuelve páginas vacías de 0 juegos con el botón `"Cargar más juegos"` visible**:
   - En `src/services/catalogue.ts`, se llama a `fetchCatalogue({ ...filters, minRating: null })` (trayendo 24 juegos cualesquiera de IGDB sin filtrar por nota) y luego se filtran en memoria exigiendo `game.community_rating !== null && game.community_rating >= filters.minRating!`.
   - Como la mayoría de los juegos del catálogo global de IGDB aún no tienen reseñas locales en SaveState, los 24 resultados se descartan en memoria, mostrando `"0 juegos encontrados"` junto al botón `"Cargar más juegos"` (porque `pageSize` sigue siendo `24`).

6. **Condición de carrera en la caché de cliente de `Explore` (`src/components/explore.tsx`)**:
   - Cuando el usuario alterna entre filtros ya visitados o pagina y vuelve a `offset = 0`, el early-return `if (!offset && !retry && cacheRef.current.has(key)) return` en `useEffect` puede dejar `loading` en `true` si hubo un cambio intermedio cancelado antes del `setTimeout`.

---

## 2. Solución Técnica Detallada

### 2.1. Actualizar `src/integrations/igdb/query.ts`

1. **Normalización y búsqueda flexible de `Plataforma` (`resolvePlatformFilter`):**
   Crear un mapa de alias comunes hacia los nombres oficiales de IGDB y usar coincidencia exacta cuando sea una plataforma canónica o coincidencia parcial `platforms.name ~ *${quote(platform)}*` cuando el usuario pase otro texto:
   ```ts
   const PLATFORM_ALIASES: Record<string, string> = {
     pc: 'PC (Microsoft Windows)',
     windows: 'PC (Microsoft Windows)',
     'pc (microsoft windows)': 'PC (Microsoft Windows)',
     ps5: 'PlayStation 5',
     'playstation 5': 'PlayStation 5',
     ps4: 'PlayStation 4',
     'playstation 4': 'PlayStation 4',
     ps3: 'PlayStation 3',
     'playstation 3': 'PlayStation 3',
     ps2: 'PlayStation 2',
     'playstation 2': 'PlayStation 2',
     ps1: 'PlayStation',
     psx: 'PlayStation',
     playstation: 'PlayStation',
     switch: 'Nintendo Switch',
     'nintendo switch': 'Nintendo Switch',
     'xbox series': 'Xbox Series X|S',
     'xbox series x': 'Xbox Series X|S',
     'xbox series s': 'Xbox Series X|S',
     'xbox series x|s': 'Xbox Series X|S',
     'xbox one': 'Xbox One',
     'xbox 360': 'Xbox 360',
     snes: 'Super Nintendo Entertainment System',
     'super nintendo': 'Super Nintendo Entertainment System',
     'super nintendo entertainment system': 'Super Nintendo Entertainment System',
     n64: 'Nintendo 64',
     'nintendo 64': 'Nintendo 64',
     gba: 'Game Boy Advance',
     'game boy advance': 'Game Boy Advance',
     mac: 'Mac',
     linux: 'Linux',
     android: 'Android',
     ios: 'iOS',
   };

   export function resolveCanonicalPlatform(input: string): { canonical: string | null; raw: string } {
     const trimmed = input.trim();
     if (!trimmed) return { canonical: null, raw: '' };
     const mapped = PLATFORM_ALIASES[trimmed.toLowerCase()];
     return { canonical: mapped ?? null, raw: mapped ?? trimmed };
   }
   ```
   En `igdbQuery(filters)`:
   ```ts
   if (filters.platform) {
     const { canonical, raw } = resolveCanonicalPlatform(filters.platform);
     where.push(
       canonical
         ? `platforms.name = ${quote(canonical)}`
         : `platforms.name ~ *${quote(raw.replace(/[\r\n]/g, ' '))}*`,
     );
   }
   ```

2. **Evitar contradicciones entre `filters.year` y los modos `classics` / `upcoming` / `recent` en `igdbQuery`:**
   - Si `filters.year` está presente:
     - Solo aplicar `first_release_date < 1262304000` (`classics`) si `!filters.year || filters.year < 2010`.
     - Solo aplicar `first_release_date > ${todaySec}` (`upcoming`) si `!filters.year || filters.year >= new Date().getUTCFullYear()`.
     - Solo aplicar `first_release_date <= ${todaySec}` (`recent`) si `!filters.year || filters.year <= new Date().getUTCFullYear()`.

3. **Soportar `minRating` en `igdbQuery` y exponer `total_rating` en `IgdbGame`:**
   - Si `filters.minRating !== null`:
     - Añadir `where.push(\`total_rating >= ${Math.round(filters.minRating * 10)}\`)` en `igdbQuery(filters)`.
   - Añadir `total_rating` a la lista de `fields` en `igdbQuery`:
     `fields id,name,slug,cover.image_id,summary,first_release_date,total_rating,platforms.name,genres.name,involved_companies.developer,involved_companies.publisher,involved_companies.company.name,collections.name;`
   - En `IgdbGame`, añadir `total_rating?: number;`.
   - *(Importante: mantener el retorno de `mapIgdbGame(game)` sin campos extra para no romper la inserción en la tabla `games` de Supabase ni los tests existentes).*

---

### 2.2. Actualizar `src/integrations/igdb/server.ts` y `src/services/catalogue.ts`

1. En `src/integrations/igdb/server.ts`:
   En `fetchCatalogue`, devolver junto con `first_release_date` la valoración normalizada de IGDB en escala `0–10` (`igdb_rating`):
   ```ts
   return (data as IgdbGame[]).map((game) => ({
     ...mapIgdbGame(game),
     first_release_date: game.first_release_date ?? null,
     igdb_rating:
       typeof game.total_rating === 'number' && Number.isFinite(game.total_rating)
         ? Math.round((game.total_rating / 10) * 10) / 10
         : null,
   }));
   ```

2. En `src/services/catalogue.ts`:
   - Pasar `filters` completos a `fetchCatalogue(filters)` (en lugar de `{ ...filters, minRating: null }`) para que IGDB filtre directamente por `total_rating >= minRating * 10`.
   - Guardar `igdbRatings = new Map<number, number | null>()` al recorrer `games`, y extraer `igdb_rating` junto con `first_release_date` antes de hacer `.upsert(rows)` en la tabla `games`:
     ```ts
     const rows = games.map(({ first_release_date, igdb_rating, ...row }) => {
       releaseDates.set(row.igdb_id, first_release_date);
       igdbRatings.set(row.igdb_id, igdb_rating ?? null);
       return row;
     });
     ```
   - Combinar la valoración comunitaria local con el fallback de IGDB:
     ```ts
     const page = await localCatalogue({ ...filters, minRating: null }, igdbIds);
     const enriched = page.map((game) => {
       const effectiveRating =
         game.community_rating ?? (source === 'igdb' ? (igdbRatings.get(game.igdb_id) ?? null) : null);
       return {
         ...game,
         community_rating: effectiveRating,
       };
     });
     const games = filters.minRating
       ? enriched.filter(
           (game) => game.community_rating !== null && game.community_rating >= filters.minRating!,
         )
       : enriched;
     ```
   - Ajustar `nextOffset` para que nunca ofrezca `"Cargar más juegos"` si la página filtrada quedó vacía (`games.length === 0`):
     ```ts
     nextOffset: games.length > 0 && pageSize === 24 && filters.offset < 960 ? filters.offset + 24 : null,
     ```

---

### 2.3. Actualizar `src/repositories/catalogue.ts`

1. Importar `resolveCanonicalPlatform` desde `@/integrations/igdb/query`.
2. Cuando se filtre en modo local (`!igdbIds`):
   - Evitar choques entre `filters.year` y `filters.sort` (`classics`, `recent`, `upcoming`): solo aplicar el filtro de época de `sort` cuando `filters.year` sea `null`.
   - Para `filters.platform`:
     ```ts
     if (!igdbIds && filters.platform) {
       const { raw } = resolveCanonicalPlatform(filters.platform);
       query = query.contains('platforms', [raw]);
     }
     ```

---

### 2.4. Actualizar `src/components/explore.tsx` y `src/app/globals.css`

1. **Eliminar la duplicidad `Modo del catálogo` vs `Ordenar por` y alinear la grilla de 5 columnas (`.search-grid`)**:
   - Mantener arriba la barra de pestañas `.explore-mode-tabs` (`🔥 Populares`, `🚀 Próximos Estrenos`, `⚡ Recientes`, `🕹️ Clásicos`) y añadir a su derecha un botón **`✕ Limpiar filtros`** visible cuando cualquier filtro esté activo (`q || platform || genre || year || rating || sort !== 'relevance'`).
   - Eliminar el sexto campo redundante `<label>Ordenar por ...</label>` de `.search-grid`, dejando exactamente los **5 campos** que encajan en una sola fila limpia (`grid-template-columns: 2fr repeat(4, 1fr)`):
     1. **Buscar juego, estudio o saga** (`input[type="search"]`)
     2. **Plataforma** (`<select>` con las plataformas oficiales de IGDB)
     3. **Género** (`<select>`)
     4. **Año** (`input[type="number"]` con validación de 4 dígitos antes de consultar)
     5. **Valoración mínima** (`<select>` `Cualquiera`, `5+ / 10` … `9+ / 10`)

2. **Selector `<select>` de Plataformas en `src/components/explore.tsx`**:
   Reemplazar el `<input placeholder="Nombre exacto">` por un `<select>` con opciones claras:
   - `""` -> `"Todas"`
   - `"PC (Microsoft Windows)"` -> `"PC (Windows)"`
   - `"PlayStation 5"` -> `"PlayStation 5"`
   - `"PlayStation 4"` -> `"PlayStation 4"`
   - `"PlayStation 3"` -> `"PlayStation 3"`
   - `"PlayStation 2"` -> `"PlayStation 2"`
   - `"PlayStation"` -> `"PlayStation (PS1)"`
   - `"Nintendo Switch"` -> `"Nintendo Switch"`
   - `"Xbox Series X|S"` -> `"Xbox Series X|S"`
   - `"Xbox One"` -> `"Xbox One"`
   - `"Xbox 360"` -> `"Xbox 360"`
   - `"Super Nintendo Entertainment System"` -> `"Super Nintendo (SNES)"`
   - `"Nintendo 64"` -> `"Nintendo 64"`
   - `"Game Boy Advance"` -> `"Game Boy Advance"`
   - `"Mac"` -> `"Mac"`
   - `"Linux"` -> `"Linux"`
   - `"Android"` -> `"Android"`
   - `"iOS"` -> `"iOS"`

3. **Validación suave del campo `Año` durante la escritura**:
   - Mantener `yearInput` en el estado del formulario, pero calcular `const validYear = /^(19[5-9]\d|20\d\d|2100)$/.test(year.trim()) ? year.trim() : '';`.
   - Si `year.trim().length > 0 && !validYear`, no disparar una petición inválida al servidor (o solo dispararla cuando `year.trim() === ''` o `validYear !== ''`), mostrando una pista sutil si el año de 4 dígitos está fuera de `1950–2100`.
   - Si el usuario introduce un `validYear` que choca con `classics` (`Number(validYear) >= 2010`) o con `upcoming` (`Number(validYear) < new Date().getFullYear()`), cambiar automáticamente `sort` a `'relevance'` para que la búsqueda devuelva los juegos de ese año.

4. **Sincronización limpia de Caché y `loading` en `useEffect`**:
   - Dentro del `useEffect`, si `!offset && !retry && cacheRef.current.has(key)`, restaurar explícitamente `setResult(cacheRef.current.get(key)!)`, `setError('')` y `setLoading(false)` antes de hacer `return () => controller.abort()`, garantizando que nunca quede el estado `loading = true` bloqueado tras escribir y borrar rápido.

---

## 3. Plan de Verificación

1. Ejecutar `npm test` y verificar que `tests/unit/catalogue.test.ts` pasa al 100% junto con las nuevas pruebas de alias de plataforma, filtro `minRating` y resolución de conflicto entre `year` y `classics`/`upcoming`.
2. En `/explore`:
   - Verificar que los 5 controles de búsqueda quedan perfectamente alineados en una sola fila en desktop sin el control duplicado `Ordenar por` desbordado abajo.
   - Seleccionar plataformas como `PC (Windows)`, `PlayStation 5` o `Nintendo Switch` y comprobar que devuelve juegos reales.
   - Escribir un año dígito a dígito (`2` -> `20` -> `202` -> `2024`) y verificar que no aparece el error `Año inválido.` a mitad de escritura.
   - Seleccionar `Valoración mínima: 8+ / 10` y comprobar que devuelve juegos con su puntuación `★` sin quedar en `0 juegos encontrados`.
