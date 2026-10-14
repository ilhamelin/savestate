# Rework Visual y de Experiencia: "Haunted Memory Card // Checkpoint Terminal"

## 1. Diagnóstico del Componente Actual (`hero-terminal`)

El widget actual en el Hero de la portada (`src/app/page.tsx`):
- **Problema 1: Es 100% pasivo y estático.** Muestra un gamepad y nombres de estado (`[Playing]`, `[Backlog]`), pero el usuario no puede hacer nada con él.
- **Problema 2: Espacio negativo desaprovechado.** El rombo central ocupa 240px de alto con líneas tenues y sensación de vacío.
- **Problema 3: Falta de inmersión gamer.** No transmite la emoción de guardar partida ni la temática estacional.

---

## 2. Propuesta de Rework: "Haunted Memory Card & Interactive Checkpoint"

Transformar el widget estático en una **Memory Card holográfica interactiva** inspirada en las consolas de guardado de los 90s (tipo Memory Card PS1/GameCube) y las interfaces cyberpunk modernas (estilo Cyberpunk 2077 HUD / Metroid Prime).

### 2.1 Estructura del Componente Renovado

```
┌──────────────────────────────────────────────────────────────────┐
│ [● ● ●] savestate://slot-01/haunted-logbook.sav    🎃 LIVE HUD │ 🕸️ (Telaraña)
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│              ╭─────────────────────────────╮                     │
│              │       🦇    🌕    🦇        │                     │
│              │      ╭───────────────╮      │                     │
│              │      │   🎮  ×  🎃   │      │ (Holograma Flotante)│
│              │      ╰───────────────╯      │                     │
│              │     HAUNTED CHECKPOINT      │                     │
│              │    SLOT 01 // OVERWRITE     │                     │
│              ╰─────────────────────────────╯                     │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│ $ choose_your_state (Haz clic para probar tu estado):            │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐               │
│ │ 🟢 Playing   │ │ 🟣 Backlog   │ │ 🔵 Cleared   │ (Chips        │
│ └──────────────┘ └──────────────┘ └──────────────┘  Interactivos)│
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐               │
│ │ 🏆 Platinum  │ │ 🧟 Dropped   │ │ 🎃 Wishlist  │               │
│ └──────────────┘ └──────────────┘ └──────────────┘               │
│                                                                  │
│ > Telemetría dinámica según el botón activo:                     │
│   "Estado seleccionado: [Playing] · 14h registradas · Activo" █  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. Características de Interacción y UX

1. **Micro-interactividad en Vivo:**
   - Al pasar el cursor o hacer clic sobre cualquiera de los 6 estados (`Playing`, `Backlog`, `Cleared`, `100% Platinum`, `Dropped`, `Wishlist`), la tarjeta reacciona en tiempo real:
     - El holograma central cambia de color y aura (verde neón, azul cian, morado espectral o naranja Halloween).
     - La línea de comando inferior escribe dinámicamente un mensaje descriptivo gamer con cursor titilante:
       - *Playing:* `> [Playing] · Registra tus sesiones, horas y capturas en tiempo real.`
       - *Backlog:* `> [Backlog] · Tu cola de juegos pendientes organizada por prioridad.`
       - *Cleared:* `> [Cleared] · Historia principal finalizada. Checkpoint alcanzado.`
       - *Platinum:* `> [100% / Platinum] · Todos los logros y secretos completados.`
       - *Dropped:* `> [Dropped] · Dejado en pausa o abandonado. Siempre puedes volver.`
       - *Wishlist:* `> [Wishlist] · Monitoreo de descuentos y ofertas en PC.`
2. **Ambiente Halloween Integrado:**
   - **Borde de la tarjeta:** Resplandor dual en naranja calabaza (`#ff6b00`) y púrpura espectral (`#7928ca`) con `box-shadow: 0 0 25px rgba(255, 107, 0, 0.25), 0 0 50px rgba(121, 40, 202, 0.15)`.
   - **Esquina:** Telaraña `/icons/halloween/telarana-de-halloween.png` reposando en el borde superior derecho.
   - **Centro:** Fusión del gamepad retro con la calabaza resplandeciente (`calabaza.png`) flotando en un orbe de energía.
   - **Iconos temáticos:** Zombi (`zombi.png`) en el chip de Dropped, Fantasma (`fantasma.png`) en Backlog y Calabaza (`calabaza.png`) en Wishlist.

---

## 4. Implementación Técnica

### 4.1 Componente Cliente: `src/components/home/hero-checkpoint-card.tsx`
Crea el nuevo componente reactivo que reemplaza el contenido estático de `hero-terminal` en `src/app/page.tsx`:
- Estado local `selectedState` (por defecto `'playing'`).
- Animación de levitación suave (`animation: float 4s ease-in-out infinite`).
- Manejo de hover y click sin peticiones al servidor (100% cliente y ultra-rápido).

### 4.2 Estilos en `src/app/halloween.css`
- Clases para los chips interactivos de estado (`.checkpoint-state-pill`).
- Efecto de pulso holográfico concéntrico (`.hologram-ring`).
- Animaciones de cursor parpadeante terminal (`.terminal-prompt-cursor`).
