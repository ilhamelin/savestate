# Propuesta Técnica: Sincronización de Logros de Steam y Barra de Progreso en Biblioteca

**Fecha:** 9 de octubre de 2026  
**Rama:** `research/antigravity`  
**Origen:** Investigación y Auditoría (`research/antigravity`)  
**Destino:** Equipo de Implementación (`implementation/chatgpt` / Codex)  
**Propósito:** Especificar la arquitectura, migración de base de datos e integración con la API de Steam para sincronizar logros y mostrar una barra de progreso porcentual (`X / Y logros (Z%)`) en títulos de PC / Steam, unificando la experiencia visual con Xbox y PlayStation.

---

## 1. Contexto y Objetivos

Con la barra de Gamerscore (Xbox) y Trofeos (PlayStation) ya implementada en `src/components/console-progress-badge.tsx`, la biblioteca presenta una asimetría:
* **Juegos de consola:** Muestran su insignia con puntos/trofeos y barra de progreso neón, pero 0 horas automáticas.
* **Juegos de Steam:** Muestran sus horas reales calculadas (`4856.9 h`), pero ninguna indicación de logros desbloqueados.

El objetivo de esta propuesta es extender el modelo de progreso para admitir **Steam Achievements**, permitiendo que los juegos de PC muestren tanto sus **horas acumuladas** como su **barra de logros**.

---

## 2. Nueva Migración SQL: `202610090019_steam_achievements_progress.sql`

La restricción actual en `play_logs` solo admite `'gamerscore'` y `'trophies'`. Esta migración amplía el chequeo para admitir `'achievements'`:

```sql
begin;

-- Ampliar el tipo de progreso para incluir logros de Steam (PC)
alter table public.play_logs drop constraint if exists play_logs_console_progress_check;
alter table public.play_logs add constraint play_logs_console_progress_check check (
  console_progress is null or (
    jsonb_typeof(console_progress) = 'object'
    and console_progress ?& array['kind','current','total']
    and console_progress->>'kind' in ('gamerscore','trophies','achievements')
    and jsonb_typeof(console_progress->'current') = 'number'
    and jsonb_typeof(console_progress->'total') = 'number'
    and (console_progress->>'current')::numeric between 0 and 10000000
    and (console_progress->>'total')::numeric between 1 and 10000000
    and trunc((console_progress->>'current')::numeric) = (console_progress->>'current')::numeric
    and trunc((console_progress->>'total')::numeric) = (console_progress->>'total')::numeric
  )
);

commit;
```

---

## 3. Integración con la API de Steam

### 3.1. Endpoint Oficial de Valve
* **URL:** `https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v0001/`
* **Parámetros:**
  * `key`: `process.env.STEAM_API_KEY` (ya configurada en el servidor).
  * `steamid`: Steam ID 64 del usuario (almacenado en `profiles.steam_id`).
  * `appid`: ID del juego en Steam (almacenado en la nota de `play_logs` como `[Steam lifetime:XXXX]`).

### 3.2. Función en `src/integrations/steam/server.ts`
```typescript
export interface SteamAchievementSummary {
  kind: 'achievements';
  current: number;
  total: number;
}

export async function fetchSteamAchievements(
  steamid: string,
  appid: number,
): Promise<SteamAchievementSummary | null> {
  const key = process.env.STEAM_API_KEY;
  if (!key) return null;

  try {
    const url = new URL('https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v0001/');
    url.search = new URLSearchParams({
      appid: String(appid),
      steamid,
      key,
    }).toString();

    const response = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(6000),
    });

    if (!response.ok) return null;
    const data = await response.json();
    const stats = data?.playerstats;

    if (!stats || !stats.success || !Array.isArray(stats.achievements)) {
      return null;
    }

    const total = stats.achievements.length;
    if (total === 0) return null;

    const current = stats.achievements.filter(
      (a: { achieved: number }) => a.achieved === 1,
    ).length;

    return {
      kind: 'achievements',
      current,
      total,
    };
  } catch {
    return null;
  }
}
```

---

## 4. Estrategia de Sincronización (Rendimiento Seguro)

Dado que `GetPlayerAchievements` requiere una petición por juego individual (a diferencia de `GetOwnedGames` que trae todos a la vez):

1. **Sincronización Bajo Demanda en Biblioteca (Recomendada):**
   * En `src/components/library.tsx`, en las tarjetas de juegos con plataforma `'PC / Steam'` que tengan el identificador en la nota (`[Steam lifetime:XXXX]`) pero aún no tengan `console_progress`:
     * Mostrar un botón secundario discreto: `[ 🏆 Sincronizar logros de Steam ]`.
     * Al hacer clic, invoca una Server Action / endpoint que consulta ese juego específico en ~300 ms y persiste el resultado en `play_logs.console_progress`.
2. **Sincronización Automática Selectiva al Re-sincronizar Steam:**
   * Al ejecutar la sincronización de Steam, limitar la consulta automática de logros a los juegos que tengan **horas jugadas activas** (`playtime_forever > 0`) para no sobrecargar la cuota de peticiones con juegos del backlog que nunca se han iniciado.

---

## 5. Actualización del Componente Visual (`console-progress-badge.tsx`)

En `src/components/console-progress-badge.tsx`, adaptar la función de etiqueta y estilos para soportar `'achievements'`:

```typescript
export function consoleProgressLabel(progress: ConsoleProgress): string {
  if (progress.kind === 'gamerscore') {
    return `Gamerscore: ${progress.current} / ${progress.total} G`;
  }
  if (progress.kind === 'trophies') {
    return `Trofeos: ${progress.current} / ${progress.total}`;
  }
  if (progress.kind === 'achievements') {
    const percent = Math.round((progress.current / progress.total) * 100);
    return `Logros: ${progress.current} / ${progress.total} (${percent}%)`;
  }
  return '';
}
```

* **Renderizado:**
  * Plataforma: `PC / Steam`
  * Título: `Logros · Steam`
  * Cifras: `28 / 45 logros`
  * Barra de progreso: Porcentaje visual neón idéntico al de consolas.

---

## 6. Plan de Ejecución para Codex

1. Proporcionar el script de migración SQL `202610090019_steam_achievements_progress.sql` para aplicar en Supabase.
2. Añadir `fetchSteamAchievements` en `src/integrations/steam/server.ts`.
3. Actualizar `src/domain/console-progress.ts` y tipos para admitir `kind: 'achievements'`.
4. Incorporar la acción de sincronización de logros en la biblioteca (`/library`) para partidas de Steam.
5. Actualizar `src/components/console-progress-badge.tsx` para renderizar la barra de logros de Steam.
6. Verificar con `npm run check`.
