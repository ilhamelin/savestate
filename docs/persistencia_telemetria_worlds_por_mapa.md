# Especificación Técnica: Persistencia Permanente de Telemetría por Mapa de Worlds

## 1. Problema Identificado

Durante las series Bo3 / Bo5 de Worlds 2026 (por ejemplo, el enfrentamiento C9 vs KC con 2 partidas finalizadas y la 3ª en juego):
1. **Pérdida de datos en mapas finalizados:**
   La API de Riot Games (`feed.lolesports.com/livestats/v1/window/{gameId}`) ofrece telemetría en tiempo real mientras el mapa está activo. Sin embargo, minutos después de que un mapa termina, Riot frecuentemente corta o vacía los frames de ese juego o devuelve errores `404/403/timeout`.
2. **Sobreescritura destructiva:**
   Cada 30 segundos, el cliente (`WorldsHub`) consulta `/api/worlds/{matchId}`. Si la respuesta del servidor no puede contactar a Riot para el Juego 1 o Juego 2, devuelve `null` en `gameTelemetry[1]`, borrando los datos que el usuario ya había recibido en pantalla y mostrando *"Esperando datos oficiales / El feed no tiene datos disponibles"*.

---

## 2. Solución de Persistencia en 2 Capas (Cliente + Servidor)

```
┌────────────────────────────────────────────────────────────────────────┐
│  📡 API Riot Live Feed (feed.lolesports.com)                           │
│  [Juego 1: Finished]    [Juego 2: Finished]    [Juego 3: In Progress]  │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│  🛡️ SERVIDOR (src/services/worlds-esports.ts)                          │
│  - telemetryCache con TTL extendido (7 días para juegos terminados).  │
│  - Fallback a la última telemetría conocida si Riot da error/404.     │
│  - Merge no destructivo de mapas pasados en fetchWorldsMatchDetail.    │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│  💾 CLIENTE / WEB (src/components/worlds-performance.tsx)              │
│  - Persistencia local en localStorage:                                 │
│    `savestate_worlds_telemetry_${matchId}`                             │
│  - Retención en memoria: si un mapa ya recibió datos completos,        │
│    NUNCA se borra ni se sobreescribe con null.                         │
│  - Badge visual: `[✓ Mapa finalizado · Registro guardado]`             │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Especificación Detallada de Cambios

### A. Persistencia en Cliente (`src/components/worlds-performance.tsx`)

1. **Gestión de Almacenamiento Local (`localStorage`):**
   - Clave de almacenamiento: `savestate_worlds_telemetry_${matchId}`.
   - Estado local reactivo: `const [savedTelemetry, setSavedTelemetry] = useState<Record<number, WorldsGameTelemetry>>({});`.
   - Al montar el componente o cambiar `detail?.id`:
     - Cargar del `localStorage` las telemetrías previamente guardadas para esta serie.
   - Cada vez que `detail?.gameTelemetry` proporcione datos válidos (`totalGold > 0` o `durationSeconds > 0`):
     - Fusionar la nueva telemetría con `savedTelemetry`.
     - Si la telemetría actual tiene mayor duración o está finalizada, prevalece y se guarda en `localStorage`.

2. **Resolución de Telemetría Activa:**
   - `const activeTelemetry = detail?.gameTelemetry?.[selected] ?? savedTelemetry[selected] ?? null;`
   - Si la API en vivo no devuelve datos para el Juego 1 (porque ya terminó hace 1 hora), `activeTelemetry` utiliza los datos guardados de `savedTelemetry[1]`.
   - **Resultado:** ¡Los datos de los Juegos 1 y 2 permanecen visibles para siempre!

3. **Indicador Visual de Registro Guardado:**
   - Si el mapa está finalizado o guardado:
     ```tsx
     <span className="tag worlds-tag-saved">
       {isLive ? '● Datos en vivo' : '✓ Mapa finalizado · Registro guardado'}
     </span>
     ```

---

### B. Retención y Fallback en Servidor (`src/services/worlds-esports.ts`)

1. **`gameTelemetry(game)`:**
   - Si `feedWindow` lanza un error (Riot cortó el feed) o retorna frames vacíos:
     - Consultar `telemetryCache.get(game.id)`. Si existe un valor previo, **retornarlo en lugar de null**.
   - Para mapas con `gameState === 'finished'`:
     - Establecer `expires = Date.now() + 7 * 86400 * 1000` (7 días de retención).

2. **`fetchWorldsMatchDetail(matchId)`:**
   - Al fusionar `detail.gameTelemetry`:
     ```ts
     const previous = detailsCache.get(matchId)?.value;
     for (const game of telemetry) {
       if (game) detail.gameTelemetry[game.gameNumber] = game;
     }
     // Si un mapa anterior ya tenía telemetría y la nueva petición devolvió null, conservar la previa:
     if (previous?.gameTelemetry) {
       for (const [num, tel] of Object.entries(previous.gameTelemetry)) {
         const k = Number(num);
         if (!detail.gameTelemetry[k] && tel) {
           detail.gameTelemetry[k] = tel;
         }
       }
     }
     ```
