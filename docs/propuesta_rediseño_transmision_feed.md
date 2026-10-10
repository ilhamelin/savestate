# Especificación Técnica: Rediseño Visual y Funcional de «Transmisión» (/feed)

**Fecha:** 10 de octubre de 2026  
**Rama de origen:** `research/antigravity`  
**Rama de destino:** `implementation/chatgpt` (Codex)  
**Objetivo:** Transformar la vista `/feed` ("Transmisión") de un log de texto plano en un **muro social gamer dinámico y visual**, incorporando avatares con nivel, carátulas de juego, tiempos relativos, destacados para juegos platinados (100%) y filtros de actividad.

---

## 1. Diagnóstico del Estado Actual

En `src/app/feed/page.tsx`:
* Cada evento de `activity_logs` se renderiza como una línea de texto plano con un ícono genérico `▣`.
* Ignora las carátulas de los juegos y los avatares que ya se consultan desde Supabase (`games` y `profiles`).
* La fecha se muestra en formato ISO crudo (`2026-10-10`) sin cálculo de tiempo relativo ("hace X min").
* El panel de WebSocket superior ocupa demasiado espacio vertical sin armonizar con el feed.

---

## 2. Especificación del Rediseño

### 2.1. Nuevo Componente: `src/components/feed-activity-card.tsx`
Renderiza cada evento de actividad como una tarjeta enriquecida:
* **Columna Izquierda (Avatar y Autor):**
  * `<AvatarFrame frame={player.equipped_frame}>` con avatar real del jugador (40x40 px).
  * Enlace al perfil `@player.username`.
  * Círculo de nivel (`friend-level-circle`).
  * Tiempo relativo ("hace 5 min", "hace 2 h") calculado con `notificationAge`.
* **Cuerpo Central (El Checkpoint):**
  * **Si es 100% / Platinum:** Insignia especial destacada con borde dorado/neón: `🏆 ¡Platinó al 100%! en [Título]`.
  * **Si es Cleared:** `🟢 Terminó la campaña de [Título]`.
  * **Si es Playing:** `🎮 Empezó a jugar [Título]`.
  * **Si tiene Puntuación:** Badge estilizado `★ [rating]/10` (con etiqueta especial *"Obra maestra"* si nota >= 9.0).
* **Columna Derecha (Carátula del Juego):**
  * Miniatura póster del juego (48x64 px) con esquinas redondeadas y hover luminoso que enlaza a `/games/[slug]`.

### 2.2. Barra de Filtros de Actividad en `src/app/feed/page.tsx`
* Pestañas en la cabecera:
  * `[ Todos ]`
  * `[ 🏆 Platinados y 100% ]` (eventos con status `platinum`)
  * `[ ⭐ Con Calificación ]` (eventos que incluyan `rating`)
  * `[ 🎮 Jugando ]` (eventos con status `playing`)

### 2.3. Barra HUD de Estado "En Vivo" Compacta
* Reemplazar la caja superior tosca por una barra sutil y tecnológica:
  * Indicador pulsante verde: `● EN VIVO · WebSocket conectado`.
  * Botón compacto `[ 🔄 Actualizar ]`.

---

## 3. Estilos en `src/app/globals.css`

```css
.feed-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1.25rem;
  padding: 1rem 1.25rem;
  background: var(--panel-bg, #0d151c);
  border: 1px solid var(--border-color, #1e293b);
  border-radius: 6px;
  margin-bottom: 0.75rem;
  transition: border-color 0.15s ease;
}

.feed-card:hover {
  border-color: var(--accent, #00ff66);
}

.feed-card.platinum-event {
  border-color: rgba(234, 179, 8, 0.4);
  background: linear-gradient(90deg, rgba(234, 179, 8, 0.05), transparent);
}

.feed-card-left {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex: 1;
  min-width: 0;
}

.feed-card-info {
  flex: 1;
  min-width: 0;
}

.feed-card-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  color: var(--muted, #64748b);
  margin-bottom: 0.25rem;
}

.feed-card-cover {
  width: 48px;
  height: 64px;
  position: relative;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
  flex-shrink: 0;
}
```

---

## 4. Plan de Ejecución para Codex

1. Crear el componente `src/components/feed-activity-card.tsx` que reciba `{ event, player, game }`.
2. Actualizar `src/app/feed/page.tsx` para integrar los filtros rápidos por tipo de evento y renderizar las tarjetas `<FeedActivityCard />`.
3. Estilizar el HUD superior y las tarjetas en `src/app/globals.css`.
4. Verificar que `npm run check` pase sin errores.
