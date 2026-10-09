# Propuesta Técnica: Gestión de Horas en Importación de Consolas (Xbox & PlayStation) y Mejoras de UX

**Fecha:** 9 de octubre de 2026  
**Rama:** `research/antigravity`  
**Origen:** Auditoría e Investigación (`research/antigravity`)  
**Destino:** Equipo de Implementación (`implementation/chatgpt` / Codex)  
**Propósito:** Explicar las limitaciones de las APIs de consolas respecto al tiempo de juego y proponer soluciones de interfaz para asignar, editar en lote y actualizar horas de juegos de Xbox y PlayStation en SaveState.

---

## 1. Diagnóstico Técnico: ¿Por qué Steam tiene horas y Xbox/PlayStation 0.0 h?

### 1.1. Diferencia Arquitectónica entre APIs

| Plataforma | Endpoint Utilizado | Datos que Suministra la API | ¿Incluye Horas Jugadas? |
|---|---|---|---|
| **Steam** | `IPlayerService/GetOwnedGames` | Catálogo completo con licencias, carátulas y minutos. | **SÍ (`playtime_forever`).** Valve mide y expone el tiempo de juego exacto acumulado para cada título. |
| **Xbox Live (OpenXBL)** | `/achievements/player/{xuid}` | Lista de títulos con Gamerscore y logros desbloqueados. | **NO.** El servicio público de logros no incluye el campo de tiempo jugado. |
| **PlayStation (PSN)** | `/getUserTitles` (Trophy API) | Lista de títulos con trofeos (Bronce, Plata, Oro, Platino) y progreso. | **NO.** La API de trofeos no contiene la métrica de horas. |

### 1.2. Limitaciones de Hardware y Generaciones Legacy
* **Xbox 360, PS3, PS Vita y PSP:** Los servidores de Microsoft y Sony **nunca almacenaron tiempo de juego** para estas consolas. No existe ninguna API que pueda devolver las horas de títulos de Xbox 360 o PS3 porque esa métrica no existe en sus nubes.
* **Xbox One / Series:** Microsoft almacena horas en el servicio *User Stats / Title Hub* (`MinutesPlayed`), pero requiere una llamada HTTP individual por cada juego. Consultar 200 juegos agotaría instantáneamente los límites de tasa de OpenXBL (150 req/hora).
* **PS5:** Sony solo mide horas en PS5 a través de un endpoint privado de GraphQL (`userPlaySummary`), el cual está protegido por estrictas políticas de privacidad de cuenta.

### 1.3. Por qué el importador asigna 0 horas en el código
En `src/domain/console-sync.ts` (líneas 120–125):
```typescript
rows.push({
  title: title.trim(),
  platform,
  hours: 0, // <-- Al no existir en el payload de logros/trofeos, se inicializa en 0
  status: complete ? 'cleared' : 'playing',
});
```
Al sincronizar automáticamente, los 200 títulos se cargan con `hours: 0`. Al pulsar *"Importar juegos confirmados"*, la base de datos registra en `play_logs` la plataforma (`Xbox 360`, `Xbox One`, etc.) con `hours_played = 0.00`. Por eso las métricas muestran 231 partidas de hardware, pero el 100% de las horas computadas provienen de Steam.

---

## 2. Soluciones de UX / UI Propuestas

Para resolver la fricción del usuario sin depender de APIs externas inexistentes, se proponen las siguientes tres mejoras:

---

### A. Banner Informativo Transparente en el Importador (`console-importer.tsx`)
* **Problema:** El usuario asume que la web falló al no traer sus horas de Xbox o PlayStation.
* **Solución:** Mostrar un aviso explicativo tipo terminal antes y después de sincronizar:
  > *"ℹ️ A diferencia de Steam, las APIs públicas de Xbox y PlayStation solo exponen listas de logros y trofeos; no transmiten horas de juego (y consolas como Xbox 360 o PS3 no las registraban en la nube). Se importarán con 0 h por defecto, pero puedes editarlas en la tabla o asignar un estimado en lote."*

---

### B. Herramienta de Asignación de Horas en Lote (*Bulk Hours Tool*)
* **Problema:** En una lista de 200 títulos sincronizados, es inviable que el usuario edite el input de horas de 10 en 10 páginas manualmente.
* **Solución:** En la barra de herramientas de `console-importer.tsx` (junto a `Seleccionar todos` y `⚡ Emparejar todo automáticamente`), agregar un control masivo:
  ```tsx
  <div className="bulk-hours-tool">
    <span>Asignar horas a seleccionados:</span>
    <input type="number" min="0" placeholder="Ej: 15" id="bulk-hours-input" />
    <button type="button" className="button secondary" onClick={applyBulkHours}>
      Aplicar a seleccionados
    </button>
  </div>
  ```
* **Comportamiento:**
  - Aplica el valor ingresado a todas las filas actualmente seleccionadas (`row.selected && !row.done`), permitiendo que el usuario asigne rápidamente un promedio de horas a sus juegos antes de importar.

---

### C. Modo de Edición Rápida de Horas en Biblioteca (`src/components/library.tsx`)
* **Problema:** Los juegos de Xbox que ya fueron importados con `0.0 h` actualmente obligan al usuario a navegar juego por juego para abrir el formulario de Play Log y escribir las horas.
* **Solución:**
  1. En la vista de **Biblioteca** (`/library`), al filtrar por plataforma (ej. `Xbox 360` o `PlayStation`), habilitar un botón:
     `[ ⚡ Editor Rápido de Horas ]`.
  2. Muestra una vista compacta estilo tabla/terminal con:
     - Carátula pequeña.
     - Título del juego y plataforma.
     - Campo numérico de horas editable directamente en la fila.
     - Botón `Guardar`.
  3. Al modificar las horas, actualiza atómicamente el `play_log` correspondiente sin necesidad de recargar la página completa.

---

## 3. Plan de Acción para Codex (ChatGPT)

1. **En `src/components/console-importer.tsx`:**
   - Incorporar el banner explicativo sobre las restricciones de las APIs de consolas vs Steam.
   - Añadir la función `applyBulkHours(hours: number)` y el control visual en la barra superior de acciones.
2. **En la vista de Biblioteca (`src/components/library.tsx` o subcomponente):**
   - Incorporar la edición inline rápida de horas para juegos que tengan `hours_played = 0`.
3. **Verificación:**
   - Probar que `npm run check` pase sin errores de TypeScript ni linter.
   - Confirmar que tras asignar horas, el Dossier de Métricas y el gráfico de plataformas recalculen inmediatamente el porcentaje de horas de Xbox y PlayStation.
