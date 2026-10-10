# Especificación Técnica: Rediseño Visual y Funcional de «SaveState Boards» (/forum)

**Fecha:** 10 de octubre de 2026  
**Rama de origen:** `research/antigravity`  
**Rama de destino:** `implementation/chatgpt` (Codex)  
**Objetivo:** Modernizar la vista principal de los foros (`/forum`), balanceando la cuadrícula de canales, incorporando identidades cromáticas neón por categoría, tiempos relativos, buscador rápido y burbujas de interacción en los hilos recientes.

---

## 1. Diagnóstico del Estado Actual

En `src/app/forum/page.tsx` y `src/components/forum-thread-list.tsx`:
1. **Desbalance en la cuadrícula:** Hay 5 categorías en un grid de 3 columnas, dejando un hueco vacío en la parte inferior derecha.
2. **Textos de fecha crudos:** Se renderiza `2026-10-10 03:30 UTC` directamente de la base de datos en lugar de un formato legible de tiempo relativo ("hace 15 min").
3. **Métricas de hilos planas:** Las respuestas y lecturas se muestran en texto vertical plano sin iconos ni jerarquía.
4. **Falta de buscador e identificación:** No hay campo de búsqueda general en los foros y los hilos recientes no muestran el nombre de la categoría a la que pertenecen.

---

## 2. Especificación de las Mejoras

### 2.1. Canales con Identidad Neón y Grid Balanceado
* **Cuadrícula en 2 columnas:** `grid-template-columns: repeat(auto-fit, minmax(360px, 1fr))`, eliminando huecos huérfanos y dando amplitud a las descripciones.
* **Colores temáticos en hover por categoría:**
  * 🎮 **La Taberna Retro:** Borde y brillo cian neón (`#00f0ff`).
  * 🔥 **Actualidad y Debate:** Borde y brillo naranja fuego (`#f97316`).
  * 📖 **Guías, Trucos y Secretos:** Borde y brillo dorado (`#eab308`).
  * ✨ **El Rincón Indie:** Borde y brillo fucsia/magenta (`#d946ef`).
  * ☕ **Zona de Descanso (Off-Topic):** Borde y brillo verde esmeralda (`#10b981`).
* **Píldoras de métricas de canal:**
  * `[ 3 hilos ]` y `[ 12 mensajes ]` como badges redondeados.
  * Tiempo relativo en la última actividad (ej: *"hace 10 min"* o *"Sin actividad hoy"*).

### 2.2. Cabecera con Buscador y Acción de Crear
* Colocar en la misma fila superior:
  * Buscador rápido: `<input type="search" placeholder="Buscar debates, guías o temas en los foros…" />`.
  * Botón: `[ + Crear nuevo hilo ]`.

### 2.3. Hilos Recientes con Burbujas de Interacción
En `src/components/forum-thread-list.tsx`:
* **Chip de Categoría:** Etiqueta visible al inicio del hilo con el nombre del canal (ej: `[ La Taberna Retro ]`).
* **Tiempo Relativo del Autor:** `"Por @ilhamelin_v2 · hace 25 min"`.
* **Caja de Métricas a la derecha:**
  * Badge de respuestas estilizado con ícono: `💬 {thread.replies_count}`.
  * Badge de lecturas: `👁️ {thread.views_count}`.
* **Filtros rápidos de hilos:** Pestañas `[ 🔥 Más activos ]`, `[ ⏱️ Recientes ]` y `[ ❓ Sin respuestas ]`.

---

## 3. Estilos en `src/app/globals.css`

```css
.forum-channels-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  gap: 1.25rem;
  margin-block: 1.5rem;
}

.forum-channel-card {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1.25rem;
  border-radius: 6px;
  background: var(--panel-bg, #0d151c);
  border: 1px solid var(--border-color, #1e293b);
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
  text-decoration: none;
}

.forum-channel-card:hover {
  transform: translateY(-2px);
}

.forum-channel-card[data-category="taberna"]:hover {
  border-color: #00f0ff;
  box-shadow: 0 4px 16px rgba(0, 240, 255, 0.15);
}
.forum-channel-card[data-category="debate"]:hover {
  border-color: #f97316;
  box-shadow: 0 4px 16px rgba(249, 115, 22, 0.15);
}
.forum-channel-card[data-category="guias"]:hover {
  border-color: #eab308;
  box-shadow: 0 4px 16px rgba(234, 179, 8, 0.15);
}
.forum-channel-card[data-category="indie"]:hover {
  border-color: #d946ef;
  box-shadow: 0 4px 16px rgba(217, 70, 239, 0.15);
}
.forum-channel-card[data-category="offtopic"]:hover {
  border-color: #10b981;
  box-shadow: 0 4px 16px rgba(16, 185, 129, 0.15);
}

.thread-metrics-box {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.25rem;
  font-size: 0.85rem;
}
.thread-replies-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(0, 240, 255, 0.1);
  color: var(--accent, #00f0ff);
  font-weight: 600;
}
```

---

## 4. Plan de Ejecución para Codex

1. Actualizar `src/app/forum/page.tsx`:
   - Reorganizar la cuadrícula de canales a 2 columnas con atributos `data-category`.
   - Utilizar formato de tiempo relativo en la última actividad de cada categoría.
   - Añadir barra de búsqueda y selector de filtros para los hilos recientes.
2. Actualizar `src/components/forum-thread-list.tsx`:
   - Mostrar el chip de categoría en cada hilo.
   - Reemplazar la fecha técnica por tiempo relativo.
   - Renderizar las métricas con badges visuales de respuestas y lecturas.
3. Añadir estilos en `src/app/globals.css`.
4. Verificar con `npm run check`.
