# Especificación Técnica: Rediseño de Logo, Títulos y Distribución de Iconos de Halloween

## 1. Análisis del Logo y Título

A partir de la maqueta compartida por el usuario (`media_1792014626448_2d0f344d.png`), se establece la adaptación del logo principal en el Header y Footer:
- **Icono del Gamepad:** Mantener la silueta vectorial de `Gamepad2` con aura luminosa en naranja calabaza (`filter: drop-shadow(0 0 8px #ff6b00)`).
- **Tipografía `SAVESTATE`:** 
  - La palabra `SAVE` en blanco hueso con un sutil goteo/resplandor púrpura (`text-shadow: 0 0 12px rgba(121, 40, 202, 0.6)`).
  - La palabra `STATE` en naranja neón de Halloween (`#ff6b00`) con resplandor cálido (`text-shadow: 0 0 12px rgba(255, 107, 0, 0.75)`).
- **Calabaza al lado del Logo:** Ubicar `/icons/halloween/calabaza.png` exactamente a la derecha de `SAVESTATE` con una animación suave de parpadeo de vela (`animation: pumpkin-candle-flicker 3s infinite ease-in-out`).
- **Subtítulo `YOUR NEXT CHECKPOINT`:** Añadirle un toque temático: `SPOOKY CHECKPOINT // V.81`.

---

## 2. Mapa Estratégico de los 14 Iconos de Halloween

Todos los iconos fueron analizados e importados a `public/icons/halloween/`:

| Icono | Archivo | Ubicación en la Plataforma | Efecto Visual |
| :--- | :--- | :--- | :--- |
| **Calabaza** | `calabaza.png` | **Header Brand** (junto a `SAVESTATE`), Footer y en el Hero | Resplandor cálido titilante |
| **Sombrero de Bruja** | `sombrero-de-bruja.png` | Inclinado sobre la primera letra "S" de `SAVESTATE` | Detalle sutil de 18px |
| **Telaraña** | `telarana-de-halloween.png` | Esquinas superiores del Header y esquina del modal `Ctrl+K` | Opacidad 0.5, no intrusivo |
| **Murciélagos** | `murcielagos.png` / `murcielagos (1).png` | Capa atmosférica flotante de fondo y separador en portada | Trayectoria horizontal en segundo plano |
| **Fantasmas** | `fantasma.png` / `fantasma (1).png` | Estados vacíos de biblioteca, búsqueda sin resultados y alertas | Animación de levitación vertical |
| **Zombi** | `zombi.png` | Estado "Dropped / Abandonado" y juegos de terror en Biblioteca | Badge decorativo |
| **Poción / Jugo** | `jugo.png` | Barra de nivel y progreso de XP del jugador | Reemplazo temático de poción de mana/vida |
| **Fiesta / Dulces** | `fiesta-de-halloween.png` / `comida-de-halloween.png` | Pestaña de Eventos comunitarios y Foro | Icono de cabecera de hilos temáticos |
| **Calendario** | `calendario-de-halloween.png` | Fechas de lanzamiento en Rift y conteo regresivo | Reemplazo de icono de fecha |
| **Caras / Obsesionado** | `obsesionado.png` / `globo.png` | Reacciones de reviews de juegos (Critical Hit / Spooky) | Sticker de reacción |

---

## 3. Decoración del Hero y Títulos de la Portada

En `src/app/page.tsx`:
- **Badge superior:** Sustituir o complementar con:
  ```tsx
  <div className="eyebrow halloween-hero-badge flex items-center gap-2">
    <Image src="/icons/halloween/calabaza.png" alt="" width={16} height={16} unoptimized />
    <span>SPOOKY CHECKPOINT // EDICIÓN NOCHE DE BRUJAS</span>
  </div>
  ```
- **Título principal:**
  ```tsx
  <h1 className="halloween-glow-text">
    CADA JUEGO. CADA PARTIDA. <br />
    <span className="accent-halloween">TU HISTORIA EMBRUJADA.</span>
  </h1>
  ```
- **Esquinas con telarañas:**
  Posicionar `/icons/halloween/telarana-de-halloween.png` con `position: absolute; top: 0; right: 0; width: 64px; pointer-events: none; opacity: 0.45;`.

---

## 4. Estilos CSS Requeridos (`src/app/halloween.css`)

```css
/* Logo Halloween */
.brand-halloween {
  display: flex;
  align-items: center;
  gap: 12px;
  position: relative;
}
.brand-halloween .accent {
  color: #ff6b00 !important;
  text-shadow: 0 0 10px rgba(255, 107, 0, 0.7);
}
.brand-halloween-pumpkin {
  width: 20px;
  height: 20px;
  object-fit: contain;
  animation: pumpkin-candle-flicker 2.5s infinite ease-in-out;
}
@keyframes pumpkin-candle-flicker {
  0%, 100% { filter: drop-shadow(0 0 6px #ff6b00) brightness(1); }
  50% { filter: drop-shadow(0 0 12px #ff8800) brightness(1.25); }
}

/* Telaraña de esquina */
.corner-web {
  position: absolute;
  top: 0;
  right: 0;
  width: 52px;
  height: 52px;
  pointer-events: none;
  opacity: 0.45;
}
```
