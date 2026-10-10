# Especificación Técnica: Vista Dedicada Rift Tracker y Analíticas Avanzadas (Roles y Top Champions)

**Versión:** 2.0  
**Fecha:** 10 de octubre de 2026  
**Área:** Navegación Global (`Navbar`), Nueva Vista `/rift`, Filtros de Cola y Analíticas de Jugador  
**Destino:** Implementación en Savestate (`savestate 2` / Codex)  

---

## 1. Visión del Requerimiento

El usuario solicita:
1. **Mover el "Rift Tracker" a una vista dedicada accesible desde el Navbar**:
   - Crear la ruta `/rift` con un enlace directo en el menú de navegación (`Header`).
2. **Selector / Filtro de Tipos de Partida**:
   - Botones estilo arcade para filtrar el historial por cola:
     - `Todas`
     - `Solo/Dúo` (queueId 420)
     - `Normales` (queueId 400 / 430)
     - `ARAM` (queueId 450)
     - `Otros / Caos` (Arena, URF, etc.)
3. **Panel Lateral de Analíticas (Inspirado en OP.GG)**:
   - **ROLES**:
     - Posición jugada (*Top, Middle, Jungle, Bottom, Utility*).
     - Winrate % con barra circular o barra de progreso.
     - Victorias // Derrotas (`2 W // 0 L`).
     - KDA ratio (`3.42 KDA`) y promedio de asesinatos/muertes/asistencias.
   - **TOP CHAMPIONS**:
     - Miniatura oficial del campeón.
     - Nombre del campeón.
     - Winrate % y desglose W // L.
     - KDA ratio y promedio K/D/A.

---

## 2. Navegación Global (`src/components/header.tsx` y `command-menu.tsx`)

Añadir en el menú de navegación principal:
```tsx
<Link href="/rift">Rift</Link>
```
Y en el Command Menu (`Ctrl+K`):
* Comando: *"Rift Tracker (League of Legends)"* -> lleva a `/rift`.

---

## 3. Lógica de Analíticas en el Dominio (`src/domain/lol-tracker.ts`)

Con los datos ya existentes en `LolMatchSummary`, se agregan dos funciones puras de cálculo:

### 3.1. Cálculo de Roles (`computeRoleAnalytics`)
Normaliza la posición del jugador (`TOP`, `JUNGLE`, `MIDDLE`, `BOTTOM`, `UTILITY`):
```typescript
export interface RoleStat {
  role: string;
  label: string;
  games: number;
  wins: number;
  losses: number;
  winrate: number;
  kills: number;
  deaths: number;
  assists: number;
  kdaRatio: number;
}
```

### 3.2. Cálculo de Top Champions (`computeTopChampions`)
Agrupa las partidas del jugador por `championName`:
```typescript
export interface ChampionStat {
  name: string;
  icon: string | null;
  games: number;
  wins: number;
  losses: number;
  winrate: number;
  kills: number;
  deaths: number;
  assists: number;
  kdaRatio: number;
}
```

---

## 4. Filtro de Partidas por Cola (`queueId`)

Mapeo de colas estándar de League of Legends:
* **Solo/Dúo:** `match.queueId === 420`
* **Flexible:** `match.queueId === 440`
* **Normales:** `match.queueId === 400 || match.queueId === 430`
* **ARAM:** `match.queueId === 450`
* **Otros:** Todos los demás modos.

En la UI, una barra de botones con estado activo:
`[ Todas ]  [ Solo/Dúo ]  [ Normales ]  [ ARAM ]  [ Otros ]`

---

## 5. Nueva Vista `/rift` (`src/app/rift/page.tsx`)

Layout dividido en dos columnas responsivas:
* **Columna Principal (Izquierda / 65%):**
  * Buscador (Riot ID + Servidor).
  * Ficha de Invocador con rangos Solo/Dúo y Flex.
  * Barra de filtros de partidas.
  * Historial de partidas filtrado.
* **Columna Lateral (Derecha / 35%):**
  * **Tarjeta "ROLES"**: Muestra el rendimiento por línea jugada.
  * **Tarjeta "TOP CAMPEONES"**: Muestra los campeones con mejor rendimiento de las partidas analizadas.

---

## 6. Estilos en `src/app/globals.css`

* `.rift-layout`: Cuadrícula responsiva de dos columnas (1fr en móvil, `minmax(0, 1.8fr) minmax(320px, 1fr)` en desktop).
* `.rift-roles-card`, `.rift-top-champs-card`: Paneles oscuros con bordes retro, barras de progreso y tipografía mono para las estadísticas.
* `.rift-queue-filter`: Botones outline con acento al seleccionarse.
