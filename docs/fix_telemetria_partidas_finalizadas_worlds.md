# Diagnóstico y Corrección: Telemetría en Cero de la Partida 2 de Worlds

## 1. Causa Raíz Exacta del Problema

En las capturas proporcionadas por el usuario (`media_1792097265792_0afc0aec.png` y `media_1792097276197_7d6220f7.png`), el Juego 2 de KC vs C9 muestra:
- `👾 0:01`
- `Oro Total: 0.0k vs 0.0k`
- `Asesinatos Totales: 0 vs 0`
- Campeones en nivel 1 con 0 CS y 0 estadísticas.
- Etiqueta `Datos en vivo` (pese a que el Juego 2 ya finalizó y se está disputando el Juego 3).

### ¿Por qué ocurrió esto?
Al inspeccionar el código de `src/services/worlds-esports.ts` (líneas 154-163):
```ts
let last = first;
if (firstTs) {
  const iso = (ms: number) =>
    new Date(Math.floor(ms / 10000) * 10000).toISOString().replace(/\.\d{3}Z$/, 'Z');
  try {
    last = await feedWindow(game.id, iso(Date.parse(firstTs) + 7200000)); // <-- ¡ERROR AQUÍ!
  } catch {
    if (game.state === 'inProgress')
      last = await feedWindow(game.id, iso(Date.now() - 30000)).catch(() => first);
  }
}
```
1. **El salto ciego de +2 horas (`+ 7200000 ms`):**
   El código intentaba pedir la ventana de telemetría a Riot en `firstTs + 2 horas`. Como ninguna partida de LoL dura 2 horas (el Juego 2 duró 37 minutos), a las 2 horas no existe ningún frame, por lo que la API de Riot devolvía error `404 / BAD_QUERY_PARAMETER`.
2. **El catch ignoraba partidas completadas:**
   Al fallar la petición de las 2 horas, el bloque `catch` solo intentaba pedir los datos en vivo si `game.state === 'inProgress'`. Como el Juego 2 ya estaba en estado `'completed'`, el `catch` no hacía nada y dejaba `last = first`.
3. **`first` es el frame del minuto 00:00:**
   La variable `first` almacena la primera ventana de la partida (minuto `0:01`), con todos los campeones recién aparecidos en la fuente, nivel 1 y 0 de oro.
4. Por lo tanto, el sistema terminaba parseando y guardando ese frame inicial en lugar de las estadísticas finales de la partida.

---

## 2. Validación con la API Real de Riot Games

Hemos probado en vivo contra la API de Riot para el Juego 2 (`gameId: 115660588583171788`):
- Consultando con `startingTime = start + 45 min`:
  - **Resultado:** ¡Éxito inmediato (HTTP 200)!
  - **Timestamp final:** `2026-10-15T19:51:45.980Z`
  - **Estado:** `gameState: finished`
  - **Oro final:** 66,346 (Azul) vs 68,966 (Rojo)
  - **Kills finales:** 16 vs 14
- Consultando para el Juego 1 (`gameId: 115660588583171787`):
  - **Resultado:** ¡Éxito inmediato (HTTP 200)!
  - **Kills finales:** 1 vs 20 (Victoria contundente).

---

## 3. Solución Técnica

### En `src/services/worlds-esports.ts`:
Reemplazar la llamada estática de `+ 7200000` por una función adaptativa `resolveGameTelemetryWindow`:
1. Si `game.state === 'inProgress'`, solicita `Date.now() - 30000` (tiempo real).
2. Si el juego finalizó (`game.state !== 'inProgress'` o si el mapa ya terminó), busca la ventana final probando los desfases típicos de finalización de mapa `[45m, 35m, 40m, 50m, 30m, 25m, 55m, 60m]`. Al encontrar el frame con `gameState === 'finished'` o con oro consolidado, lo toma inmediatamente.
3. Almacena en `telemetryCache` con TTL de 7 días.

### En `src/domain/worlds-telemetry.ts`:
Mejorar `hasWorldsTelemetryMetrics(value)` para que no considere válido un frame con 0 oro y 0 kills de 1 segundo de duración:
```ts
export function hasWorldsTelemetryMetrics(value: WorldsGameTelemetry): boolean {
  return (
    (value.durationSeconds ?? 0) > 120 ||
    value.blueTeam.totalGold > 5000 ||
    value.redTeam.totalGold > 5000 ||
    value.blueTeam.totalKills > 0 ||
    value.redTeam.totalKills > 0 ||
    value.gameState === 'finished'
  );
}
```
Así, un frame vacío de inicio de partida jamás sobreescribirá una partida terminada.
