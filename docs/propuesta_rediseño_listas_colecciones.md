# Especificación Técnica: Rediseño Visual de «Listas de juegos» (/lists) — Grid de Colecciones

**Fecha:** 10 de octubre de 2026  
**Rama de origen:** `research/antigravity`  
**Rama de destino:** `implementation/chatgpt` (Codex)  
**Objetivo:** Transformar la vista `/lists` ("Listas de juegos") de una lista de filas planas estiradas en una **cuadrícula de tarjetas de colección gamer** (estilo Letterboxd / Backloggd), incorporando mosaicos dinámicos de carátulas, conteo de títulos, avatar del creador, pestañas de filtrado (Mis listas vs Comunidad) y buscador temático.

---

## 1. Diagnóstico del Estado Actual

En `src/app/lists/page.tsx`:
1. **Desperdicio de espacio en pantalla:** Cada lista se estira horizontalmente en todo el ancho de la ventana, dejando más del 70% del panel como espacio negro muerto.
2. **Portadas vacías poco atractivas:** Cuando una lista tiene pocos o ningún juego, se muestran 4 iconos de gamepad idénticos en un recuadro oscuro.
3. **Falta de contexto:** No se muestra de forma visible cuántos juegos tiene la lista ni quién es el autor de la misma.
4. **Falta de separación:** No hay pestañas para separar tus listas privadas/personales de las colecciones públicas compartidas por la comunidad.

---

## 2. Especificación del Rediseño

### 2.1. Nuevo Componente: `src/components/collection-card.tsx`
Renderiza cada colección como una tarjeta compacta y moderna:
* **Mosaico de Portadas Dinámico (Lado Izquierdo):**
  * Si contiene juegos: Mosaico 2x2 con las carátulas reales de los primeros 4 títulos (con esquinas redondeadas y sutil borde neón).
  * Si está vacía: Tarjeta estilizada con ícono de cartucho arcade y texto: *"En preparación"*.
* **Información Central y Autor (Lado Derecho):**
  * Título de la colección con enlace directo a `/lists/[id]`.
  * Descripción recortada a 2 líneas (`line-clamp-2`).
  * Autor de la lista: Avatar en miniatura (22x22 px) y nombre `@username`.
* **Pie de Tarjeta con Badges:**
  * Conteo de juegos: `[ 🎮 X juegos ]`.
  * Estado de privacidad: `[ 🔒 Privada ]` (en tono ámbar) o `[ 🌐 Compartida ]` (en tono cian/verde).

### 2.2. Barra Superior con Pestañas y Buscador en `src/app/lists/page.tsx`
* **Filtros por Pestaña (`?tab=...`):**
  * `[ 👤 Mis Listas ]` (filtra `user_id = user.id`, mostrando privadas y públicas del usuario).
  * `[ 🌐 Explorar Comunidad ]` (muestra listas públicas con `is_private = false`).
* **Buscador de Listas:**
  * Campo de búsqueda por título o descripción: `<input type="search" placeholder="Buscar colecciones temáticas (ej: RPGs, Terror, Retro)…" />`.
* **Acción de Creación:**
  * Botón destacado en la cabecera `[ + Crear nueva lista ]` para desplegar el formulario de forma limpia.

### 2.3. Estilos en `src/app/globals.css`

```css
.lists-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 1.25rem;
  margin-block: 1.5rem;
}

.collection-card {
  display: flex;
  gap: 1rem;
  padding: 1.15rem;
  border-radius: 6px;
  background: var(--panel-bg, #0d151c);
  border: 1px solid var(--border-color, #1e293b);
  transition: border-color 0.15s ease, transform 0.15s ease;
  text-decoration: none;
  min-height: 140px;
}

.collection-card:hover {
  border-color: var(--accent, #00ff66);
  transform: translateY(-2px);
}

.collection-cover-container {
  width: 90px;
  height: 120px;
  flex-shrink: 0;
  border-radius: 4px;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.08);
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 1px;
}

.collection-cover-cell {
  position: relative;
  background: #111a24;
  display: flex;
  align-items: center;
  justify-content: center;
}

.collection-meta {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  flex: 1;
  min-width: 0;
}

.collection-badges {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-top: 0.5rem;
  font-size: 0.75rem;
}
```

---

## 3. Plan de Ejecución para Codex

1. Crear el componente `src/components/collection-card.tsx` que reciba la lista, su autor y sus juegos asociados.
2. Actualizar `src/app/lists/page.tsx`:
   - Incorporar en la consulta la relación `profiles(id, username, avatar_url)`.
   - Añadir soporte de pestañas: `tab = 'mine' | 'community'`.
   - Renderizar los resultados dentro de la cuadrícula `<div className="lists-grid">`.
3. Añadir los estilos correspondientes en `src/app/globals.css`.
4. Verificar con `npm run check`.
