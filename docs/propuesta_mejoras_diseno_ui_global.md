# Especificación Técnica: Paquete de Mejoras de Diseño Visual y UI/UX Global

**Fecha:** 10 de octubre de 2026  
**Rama de origen:** `research/antigravity`  
**Rama de destino:** `implementation/chatgpt` (Codex)  
**Objetivo:** Implementar cuatro mejoras estructurales de diseño visual en SaveState:
1. **Header Glassmorphism Fijo** con detección de ruta activa, brillo neón e iconografía sutil.
2. **Tarjetas de Catálogo (`/explore`) en Formato Póster 2:3** con degradado de superposición, badges flotantes y micro-interacción de zoom.
3. **Footer Estilo Consola de Diagnóstico / Arcade Cabinet** organizado en 3 columnas con estado del sistema y mapa de navegación.
4. **Esquineros HUD «Cyber-Corner»** en los paneles principales de la interfaz.

---

## 1. Header «Glassmorphism» Fijo con Indicadores e Iconos

### 1.1. Diagnóstico Actual
* En `src/components/header.tsx`, la navegación contiene 10 enlaces de texto seguidos sin iconos ni estado activo (`aria-current="page"`), y desaparece al hacer scroll.

### 1.2. Implementación Técnica
1. **Crear `src/components/header-nav.tsx` (Client Component):**
   * Usa `usePathname()` de `next/navigation` para detectar la sección activa.
   * Incorpora iconos de `lucide-react` a tamaño `14px` junto a cada etiqueta:
     * `/explore` -> `Compass` («Explorar»)
     * `/library` -> `Library` («Biblioteca»)
     * `/feed` -> `Radio` («Transmisión»)
     * `/highlights` -> `Sparkles` («Momentos»)
     * `/forum` -> `MessageSquare` («Foro»)
     * `/parties` -> `Users` («Compañeros»)
     * `/lists` -> `Layers` («Listas»)
     * `/players` -> `UserCheck` («Jugadores»)
     * `/community/discord` -> `Headphones` («Discord»)
     * `/rift` -> `Swords` («Rift»)
   * Aplica `aria-current={active ? 'page' : undefined}` y la clase `.nav-item-active`.
2. **Estilos Glassmorphism en `src/app/globals.css`:**
   ```css
   .site-header {
     position: sticky;
     top: 0;
     z-index: 90;
     max-width: 100%;
     background: rgba(8, 9, 12, 0.82);
     backdrop-filter: blur(14px);
     -webkit-backdrop-filter: blur(14px);
     border-bottom: 1px solid color-mix(in srgb, var(--accent) 22%, var(--line));
   }

   .site-header nav a {
     display: inline-flex;
     align-items: center;
     gap: 6px;
     padding: 8px 10px;
     border-radius: 4px;
     color: var(--muted);
     transition: color 0.15s ease, background 0.15s ease;
     position: relative;
   }

   .site-header nav a:hover {
     color: #f2f4f8;
     background: rgba(255, 255, 255, 0.04);
   }

   .site-header nav a[aria-current='page'] {
     color: var(--accent);
     background: color-mix(in srgb, var(--accent) 10%, transparent);
     box-shadow: inset 0 -2px 0 var(--accent);
   }
   ```

---

## 2. Rediseño de Tarjetas de Juego (`GameCard`) en Formato Póster 2:3

### 2.1. Diagnóstico Actual
* En `src/components/game-card.tsx`, la imagen está separada de un bloque `.game-card-body` inferior que consume mucho espacio vertical y resta impacto al arte de la carátula.

### 2.2. Implementación Técnica
1. **Actualizar `src/components/game-card.tsx`:**
   * Estructura tipo póster 2:3 donde la carátula ocupa el 100% del alto de la tarjeta.
   * **Badges superiores flotantes:** Año de lanzamiento a la izquierda y nota `★ {score}` a la derecha con fondo translúcido (`backdrop-filter: blur(6px)`).
   * **Overlay inferior en degradado:** Muestra el título del juego (`line-clamp-2`), las plataformas y el indicador `Ver ficha ↗` al hacer hover.
2. **Estilos en `src/app/globals.css`:**
   ```css
   .game-card {
     position: relative;
     aspect-ratio: 2 / 3;
     border-radius: 6px;
     border: 1px solid var(--line);
     background: #0d131a;
     overflow: hidden;
     display: flex;
     flex-direction: column;
     justify-content: flex-end;
     transition: border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
   }

   .game-card:hover {
     border-color: var(--accent);
     transform: translateY(-3px);
     box-shadow: 0 8px 24px -6px rgba(0, 240, 255, 0.22);
   }

   .game-card .cover {
     position: absolute;
     inset: 0;
     aspect-ratio: unset;
     z-index: 0;
   }

   .game-card .cover img {
     transition: transform 0.35s ease;
   }

   .game-card:hover .cover img {
     transform: scale(1.05);
   }

   .game-card-badges {
     position: absolute;
     top: 10px;
     left: 10px;
     right: 10px;
     z-index: 2;
     display: flex;
     justify-content: space-between;
     gap: 6px;
     pointer-events: none;
   }

   .game-poster-badge {
     background: rgba(8, 9, 12, 0.78);
     backdrop-filter: blur(6px);
     border: 1px solid rgba(255, 255, 255, 0.12);
     padding: 3px 8px;
     border-radius: 4px;
     font-size: 10px;
     font-weight: 700;
     color: #f2f4f8;
   }

   .game-poster-badge.score {
     color: #ffb800;
     border-color: rgba(255, 184, 0, 0.35);
   }

   .game-card-body {
     position: relative;
     z-index: 2;
     flex: 0;
     padding: 42px 14px 14px;
     background: linear-gradient(
       to top,
       rgba(8, 9, 12, 0.98) 0%,
       rgba(8, 9, 12, 0.88) 55%,
       transparent 100%
     );
   }
   ```

---

## 3. Rediseño del Footer como «Panel de Control / Arcade Cabinet»

### 3.1. Implementación en `src/app/layout.tsx` y `src/app/globals.css`
Reemplazar el `<footer>` actual por una estructura de 3 columnas:
* **Columna 1:** Logo `SAVESTATE`, descripción breve y badge `<span className="footer-status">● SYSTEM ONLINE // V.2.6</span>`.
* **Columna 2:** Enlaces de navegación rápida divididos en 2 listas (*Catálogo & Colección* y *Red & Comunidad*).
* **Columna 3:** Lema `INSERT COIN. KEEP PLAYING.` y botón `<a href="#main" className="button outline small">↑ Volver arriba</a>`.

---

## 4. Bordes HUD «Cyber-Corner» en Paneles Principales

### 4.1. Implementación en `src/app/globals.css`
Añadir esquineros luminosos sutiles en `.panel`, `.news-section` y `.freebies-section`:

```css
.panel,
.news-section,
.freebies-section {
  position: relative;
}

.panel::before,
.news-section::before,
.freebies-section::before {
  content: '';
  position: absolute;
  top: -1px;
  left: -1px;
  width: 10px;
  height: 10px;
  border-top: 2px solid var(--accent);
  border-left: 2px solid var(--accent);
  pointer-events: none;
}

.panel::after,
.news-section::after,
.freebies-section::after {
  content: '';
  position: absolute;
  bottom: -1px;
  right: -1px;
  width: 10px;
  height: 10px;
  border-bottom: 2px solid var(--accent);
  border-right: 2px solid var(--accent);
  pointer-events: none;
}
```

---

## 5. Plan de Verificación

1. Comprobar que el Header permanece fijo al hacer scroll con desenfoque de cristal y resalta la página activa con su icono.
2. En `/explore`, verificar que los juegos se muestran como pósters 2:3 con año y puntuación flotantes en la parte superior y título sobre degradado inferior.
3. Revisar el nuevo Footer de 3 columnas al final de cualquier página y probar el botón `↑ Volver arriba`.
4. Confirmar que los paneles lucen los esquineros HUD en cian neón.
5. Ejecutar `npm run check` para validar 0 errores de tipos y linting.
