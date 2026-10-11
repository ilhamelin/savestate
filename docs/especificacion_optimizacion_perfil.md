# Especificación Técnica: Optimización de Rendimiento y UX del Perfil de Jugador

## 1. Diagnóstico Actual
En `src/app/players/[username]/page.tsx`, `src/repositories/player.ts` y `src/repositories/dossier.ts` existen cuellos de botella de red y sobrecarga visual:

1. **Consultas SQL redundantes en cada visita al perfil**:
   - `page.tsx` llama a `db.rpc('can_view_library', { owner_id: profile.id })`.
   - Luego llama a `Promise.all([libraryFor(profile.id), dossierFor(profile.id)])`.
   - `dossierFor` vuelve a invocar `db.rpc('can_view_library')` y vuelve a descargar todas las filas de `user_games` y `play_logs` que `libraryFor` ya descargó cuando `library.count <= 500`.
   - `libraryFor` consulta `db.from('reviews').select('*').in('user_game_id', ids)` en el perfil aunque ninguna sección del perfil utiliza `library.reviews`.
   - `pendingFriendRequests()` vuelve a llamar a `authenticated()` (`auth.getUser()`) cuando `page.tsx` ya resolvió `user` y `db`.

2. **Desorden visual y exceso de scroll vertical**:
   - Hay dos barras `<nav className="tabs">` separadas (líneas 136 y 189) y un botón suelto `Ver SaveState Wrapped →`.
   - Para llegar a la Biblioteca (`#player-library`), el usuario debe hacer scroll por encima de `StatsDossier`, `AchievementsShowcase`, `MemoryCardExport` y `PlayerStatistics`.

---

## 2. Solución Arquitectónica

### 2.1. Optimización de Consultas (Backend)
- **Fast-path de Dossier en memoria**:
  - En `players/[username]/page.tsx`, ejecutar `const library = access.data ? await libraryFor(profile.id) : null;`.
  - Si `library` existe y `library.count <= 500` (y `library.logs.length < 1000`), calcular el dossier directamente en memoria con `profileDossier(library.entries, library.logs)` de `@/domain/dossier`, ahorrando **3 llamadas completas a Supabase** (`can_view_library`, `user_games`, `play_logs`).
  - Solo si `library.count > 500` o `library.logs.length >= 1000`, invocar `dossierFor(profile.id, { skipAccessCheck: true })`.
- **Optimizar `libraryFor`**:
  - Hacer que la carga de `reviews` sea opcional (`includeReviews = false` por defecto si nadie las consume, o verificar dónde se usa `libraryFor`).
- **Optimizar `pendingFriendRequests`**:
  - Permitir pasar `userId?: string` para evitar repetir `auth.getUser()` cuando ya se conoce en el Server Component.

### 2.2. Optimización Visual y de Navegación (Frontend UX)
1. **Indicador de Presencia en la Cabecera del Perfil (`ProfileIdentity` / `ProfilePresenceBadge`)**:
   - Mostrar en la cabecera del perfil (`@username`) si ese jugador está `● Activo` o `○ Inactivo` en tiempo real reutilizando `useOnlineUsers()`.
2. **Barra de Navegación Unificada (`profile-QuickNav`)**:
   - Reemplazar las dos barras `<nav className="tabs">` dispersas y el botón suelto de Wrapped por una sola barra de navegación clara y ordenada debajo de la cabecera/controles sociales:
     - Enlaces internos y de sección: `Biblioteca`, `Dossier y Estadísticas`, `Logros y Memory Card`, `Amigos (${friendships.friends.length})`, `Momentos ↗`, `Listas ↗`, `🎁 SaveState Wrapped ↗`.
3. **Sistema de Vistas por Pestañas (`ProfileContentTabs`) para Biblioteca vs. Analíticas**:
   - Colocar el **Top 4 Favoritos** y el **Resumen (`PlayerSummary`)** siempre visibles como escaparate principal.
   - Debajo, un selector de pestañas interactivo (`client component` ligero) que permita alternar sin scroll infinito entre:
     - **🎮 Biblioteca (`#player-library`)** *(Pestaña activa por defecto para acceso inmediato a los juegos)*
     - **📊 Dossier y Estadísticas (`#player-stats` / `#player-dossier`)** *(Contiene `StatsDossier` y `PlayerStatistics`)*
     - **🏆 Vitrina y Memory Card (`#player-showcase`)** *(Contiene `AchievementsShowcase` y `MemoryCardExport`)*
   - Si el usuario hace clic en un hash (`#player-stats`, `#player-dossier`, `#player-library`), el componente selecciona automáticamente la pestaña correspondiente.
