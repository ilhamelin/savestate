# Propuesta Técnica: Filtros Contextuales de Plataforma/Género y Paginación de Biblioteca

**Fecha:** 9 de octubre de 2026  
**Origen:** Auditoría e Investigación (`research/antigravity`)  
**Destino:** Equipo de Implementación (`implementation/chatgpt` / Codex)  
**Propósito:** Especificar la optimización de los selectores de plataforma y género en la biblioteca del jugador y en «¿Qué juego hoy?», así como la paginación a 5 juegos por página para evitar listas verticales infinitas.

---

## 1. Justificación y Diagnóstico

### 1.1. Selector de Plataforma Desconectado
- **Situación actual:** Los componentes `Library` (`src/components/library.tsx`) y `BacklogPicker` (`src/components/backlog-picker.tsx`) extraían las plataformas mediante `choices.flatMap(game => game.platforms)`. Dado que juegos masivos (ej: *GTA V*, *Minecraft*, *Bio Inc.*) tienen listadas en IGDB más de 20 plataformas (Android, Wii U, Windows Phone, Oculus Rift, etc.), el selector mostraba decenas de consolas ajenas al usuario.
- **Necesidad:** El usuario solo debe ver las plataformas en las que **realmente tiene juegos registrados o importados** (ej: `PC / Steam`, `PlayStation 5`, `Xbox`, etc.), obtenidas a partir de sus partidas registradas (`PlayLog.platform_played`).

### 1.2. Selector de Género
- El desplegable debe alimentarse exclusivamente de los géneros presentes en los juegos que el usuario tiene cargados en su biblioteca (filtrando valores vacíos o nulos y ordenados alfabéticamente), permitiendo filtrar con precisión su colección.

### 1.3. Sobrecarga Visual en la Lista de Biblioteca
- **Situación actual:** Con 116 juegos (o hasta 500), `src/components/library.tsx` renderizaba todos los elementos de forma simultánea en el DOM. Cada elemento incluye portada, metadatos y un árbol de acordeones interactivos (`LibraryForm`, `QuickSession`, `PlayLogForm`, `DeleteLibrary`), provocando un scroll interminable y degradación de rendimiento.
- **Necesidad:** Limitar la visualización a un **máximo de 5 juegos por página** con controles de paginación («Anterior», indicador «Página X de Y», «Siguiente»).

---

## 2. Especificación Técnica

### 2.1. Plataformas Reales del Usuario
1. En `src/components/library.tsx`:
   - Extraer las plataformas únicas a partir de los registros de juego (`logs`):
     ```ts
     const userPlatforms = [
       ...new Set(logs.map((log) => log.platform_played).filter(Boolean)),
     ].sort();
     const platforms = userPlatforms.length
       ? userPlatforms
       : [...new Set(choices.flatMap((game) => game.platforms))].sort();
     ```
   - Pasar `logs` a `<BacklogPicker entries={entries} games={games} logs={logs} />`.
2. En `src/components/backlog-picker.tsx`:
   - Aceptar `logs?: PlayLog[]`.
   - Calcular las plataformas basándose en `logs` de los juegos en backlog:
     ```ts
     const userPlatforms = [
       ...new Set(
         logs
           ?.filter((log) => backlogEntryIds.has(log.user_game_id))
           .map((log) => log.platform_played)
           .filter(Boolean) ?? []
       ),
     ].sort();
     ```
   - Filtrar candidatos de backlog comprobando la plataforma jugada en `logs` o por compatibilidad en `game.platforms`.
3. En `src/domain/library-view.ts`:
   - Al filtrar por `filters.platform`, verificar si la entrada tiene un `PlayLog` con `log.platform_played === filters.platform`. Si la entrada no tiene logs registrados, evaluar coincidencia con `game.platforms`.

### 2.2. Géneros Reales Cargados
1. Filtrar los géneros directamente desde los juegos vinculados a las entradas del usuario:
   ```ts
   const genres = [...new Set(choices.flatMap((game) => game.genres).filter(Boolean))].sort();
   ```
2. Garantizar que géneros no existentes en la colección del usuario no se listen en el desplegable.

### 2.3. Paginación de Biblioteca (5 juegos por página)
1. En `src/components/library.tsx`:
   - Constante `const PAGE_SIZE = 5;`
   - Estado `const [page, setPage] = useState(0);`
   - En cualquier cambio de filtro (`query`, `platform`, `genre`, `filter` / estado, `sort`), invocar `setPage(0)`.
   - Cálculo de páginas:
     ```ts
     const totalPages = Math.ceil(visible.length / PAGE_SIZE) || 1;
     const currentPage = Math.min(page, Math.max(0, totalPages - 1));
     const pagedVisible = visible.slice(
       currentPage * PAGE_SIZE,
       (currentPage + 1) * PAGE_SIZE
     );
     ```
   - Renderizar `pagedVisible.map(...)` en lugar de `visible.map(...)`.
   - Insertar barra de controles de paginación tras el listado (y opcionalmente encima) usando la clase CSS `.filter-buttons`:
     - Botón `Anterior` (`disabled={currentPage === 0}`).
     - Texto/indicador `Página {currentPage + 1} de {totalPages} ({visible.length} juegos)`.
     - Botón `Siguiente` (`disabled={currentPage >= totalPages - 1}`).

---

## 3. Criterios de Aceptación
1. El desplegable de **Plataforma** en `/library` y en «¿Qué juego hoy?» solo muestra las plataformas del usuario (ej: `PC / Steam`, o consolas que posea) en lugar del catálogo completo de 25+ plataformas de IGDB.
2. El desplegable de **Género** solo muestra los géneros de los juegos que el usuario tiene en su biblioteca.
3. La lista de la biblioteca solo muestra 5 juegos a la vez. Al hacer clic en «Siguiente» avanza a los próximos 5.
4. Al aplicar un filtro o búsqueda, la página se resetea automáticamente a la 1.
5. `npm run check` (TypeScript, ESLint, Prettier y tests unitarios) pasa con 0 errores.
