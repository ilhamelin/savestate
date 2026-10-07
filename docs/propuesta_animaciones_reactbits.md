# Propuesta de Enriquecimiento Visual: Componentes de Animación Retro (React Bits)
**Fecha:** 7 de octubre de 2026
**Origen:** Auditoría e Investigación (`research/antigravity`)
**Destino:** Equipo de Implementación (`implementation/chatgpt` / Codex)
**Propósito:** Proponer la adopción de componentes seleccionados de animación temática retro/cyberpunk inspirados en React Bits (`reactbits.dev`) para elevar la experiencia visual sin comprometer el rendimiento ni inflar dependencias pesadas.

---

## 1. Justificación y Filosofía Técnica

SaveState tiene una identidad visual definida en los requerimientos fundacionales: **Cyberpunk + Pixel Art retro-futurista (HUD, terminal hacker, modo oscuro void-950, acentos neón)**.

La biblioteca abierta **React Bits (`reactbits.dev`)** encaja con los principios aprobados del proyecto porque:
1. **Adopta el modelo copy-paste (estilo shadcn/ui):** No se instala como una librería npm externa monolítica ni agrega dependencias transitivas vulnerables; se incorporan únicamente los componentes específicos como archivos TypeScript limpios en `src/components/ui/`.
2. **Compatibilidad nativa con Tailwind CSS y React 19:** Utiliza CSS moderno y hooks estándar de React.
3. **Respeto a la Accesibilidad (RNF-05):** Todos los efectos deben verificar `window.matchMedia('(prefers-reduced-motion: reduce)')` para desactivar las transiciones si el usuario lo requiere.

---

## 2. Componentes Seleccionados para Primera Fase

Proponemos una adopción progresiva enfocada en dos componentes de alto impacto y bajo costo computacional:

### Componente 1: `DecryptedText` (Efecto Terminal Hacker)
* **Inspiración:** `Decrypted Text` de React Bits.
* **Ubicación objetivo:**
  1. La línea de estado del perfil del jugador (`src/app/players/[username]/page.tsx`):
     ```bash
     user@savestate:~$ Playing Chrono Trigger
     ```
  2. Al revelar una reseña con alerta de spoiler en `src/components/review-card.tsx`.
* **Comportamiento:** Al renderizar o interactuar, los caracteres oscilan rápidamente entre glifos aleatorios (código binario, caracteres ASCII o símbolos retro) antes de fijar el texto real, emulando la carga de un volcado de memoria o terminal bash.
* **Implementación técnica sugerida:** `src/components/ui/decrypted-text.tsx` usando `requestAnimationFrame` o `setInterval` con limpieza estricta en `useEffect`. Si `prefers-reduced-motion` está activo, se renderiza el texto final de forma inmediata.

### Componente 2: `NumberTicker` (Contador Numérico Dinámico)
* **Inspiración:** `Animated Counter` de React Bits.
* **Ubicación objetivo:**
  - Sección de estadísticas del perfil (`src/components/player-statistics.tsx`):
    - Contador de **Horas registradas**.
    - Contador de **Juegos en biblioteca** y **Juegos completados**.
* **Comportamiento:** Cuando la vista entra en pantalla, el número asciende de forma suave y escalonada desde 0 hasta el valor real (ej. `0.0 -> 124.5 h`), generando una sensación de progresión y recompensa gamificada.
* **Implementación técnica sugerida:** `src/components/ui/number-ticker.tsx` con soporte para decimales (`step="0.1"` o `toFixed(1)`).

---

## 3. Plan de Integración en el Flujo de Trabajo

1. **Creación de componentes UI:** Ubicar los archivos en `src/components/ui/` con tipos TypeScript estrictos.
2. **Sustitución progresiva:**
   - En `src/app/players/[username]/page.tsx`, envolver el párrafo `.profile-terminal` con `<DecryptedText text={...} />`.
   - En `src/components/player-statistics.tsx`, renderizar las cifras clave con `<NumberTicker value={...} />`.
3. **Validación de Calidad y Despliegue:**
   - Ejecutar `npm run check`.
   - Desplegar a producción con `npx vercel --prod`.

---

## 4. Opciones Futuras (Fase Posterior)
- **`SpotlightCard` / `PixelCard`:** Efecto de resplandor neón o rastro de píxeles al hacer hover sobre las tarjetas de juegos (`GameCard`).
- **`GridBackground`:** Malla sutil interactiva de puntos en el fondo del layout global.
