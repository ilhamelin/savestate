# Propuesta Técnica: Sincronización Automática de Consolas (PSN & Xbox Live) y Emparejamiento Masivo

**Fecha:** 9 de octubre de 2026  
**Origen:** Auditoría e Investigación (`research/antigravity`)  
**Destino:** Equipo de Implementación (`implementation/chatgpt` / Codex)  
**Propósito:** Solucionar el bloqueo de consulta en Xbox Live (OpenXBL) e incorporar el emparejamiento masivo automático (*Auto-Match*) para los catálogos de PlayStation y Xbox en el importador de consolas.

---

## 1. Diagnóstico de Problemas Detectados

### 1.1. Error en Xbox Live ("No se pudo consultar Xbox" al buscar `ilhamelin`)
1. **Endpoint incorrecto en OpenXBL v2:**
   - En `src/integrations/consoles/server.ts`, la llamada se realizaba a `friends/search/${identity}`, pero la API de OpenXBL v2 requiere parámetros de consulta: `friends/search?gt=${encodeURIComponent(identity)}`.
2. **Estructura de respuesta no coincidente:**
   - La función `exactXboxAccount` en `src/domain/console-sync.ts` esperaba `input.people`. Sin embargo, la respuesta real de OpenXBL v2 devuelve:
     ```json
     {
       "content": {
         "profileUsers": [
           {
             "id": "2535436457611225",
             "settings": [
               { "id": "Gamertag", "value": "ilhamelin" }
             ]
           }
         ]
       }
     }
     ```
   - Al no encontrar `people`, arrojaba un `ValidationError` interno que se traducía en HTTP 502 ("No se pudo consultar Xbox").
3. **Encabezado `Accept-Language` en peticiones a `achievements/player/{xuid}`:**
   - OpenXBL rechaza encabezados `Accept-Language` con valor wildcard `*` o no configurados con error HTTP 400 (`"Request contains Accept-Language header with invalid locale value"`). Es obligatorio enviar explicitamente `'Accept-Language': 'en-US'` y `'Accept': 'application/json'`.
4. **Envoltura `content` en títulos de Xbox:**
   - La respuesta de `/achievements/player/{xuid}` viene dentro de `{ content: { titles: [...] } }`. El parser debe admitir tanto `input.titles` como `input.content.titles`.

### 1.2. Fricción en PlayStation / Xbox: Búsqueda Manual Juego por Juego
- Tras sincronizar con éxito el perfil PSN (ej: `Cristian131x`), se cargan hasta 200 títulos.
- Actualmente el usuario debe hacer clic en "Buscar coincidencias" en cada fila individualmente y desplegar un `<select>` para elegir la edición.
- **Solución requerida:** Un botón y mecanismo de **Emparejamiento Masivo Automático** (`autoMatchAll`) que recorra en lote todos los juegos pendientes, consulte el catálogo de IGDB (`action: 'match'`), auto-seleccione la mejor coincidencia exacta o más relevante, y habilite de inmediato el botón de importación masiva (`Importar X juegos confirmados`).

---

## 2. Arquitectura de la Solución

### 2.1. Corrección OpenXBL (`server.ts` y `console-sync.ts`)
1. **Petición HTTP Robusta:**
   - En `xboxRequest`, añadir explícitamente `'Accept-Language': 'en-US'`.
   - Modificar la URL de búsqueda a `friends/search?gt=${encodeURIComponent(identity)}`.
2. **Parser Tolerante de Cuentas Xbox:**
   - `exactXboxAccount` debe comprobar tanto `input.people` como `(input.content?.profileUsers || input.profileUsers)`.
   - Extraer el XUID desde `user.id` o `user.xuid`, y comparar el gamertag buscando en `user.settings.find(s => s.id === 'Gamertag')?.value` o en `user.gamertag`.
3. **Parser de Títulos:**
   - `xboxTitleRows` debe recibir `input.content?.titles || input.titles || input`.
   - Para títulos de PC/Xbox donde `devices` contiene `PC` o plataformas cruzadas, asignar `'Xbox One'` o `'Xbox Series X|S'` según corresponda para que ningún juego válido quede descartado.

### 2.2. Emparejamiento Masivo Automático en Interfaz (`console-importer.tsx`)
1. **Función `autoMatchAll`:**
   - Filtra filas activas (`row.selected && !row.gameId && !row.done`).
   - Itera de forma secuencial o en pequeños lotes concurrentes (concurrencia de 2 a 3 para optimizar velocidad y evitar rate-limits de IGDB).
   - Para cada juego, invoca `api('consoles/import', { action: 'match', source, title: row.title })`.
   - Si se reciben candidatos (`found.games.length > 0`):
     - Busca coincidencia exacta por título normalizado (`c.title.toLowerCase() === row.title.toLowerCase()`).
     - Si no hay exacta, selecciona el primer candidato `found.games[0]`.
     - Actualiza el estado de la fila: `gameId: candidate.id`, `choices: found.games`, `result: 'Emparejado automáticamente'`.
   - Informa el progreso en tiempo real (`Emparejando 45 / 200 juegos…`).
2. **Controles de UI:**
   - Botón visible `[ ⚡ Emparejar todo automáticamente ]` junto a `Seleccionar todos`.
   - Botón secundario `Detener` para interrumpir el proceso si el usuario lo desea.
   - Posibilidad de disparar el auto-emparejamiento opcionalmente tras completar la sincronización directa.

---

## 3. Plan de Modificaciones de Archivos

1. **`src/integrations/consoles/server.ts`**:
   - Ajustar headers en `xboxRequest` (`Accept-Language: 'en-US'`).
   - Endpoint de búsqueda: `friends/search?gt=${encodeURIComponent(identity)}`.
   - Desempaquetar `titles.content?.titles ?? titles.titles`.

2. **`src/domain/console-sync.ts`**:
   - Adaptar `exactXboxAccount` para soportar `profileUsers` con `settings` de OpenXBL v2.
   - Robustecer `xboxTitleRows` para soportar estructuras de dispositivos mixtos.

3. **`src/components/console-importer.tsx`**:
   - Añadir estado y lógica de `autoMatchAll()`.
   - Añadir botón de acción `⚡ Emparejar todo automáticamente`.
   - Mostrar indicador de progreso de emparejamiento.

4. **Verificación y Calidad**:
   - Ejecutar `npm run check` (TypeScript, ESLint, 48 tests unitarios).
   - Probar sincronización en vivo con PSN (`Cristian131x`) y Xbox (`ilhamelin`).
