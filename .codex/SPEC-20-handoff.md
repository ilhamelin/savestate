# Handoff para OpenAI Codex / GPT-6.1 Astra: SPEC-20

Copia y pega este prompt directamente en Codex / GPT:

```markdown
Eres un Ingeniero de Software Staff y Diseñador UI/UX Frontend experto en Next.js 16 (App Router), React 19, CSS Moderno (Glassmorphism, Cyberpunk UI) y Tailwind CSS.

### 🎯 Tarea
Implementar el Rework Integral de Diseño y Ergonomía de la sección de **Chat Global** (`/chat`), siguiendo al 100% las especificaciones técnicas estipuladas en `docs/specs/SPEC-20-global-chat-design-rework.md`.

---

### 📂 Archivos a Modificar

1. **`src/app/chat/page.tsx`:**
   - Reducir el margen superior del encabezado para maximizar el área visible de la terminal en pantalla.
   - Reemplazar el ticker marquee intrusivo `.discord-ticker` por una barra de estado terminal ciberpunk compacta (`discord-terminal-ticker`) que indique:
     - Pulso en vivo (`⚡ FRECUENCIA DE COMUNIDAD // GATEWAY ACTIVO`).
     - Enlace al servidor de Discord.
   - Envolver el componente `<DiscordChat />` de forma limpia manteniendo la verificación de sesión actual.

2. **`src/components/discord-chat.tsx`:**
   - **Encabezado del Chat Terminal (`.discord-chat-heading`):**
     - Integrar la barra superior tipo terminal con LEDs de estado (`#00ff66`, `#00f0ff`, `#ff0055`).
     - Mostrar el canal activo con almohadilla resaltada (ej. `#💬-web-chat`, `#💾-checkpoints`), badge de estado `LIVE SYNC // 24ms`, y botón de refresco manual `↺ Sincronizar`.
   - **Historial de Mensajes (`.discord-message-list`):**
     - Asegurar scroll anclado suave al recibir nuevos mensajes (`discordNearBottom`).
     - Estilizar las tarjetas de mensajes con soporte para avatares limpios, badges de origen claros (`[SAVESTATE]` en cian neón, `[DISCORD]` en púrpura neón), citas de respuesta (`replyTo`) de alta legibilidad y tarjetas de juego embebidas (`🎮 Juego`).
   - **Barra de Herramientas del Composer (`.discord-composer-toolbar`):**
     - Reestructurar los 9 botones sueltos en **3 grupos organizados y ergonómicos**:
       1. `.discord-tools-group`: `📎 Adjuntar archivo`, `💾 Bóveda`, `🔗 Pegar URL`, `@ Mencionar`, `🎮 Juego`.
       2. `.discord-emoji-palette`: Paleta de micro-reacciones `👾`, `💾`, `🏆`, `🔥`.
       3. `.discord-send-action`: Contador de caracteres (`{content.length}/500`) y botón de envío de alto contraste `ENVIAR ↗` con indicador visual de enfriamiento (`cooldown`) y deshabilitación inteligente.
   - **Barra Lateral (`.discord-sidebar`):**
     - **Canales/Frecuencias:** Lista de píldoras estilizadas con indicador visual activo en el lateral izquierdo.
     - **Miembros en Línea:** Envolver `.discord-presence-list` en un contenedor con scroll vertical delimitado (`max-height: 260px; overflow-y: auto;`) para evitar que 20+ miembros conectados deformen la columna derecha verticalmente.
     - **Estado del Nodo:** Tarjeta compacta con indicador de latencia (ms), estado online y botón directo de unirse a Discord (`UNIRSE AL SERVIDOR ↗`).

3. **`src/app/globals.css` (Reglas `.discord-*`):**
   - **Layout Grid (`.discord-layout-grid`):**
     - En desktop (>1024px): `display: grid; grid-template-columns: minmax(0, 1fr) 320px; height: calc(100vh - 180px); min-height: 600px; max-height: 920px; gap: 1.25rem; align-items: stretch;`.
     - En tablet (769px - 1024px): `grid-template-columns: minmax(0, 1fr) 280px; height: auto; max-height: none;`.
     - En móvil (<=768px): `grid-template-columns: 1fr; height: auto;`.
   - **Lista de Mensajes (`.discord-message-list`):**
     - `flex: 1; min-height: 0; overflow-y: auto;` para que flexione dentro del alto de la grid sin desbordar el viewport del navegador.
     - Barra de desplazamiento ultra-fina (4-5px) con estilo cyber (`var(--accent)` thumb, track semitransparente).
     - Fondo con `backdrop-filter: blur(12px); background: rgba(10, 12, 20, 0.7);` y borde sutil.
   - **Presencia de Miembros:**
     - `max-height: 260px; overflow-y: auto; scrollbar-width: thin;` para mantener la simetría perfecta con el área de mensajes.
   - **Responsive & Accesibilidad:**
     - Asegurar que en móviles la botonera del composer se ajuste fluidamente (usando `flex-wrap: wrap; gap: 0.5rem;`) sin encimarse.

---

### 📋 Criterios de Aceptación y Comandos de Verificación
1. `cmd.exe /c "set NODE_OPTIONS=--max-old-space-size=1536 && npm run typecheck"`: 0 errores TypeScript.
2. `cmd.exe /c "set NODE_OPTIONS=--max-old-space-size=1536 && npm run lint"`: 0 errores y 0 advertencias ESLint.
3. `npm run format:check`: 100% de cumplimiento Prettier.
4. `npm test`: Todas las pruebas unitarias deben ejecutarse y pasar con 0 fallos.
5. `npx next build --webpack`: Compilación de producción limpia sin errores en las 63 rutas.
```
