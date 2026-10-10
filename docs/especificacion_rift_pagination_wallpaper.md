# Especificación Técnica: Paginación ("Cargar Más Partidas") y Fondo/Wallpaper por Defecto en Rift Tracker

**Versión:** 4.0  
**Fecha:** 10 de octubre de 2026  
**Área:** Paginación de Historial, Rendimiento de API y Ambientación Visual de `/rift`  
**Destino:** Implementación en Savestate (`savestate 2` / Codex)  

---

## 1. Visión General de los Nuevos Agregados

1. **Paginación Dinámica ("Cargar más partidas"):**
   - La búsqueda inicial carga 10 partidas para mantener la consulta rápida (<2s) y segura frente al rate limit de Riot Games.
   - Al fondo del listado de partidas, se agrega el botón:
     `[ 🔄 Cargar 10 partidas más ]`
   - Al hacer clic, consulta las siguientes 10 partidas (`start: 10, count: 10`), luego de 20 a 30, acumulando el historial.
   - Las analíticas de **ROLES** y **TOP CHAMPIONS** se recalculan dinámicamente con todo el historial acumulado.
2. **Wallpaper / Fondo Temático por Defecto:**
   - Al igual que en el perfil del jugador (`/players/[username]`), la vista `/rift` contará con un fondo ambiental decorativo (`ProfileWallpaper` con `/wallpapers/neon_cyberpunk.svg` o arte temático con capa oscura y scanlines) para que no se sienta una pantalla negra vacía.

---

## 2. API Backend (`src/app/api/tracker/lol/inspect/route.ts` o `route.ts`)

Soporte para parámetros de paginación:
* **Entrada:** `{ riotId: string, platform: string, start?: number, count?: number }` (por defecto `start: 0, count: 10`).
* **Lógica:**
  - Consulta `matchIds` con `?start=${start}&count=${count}`.
  - Obtiene los detalles de esas `N` partidas.
  - Devuelve:
    ```json
    {
      "matches": [...],
      "hasMore": true,
      "nextStart": start + count
    }
    ```

---

## 3. UI y Experiencia de Usuario (`src/app/rift/page.tsx`)

### 3.1. Wallpaper de Fondo
Envolvemos la vista principal con el componente existente de Savestate:
```tsx
<ProfileWallpaper url="/wallpapers/neon_cyberpunk.svg" fullScreen>
  <div className="rift-container">
    {/* Contenido de Rift Tracker */}
  </div>
</ProfileWallpaper>
```

### 3.2. Botón "Cargar Más Partidas"
Al pie de la columna de partidas:
```tsx
{hasMore ? (
  <div className="rift-load-more">
    <button
      type="button"
      className="button outline"
      disabled={loadingMore}
      onClick={handleLoadMore}
    >
      {loadingMore ? '⏳ Cargando más partidas...' : '🔄 Cargar 10 partidas más'}
    </button>
  </div>
) : null}
```
* **Estado de Carga:** Deshabilita el botón mientras se realiza la consulta para evitar doble click o saturación.
* **Acumulación:** `setMatches((prev) => [...prev, ...newMatches])`.
* **Recálculo Automático:** Los paneles laterales de ROLES y TOP CHAMPIONS reflejan el total de partidas acumuladas.
