# SPEC-20: Rework Integral de Diseño y Ergonomía del Chat Global (/chat)

## 1. Contexto y Objetivos

### 1.1 Diagnóstico del Diseño Actual
La sección de **Chat Global** (`/chat` y `DiscordChat` en `src/components/discord-chat.tsx`) es uno de los componentes más interactivos de SaveState, conectando la web en tiempo real con el servidor oficial de Discord. Sin embargo, presenta fricciones visuales y de usabilidad:

1. **Alturas y Desbordamiento Desproporcionados del Contenedor Principal:**
   - La lista de mensajes (`.discord-message-list`) posee dimensiones fijas y forzadas (`min-height: 480px; max-height: 680px;` en móvil, y `min-height: 600px; max-height: 1180px;` en desktop).
   - En monitores de laptop (1366×768, 1440×900 o 1920×1080), este tamaño fuerza barras de desplazamiento dobles incómodas o hace que la sección se corte por debajo de la línea visual del navegador (*viewport fold*).
   - Se requiere un contenedor de altura adaptativa dependiente del viewport (`height: calc(100vh - 180px)` o `min(calc(100dvh - 190px), 860px)` en desktop) que permita scroll natural e infinito dentro del historial sin descuadrar la página.

2. **Sobrecarga y Asimetría en la Barra Lateral (`.discord-sidebar`):**
   - La barra lateral apila 4 paneles pesados en flujo vertical libre (`FRECUENCIAS DISCORD`, `DiscordLinkedRoleCard`, `MIEMBROS EN LÍNEA`, `ESTADO DEL NODO`).
   - El panel de miembros en línea y estado del nodo hacen que la columna derecha supere en altura al área de chat por cientos de píxeles, dejando vacíos negros desbalanceados o forzando scrolling excesivo.
   - Debe implementarse scroll independiente en el listado de miembros (`max-height: 280px; overflow-y: auto`) y una organización compacta con micro-tarjetas de nodo.

3. **Intrusión Vertical del Ticker Superior (`.discord-ticker`):**
   - El ticker ocupa 60px de alto con bordes contrastantes y texto repetitivo en animación marquee (`discord-ticker-drift`).
   - Se debe transformar en una barra de estado ciber-terminal elegante y compacta (`terminal-ticker-bar`) que comunique estado del enlace, latencia en ms, presencia del bot y acceso rápido al servidor.

4. **Desorden Visual en la Barra de Herramientas del Composer (`.discord-composer-toolbar`):**
   - Contiene 9 botones sueltos en fila (`📎 Adjuntar`, `💾 Bóveda`, `🔗 Pegar URL/GIF`, 4 botones de emoji, `@ Mencionar`, `🎮 Juego`, `Enviar →`) que colapsan desordenadamente en múltiples líneas en tabletas o ventanas medianas.
   - Debe estructurarse en **3 grupos funcionales ergonómicos**:
     - *Herramientas de Entrada:* Adjuntos (`📎`), Bóveda (`💾`), URL (`🔗`), Mención (`@`), Ficha de Juego (`🎮`).
     - *Reacciones Gamer Rápidas:* Paleta compacta de emojis `👾`, `💾`, `🏆`, `🔥`.
     - *Acción Principal de Envío:* Botón de alto contraste `ENVIAR ↗` con indicador de cuenta regresiva de enfriamiento (`cooldown`) y spinner de red.

5. **Jerarquía Visual y Legibilidad de Mensajes:**
   - Burbujas de mensajes (`.discord-message`) con fondo plano y líneas de escaneo pesadas que dificultan la lectura.
   - Las insignias de origen (`[SAVESTATE]` vs `[DISCORD]`) carecen de diferenciación moderna.
   - Se debe implementar estética *Cyber-Glassmorphism* con acentos de color cian (`#00f0ff`) para la Web de SaveState y púrpura neón (`#a855f7`) para Discord nativo, con citas de respuesta limpias y previsualizaciones de juegos embebidas (`game-card-embed`).

---

## 2. Archivos a Modificar

| Tipo | Ruta | Acción | Propósito |
| :--- | :--- | :---: | :--- |
| **Doc** | `docs/specs/SPEC-20-global-chat-design-rework.md` | Crear | Esta especificación técnica de diseño. |
| **Handoff** | `.codex/SPEC-20-handoff.md` | Crear | Prompt optimizado para ejecución quirúrgica por Codex. |
| **Page** | `src/app/chat/page.tsx` | Modificar | Estilización del encabezado, compactación del ticker terminal y contenedor adaptable. |
| **Component** | `src/components/discord-chat.tsx` | Modificar | Reestructuración del layout grid, agrupación de botones del composer, scroll delimitado en miembros y mejoras ergonómicas. |
| **CSS** | `src/app/globals.css` | Modificar | Actualización de clases `.discord-*`, tokens de espaciado, glassmorphism, barras de scroll ciberpunk y media queries responsive. |

---

## 3. Contratos de Diseño y Layout Estricto

### 3.1 Proporciones del Layout de Chat (`.discord-layout-grid`)
```css
/* Especificación de altura fija/flexible del contenedor */
.discord-layout-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 1.25rem;
  align-items: stretch;
  height: calc(100vh - 180px);
  min-height: 600px;
  max-height: 920px;
}

@media (max-width: 1024px) {
  .discord-layout-grid {
    grid-template-columns: minmax(0, 1fr) 280px;
    gap: 1rem;
    height: auto;
    max-height: none;
  }
}

@media (max-width: 768px) {
  .discord-layout-grid {
    grid-template-columns: 1fr;
    height: auto;
  }
}
```

### 3.2 Terminal Header & Channel Status Bar
La cabecera del chat debe incorporar una barra de navegación interna con:
1. **LEDs de Estado Ciberpunk:** Verde pulsante (`#00ff66`), cian (`#00f0ff`) y magenta (`#ff0055`).
2. **Nombre del Canal y Frecuencia Activa:** Con almohadilla `#` resaltada y descripción breve del canal (`#💬-web-chat`, `#💾-checkpoints`, etc.).
3. **Indicador de Sincronización:** Badge con pulso `LIVE SYNC // 24ms`.
4. **Acciones Rápidas:** Botón `↺ Sincronizar` y botón para saltar al último mensaje si el usuario subió en el historial.

### 3.3 Estructura del Historial de Mensajes (`.discord-message-list`)
- Fondo: `background: rgba(10, 12, 20, 0.65)` con efecto de difuminado (`backdrop-filter: blur(12px)`), borde sutil `1px solid rgba(255, 255, 255, 0.07)`.
- Scrollbar: Anchura ultra-fina (4px), track translúcido, thumb cian brillante con hover reactivo.
- Espaciado: `padding: 1.25rem; gap: 0.85rem;`.
- Scroll anclado al fondo (`auto-scroll on incoming`) cuando el usuario está cerca del final.

### 3.4 Agrupación del Composer (`.discord-advanced-composer`)
Estructura semántica del formulario de entrada:
```tsx
<div className="discord-composer-container">
  {/* Previsualización de respuesta (si replyTo existe) */}
  {replyTo && (
    <div className="discord-reply-banner">
      <span>Respondiendo a <strong>@{replyTo.author}</strong>: <em>{replyTo.snippet}</em></span>
      <button onClick={() => setReplyTo(null)}>✕</button>
    </div>
  )}

  {/* Previsualización de adjunto o juego */}
  {attachment && ( ... )}

  <div className="discord-composer-box">
    <textarea
      placeholder="Escribe una señal en el canal... (Enter para enviar, Shift+Enter para nueva línea)"
      maxLength={500}
      ...
    />
    <div className="discord-composer-footer">
      <div className="discord-tools-group">
        <button title="Adjuntar imagen/GIF">📎</button>
        <button title="Seleccionar de la Bóveda">💾 Bóveda</button>
        <button title="Pegar URL directa">🔗 Enlace</button>
        <button title="Mencionar usuario">@</button>
        <button title="Adjuntar ficha de juego">🎮 Juego</button>
      </div>
      
      <div className="discord-emoji-palette">
        {['👾', '💾', '🏆', '🔥'].map(emoji => (
          <button key={emoji}>{emoji}</button>
        ))}
      </div>

      <div className="discord-send-action">
        <span className="discord-char-counter">{content.length}/500</span>
        <button className="discord-send-button" disabled={sending || cooldown > 0 || !canSend}>
          {sending ? '...' : cooldown > 0 ? `${cooldown}s` : 'ENVIAR ↗'}
        </button>
      </div>
    </div>
  </div>
</div>
```

### 3.5 Panel Lateral Optimizado (`.discord-sidebar`)
- **Frecuencias / Canales:** Botones tipo píldora compactos con borde activo lateral (`border-left: 3px solid var(--accent)`), selector accesible `aria-pressed`.
- **Miembros en Línea:** Contenedor con altura máxima estricta (`max-height: 260px; overflow-y: auto`), micro-scroll y visualización clara del avatar, status dot (online/idle/dnd) y el juego que están jugando actualmente.
- **Estado del Nodo & Enlace:** Card integrada con latencia del relay (ej. `24 ms`), estado del WebSocket/polling, y botón de alto contraste `UNIRSE AL SERVIDOR DE DISCORD ↗`.

---

## 4. Algoritmo y Flujo de Implementación Paso a Paso

1. **Paso 1: Refactorizar `src/app/chat/page.tsx`:**
   - Limpiar el header de la página eliminando márgenes innecesarios que empujan el chat fuera de pantalla.
   - Convertir el ticker en una barra de información superior estilizada con estética de terminal de mando.
2. **Paso 2: Reestructurar el JSX en `src/components/discord-chat.tsx`:**
   - Agrupar la barra de herramientas del composer en 3 zonas claras (`discord-tools-group`, `discord-emoji-palette`, `discord-send-action`).
   - Introducir barra de estado del canal en la parte superior del chat con selector de frecuencia visible, contador de mensajes y botón de sincronización.
   - Limitar el contenedor de la lista de miembros con scroll dedicado (`overflow-y: auto`) para que no expanda desmedidamente la barra lateral.
3. **Paso 3: Actualizar y Modernizar CSS en `src/app/globals.css`:**
   - Reemplazar reglas monolíticas de `.discord-message-list`, `.discord-sidebar`, `.discord-chat-form` y `.discord-composer-toolbar`.
   - Añadir variables y estilos de *Cyber-Glassmorphism* (`backdrop-filter`, bordes con gradiente sutil y sombras de neón tenues).
   - Ajustar media queries para asegurar fluidez perfecta en móviles (< 640px), tablets (641px - 1024px) y pantallas de alta resolución (> 1024px).
4. **Paso 4: Validación de Comportamiento e Integridad:**
   - Validar que el envío con `Enter` y salto de línea con `Shift+Enter` sigan operando sin regresión.
   - Probar menciones (`@`), adjuntos de archivo, picker de Bóveda y selector de juegos.
   - Ejecutar la suite completa de tests de la aplicación (`npm test`) y verificar build limpio.

---

## 5. Criterios de Aceptación y Casos Borde

1. **Alineación Vertical en Viewport:**
   - En pantallas desktop (1024px+), el área de mensajes y la barra lateral deben mantenerse dentro del viewport sin generar scroll vertical general excesivo en el body de la página.
2. **Scroll Independiente en Miembros en Línea:**
   - Si la presencia de Discord reporta 20 o 50 miembros conectados, la barra lateral no debe crecer infinitamente; el scroll interno debe activarse de forma suave.
3. **Ergonomía del Composer:**
   - En resoluciones móviles (< 640px), la botonera del composer debe organizarse de forma responsiva sin romperse ni sobreponerse al campo de texto.
4. **Accesibilidad y Foco:**
   - Todos los botones interactivos (frecuencias, emojis, herramientas, enviar) deben contar con `aria-label`, foco visual accesible y feedback de estado (disabled, loading, cooldown).
5. **Cero Regresiones Funcionales:**
   - Todas las funciones existentes (subida a Supabase Storage / signed URLs, menciones de usuarios, visor lightbox de imágenes/videos, selector de juegos y bóveda) deben operar con total normalidad.
