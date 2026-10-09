# Propuesta Técnica: Importación de Horas Reales en PlayStation Network (PSN)

**Fecha:** 9 de octubre de 2026  
**Origen:** Auditoría e Investigación (`research/antigravity`)  
**Destino:** Equipo de Implementación (`implementation/chatgpt` / Codex)  
**Propósito:** Especificar la integración del servicio de historial de juegos jugados de PlayStation (`getUserPlayedGames`) para importar las horas reales de juego (`playDuration`) en PS5 y PS4, eliminando el valor predeterminado de 0 horas.

---

## 1. Justificación y Diagnóstico

En la primera versión del importador de PlayStation, los títulos se importaban con `hours: 0` debido a que se utilizaba exclusivamente el endpoint `getUserTitles()` de `psn-api`. Este endpoint consulta únicamente el **Trophy Service de Sony**, el cual contiene trofeos y platinos pero carece del atributo de duración de juego.

La investigación confirmó que la API de PlayStation **sí expone las horas exactas de juego** a través de su servicio de títulos jugados (`getUserPlayedGames`), el cual retorna para cada juego:
* `playDuration`: Cadena de duración ISO-8601 con precisión de segundos (ej: `"PT72H23M32S"` = 72 horas, 23 minutos y 32 segundos).
* `firstPlayedDateTime`: Fecha y hora de la primera sesión.
* `lastPlayedDateTime`: Fecha y hora de la sesión más reciente.
* `playCount`: Número total de veces que se ha iniciado el juego.
* `category`: Categoría nativa (`ps5_native_game`, `ps4_game`, `pspc_game`, etc.).

---

## 2. Arquitectura de la Solución

### 2.1. Conversor de Duración ISO-8601 a Horas Decimales
En `src/domain/console-sync.ts`:
```ts
export function parseIsoDuration(duration: unknown): number {
  if (typeof duration !== 'string' || !duration.startsWith('PT')) return 0;
  const match = duration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return 0;
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  const total = hours + minutes / 60 + seconds / 3600;
  return Math.round(total * 100) / 100;
}
```

### 2.2. Fusión de Trofeos y Horas Jugadas (`server.ts`)
En `src/integrations/consoles/server.ts`, dentro de `fetchPsnTitles(onlineId)`:
1. Se consulta en paralelo (o secuencialmente) el servicio de juegos jugados y el de trofeos:
   ```ts
   const [playedGames, trophyTitles] = await Promise.all([
     getUserPlayedGames(auth, accountId, { limit: 100 }).catch(() => null),
     getUserTitles(auth, accountId, { limit: 100, offset: 0 }),
   ]);
   ```
2. Se construye un mapa de horas por título normalizado (`normalized(title) -> hours`):
   ```ts
   const playtimeByTitle = new Map<string, number>();
   if (playedGames?.titles && Array.isArray(playedGames.titles)) {
     for (const item of playedGames.titles) {
       if (item.category?.includes('media_app')) continue; // Excluir Netflix, YouTube, etc.
       const hours = parseIsoDuration(item.playDuration);
       if (item.name) playtimeByTitle.set(normalized(item.name), hours);
     }
   }
   ```
3. Al mapear las filas de títulos (`psnTitleRows`), se asignan las horas correspondientes en lugar de `0`:
   ```ts
   const hours = playtimeByTitle.get(normalized(title)) ?? 0;
   ```
4. De esta manera, el usuario obtiene:
   * **Platinos y estados completados** (del servicio de trofeos).
   * **Horas reales jugadas** (del servicio de juegos jugados).
   * **Soporte retro** para PS3/Vita/PSP (del servicio de trofeos).

---

## 3. Plan de Modificaciones de Archivos

1. **`src/domain/console-sync.ts`**:
   - Agregar y exportar `parseIsoDuration(duration: unknown): number`.
   - Permitir que `psnTitleRows` reciba un mapa opcional de horas (`playtimes?: Map<string, number>`).
2. **`src/integrations/consoles/server.ts`**:
   - Importar `getUserPlayedGames` desde `psn-api`.
   - Consultar `getUserPlayedGames(auth, accountId)` y extraer el mapa de horas.
   - Pasar el mapa a `psnTitleRows(titles, playtimes)`.
3. **`src/components/console-importer.tsx`**:
   - Actualizar el mensaje informativo para indicar que las horas de PlayStation ahora se importan automáticamente cuando están disponibles en el perfil.
4. **`tests/unit/console-sync.test.ts`**:
   - Añadir tests unitarios para `parseIsoDuration` (probando `"PT72H23M32S"`, `"PT2H25M"`, `"PT45M"`, `""`, y casos inválidos).

---

## 4. Criterios de Aceptación
1. Al sincronizar un perfil PSN como `Cristian131x`, juegos como *Roblox* o *God of War* muestran sus horas reales (ej. `72.39 h`, `2.43 h`) en lugar de `0`.
2. Las aplicaciones multimedia (Netflix, YouTube, Spotify) quedan descartadas automáticamente.
3. Si el perfil tiene el historial de horas privado en PlayStation, el importador no falla y conserva `0 h` con fallback seguro.
4. `npm run check` pasa con 0 errores (typecheck, lint, pruebas unitarias y formato).
