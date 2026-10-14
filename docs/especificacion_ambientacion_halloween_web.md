# Especificación Técnica: Ambientación de Halloween para SaveState

## 1. Resumen y Propuesta Visual

Esta especificación detalla la transformación temática estacional de SaveState para Halloween, conservando la identidad **retro-gamer / cyberpunk** de la plataforma e introduciendo:
1. **Nuevo fondo temático oficial:** Reemplazo o variante de ambientación Halloween (`savestate_halloween_grid.jpg`), fusionando la icónica cuadrícula synthwave en neón naranja y violeta con niebla nocturna, lunas llenas, arcade cabinets en sombras y calabazas resplandecientes.
2. **Efecto dinámico de murciélagos volando:** Animación liviana y fluida de siluetas de murciélagos cruzando el cielo en segundo plano mediante CSS acelerado por GPU (`pointer-events: none`).
3. **Calabazas con cara tallada (Jack-o'-lanterns):** Iconos vectoriales y pixel-art con parpadeo suave de vela distribuidos armónicamente en el Header, Hero, pie de página y esquinas de tarjetas.

---

## 2. Activos Gráficos y Ubicación

### 2.1 Fondo de Halloween
- **Archivo:** `public/wallpapers/savestate_halloween_grid.jpg` (Generado en proporción 16:9 de alta resolución).
- **Composición:** Piso de cuadrícula en perspectiva con neón naranja (`#ff6b00`) y violeta (`#7928ca`), niebla baja, siluetas de gabinetes arcade clásicos, calabazas iluminadas en la base y cielo nocturno profundo con luna llena para garantizar 100% de legibilidad en todos los textos y tarjetas.

---

## 3. Arquitectura de Componentes

### 3.1 Componente: `src/components/halloween/halloween-bats.tsx`
Crea una capa atmosférica de murciélagos animados que cruzan la pantalla periódicamente sin afectar el rendimiento ni el scroll.
- **Tecnología:** SVG inline liviano con animaciones CSS `@keyframes bat-fly` y `@keyframes bat-flap`.
- **Propiedades:** `fixed inset-0 pointer-events-none z-0 overflow-hidden`.
- **Accesibilidad:** Desactivado automáticamente si el usuario tiene activo `prefers-reduced-motion`.

```tsx
'use client';
export function HalloweenBats() {
  return (
    <div className="halloween-bats-container" aria-hidden="true">
      <div className="bat bat-1" />
      <div className="bat bat-2" />
      <div className="bat bat-3" />
      <div className="bat bat-4" />
      <div className="bat bat-5" />
    </div>
  );
}
```

### 3.2 Componente: `src/components/halloween/jack-o-lantern.tsx`
Renderiza una calabaza con cara tallada (ojos triangulares y sonrisa siniestra resplandeciente) con animación de llama vacilante:
- **Variantes de tamaño:** `small` (18px, para headers y badges), `medium` (32px), `large` (48px, para footer y hero).
- **Animación:** `@keyframes pumpkin-glow` que simula la luz de una vela titilando en su interior.

### 3.3 Integración en Puntos Clave de la Web:
1. **Header (`src/components/header.tsx`):**
   - Una calabaza pequeña con cara resplandeciente al lado del logo `SAVE<span className="accent">STATE</span>`.
2. **Hero de la Portada (`src/app/page.tsx`):**
   - Un badge temático: `🎃 HALLOWEEN NIGHT // SPECIAL CHECKPOINT`.
3. **Footer (`src/app/layout.tsx`):**
   - Dos calabazas decorativas en los extremos del `site-footer` acompañando la leyenda *"INSERT COIN · KEEP PLAYING"*.
4. **Fondo Global (`src/app/globals.css`):**
   - Regla CSS para el fondo del `body`:
     ```css
     body.theme-halloween,
     body {
       background-color: #08070b;
       background-image:
         radial-gradient(ellipse at 50% 15%, rgba(18, 10, 26, 0.55) 0%, rgba(8, 7, 11, 0.94) 80%),
         url('/wallpapers/savestate_halloween_grid.jpg');
       background-repeat: no-repeat;
       background-position: top center;
       background-attachment: fixed;
       background-size: cover;
     }
     ```

---

## 4. Archivo de Estilos: `src/app/halloween.css`
Contiene todas las animaciones y estilos de la ambientación para mantener el código desacoplado y limpio:
- `@keyframes bat-cross`: Vuelo horizontal con pequeña ondulación vertical.
- `@keyframes bat-wing-flap`: Aleteo de alas en dos fases.
- `@keyframes candle-flicker`: Variación sutil de intensidad lumínica en los ojos y boca de las calabazas.
