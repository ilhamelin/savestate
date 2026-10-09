# Solución Arquitectónica: Emparejamiento Resiliente, Búsqueda Profunda y Selección Manual en Importador de Steam

**Fecha:** 9 de octubre de 2026  
**Rama de origen:** `research/antigravity`  
**Rama de destino:** `implementation/chatgpt` (Codex)  
**Problema reportado:** Juegos populares como *Stellar Blade™*, *The Witcher 3: Wild Hunt* o *Grand Theft Auto V* no se emparejan con el catálogo de IGDB, arrojando el mensaje *"Sin coincidencias. Puedes buscar el título desde Explorar"*, impidiendo su importación.

---

## 1. Diagnóstico de la Causa Raíz

Tras auditar el flujo de importación (`src/services/steam.ts`, `src/components/steam-importer.tsx` e `src/integrations/igdb/query.ts`), se identificaron **4 factores simultáneos** que provocan el bloqueo:

1. **Símbolos comerciales en títulos de Steam:**
   * Steam entrega nombres con caracteres de marca registrada: `Stellar Blade™`, `The Witcher® 3: Wild Hunt`, `DARK SOULS™ III`.
   * En `igdbQuery()`, la búsqueda genera: `(name ~ *"Stellar Blade™"* | ...)`.
   * En la base de datos de IGDB, los títulos están registrados como texto plano (`Stellar Blade`, `The Witcher 3: Wild Hunt`). La coincidencia por regex con `™` o `®` falla al 100%.

2. **Filtro rígido de plataforma (`PC (Microsoft Windows)`):**
   * En `src/services/steam.ts`, la consulta fuerza estrictamente `platform: 'PC (Microsoft Windows)'`.
   * En títulos cross-platform o lanzamientos originarios de consola (como *Stellar Blade*, inicialmente exclusivo de PS5 y anunciado para PC), el catálogo de IGDB muchas veces no tiene asignada la plataforma PC en su ficha principal o la nombra diferente. Al exigir esa plataforma exacta, IGDB descarta la ficha por completo.

3. **Subtítulos y ediciones especiales:**
   * Steam suele listar nombres con ediciones: *The Witcher 3: Wild Hunt - Game of the Year Edition*, *Grand Theft Auto V: Premium Edition*.
   * IGDB falla con búsquedas wildcard de frases tan largas y específicas.

4. **Falta de entrada manual y filtro de pendientes en la UI:**
   * `steam-importer.tsx` no ofrece ningún campo de texto interactivo para que el usuario escriba manualmente el término de búsqueda si el nombre automático falla.
   * Además, si el usuario tiene cientos de juegos, no hay forma rápida de ver cuáles no se emparejaron sin recorrer las páginas una a una.

---

## 2. Solución en 3 Capas

### Capa 1: Búsqueda Profunda en Cascada en el Backend (`src/services/steam.ts`)
Modificar `steamMutation` para soportar búsqueda multi-etapa y consultas manuales:

1. **Sanitización del término de búsqueda:**
   * Eliminar símbolos `™`, `®`, `©`, así como corchetes/paréntesis comunes (`(Demo)`, `[Edition]`).
2. **Cascada de 3 intentos (Deep Match):**
   * **Paso 1:** Buscar el título limpio con filtro `platform: 'PC (Microsoft Windows)'`.
   * **Paso 2 (Fallback si 0 resultados):** Buscar el título limpio **sin filtro de plataforma** (permitiendo asociar la ficha universal del juego en IGDB).
   * **Paso 3 (Fallback de subtítulos):** Si el título contiene `:` o `-`, extraer el título principal (ej: `"The Witcher 3"` a partir de `"The Witcher 3: Wild Hunt"`) y buscar sin filtro de plataforma.
3. **Parámetro `title` opcional en la acción `match`:**
   * Si el frontend envía `{ action: 'match', ticket, title: 'Stellar Blade' }`, buscar explícitamente por el término escrito por el usuario.

### Capa 2: Pestañas de Filtrado en la UI (`src/components/steam-importer.tsx`)
Agregar un selector de vista en la barra de herramientas:
* `[ Todos (X) ]`
* `[ Con ficha lista (Y) ]`
* `[ ⚠️ Pendientes / Sin ficha (Z) ]`

Al presionar **"Pendientes / Sin ficha"**, la vista muestra únicamente los títulos que requieren atención o emparejamiento manual, permitiendo resolverlos en segundos.

### Capa 3: Buscador Manual Integrado en la Tarjeta del Juego
En cada tarjeta donde una búsqueda falle o el usuario pulse *"Elegir ficha de catálogo"*:
* Mostrar un campo de texto editable precargado con el nombre limpio del juego.
* Botón `[ 🔍 Buscar ]` que permite al usuario probar términos alternativos (ej: escribir *"Witcher 3"* o *"GTA V"*).
* Desplegar la lista de candidatos encontrados con portada miniatura, título y año para vincular con 1 clic.

---

## 3. Plan de Cambios para Codex

1. **Backend (`src/services/steam.ts`):**
   * Añadir función de limpieza `cleanSearchQuery(title: string): string`.
   * En `action === 'match'`, admitir `data.title` si el usuario ingresó un término manual.
   * Implementar la cascada de búsqueda resiliente (con plataforma PC -> sin plataforma -> título raíz).
2. **Frontend (`src/components/steam-importer.tsx`):**
   * Agregar estado de filtro de estado: `filterMode: 'all' | 'matched' | 'unmatched'`.
   * Agregar estado de búsqueda manual por tarjeta: `manualQueries: Record<number, string>`.
   * Renderizar el input interactivo y las opciones encontradas con selección directa.
3. **Verificación:**
   * Ejecutar `npm run check` para asegurar 0 errores de TypeScript y pruebas unitarias aprobadas.
