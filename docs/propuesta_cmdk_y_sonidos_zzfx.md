# Propuesta de Implementación: Buscador HUD (`cmdk`) y Audio Chiptune 8-bit (`ZzFX`)

**Fecha:** 7 de octubre de 2026  
**Origen:** Investigación y Auditoría (`research/antigravity`)  
**Destino:** Equipo de Implementación (`implementation/chatgpt` / Codex)  
**Propósito:** Especificación técnica para incorporar el modal global de búsqueda `Ctrl + K` (`cmdk`) y efectos de sonido retro procedurales (`ZzFX`) sin penalizar el bundle ni agregar archivos de audio pesados.

---

## 1. Justificación y Objetivos de UX

Con la plataforma formalmente desplegada y operativa en producción ([`https://savestate-eight.vercel.app`](https://savestate-eight.vercel.app)), esta propuesta aborda dos oportunidades de alto retorno identificadas en la auditoría:

1. **Cumplimiento del Wireframe Fundacional (`Ctrl + K`):**
   * El documento `05_diseno_y_plan_savestate.md` establece en la barra HUD superior: `[🔍 Buscar juego... (Ctrl+K)]`.
   * Permite a los jugadores buscar títulos del catálogo, navegar a secciones clave (Explorar, Listas, Feed, Perfil) y ejecutar comandos de terminal sin usar el ratón.
2. **Inmersión Sensorial Gamer (Feedback Chiptune 8-bit):**
   * El HUD cyberpunk y retro-futurista gana una dimensión interactiva auténtica al emitir micro-sonidos de 8 bits al pulsar botones, marcar un juego como `Platinum` o asestar un *Critical Hit* en una reseña.
   * Se descartan archivos estáticos `.mp3` o `.wav` para evitar consumo de red; se utiliza síntesis procedural en el navegador mediante Web Audio API (< 1 KB de código).

---

## 2. Componente A: Paleta de Comandos Global (`cmdk`)

### A. Dependencia y Características
* **Paquete:** `cmdk` (v1.x, por Paco Coursey).
* **Impacto en Bundle:** ~6 KB gzipped. Cero dependencias transitivas.
* **Compatibilidad:** 100% compatible con React 19 y Server Components en Next.js 16.
* **Instalación:**
  ```powershell
  npm i cmdk
  ```

### B. Diseño del Componente: `src/components/command-menu.tsx`
* **Activación:** Atajo global de teclado `Ctrl + K` (Windows/Linux) o `Cmd + K` (macOS), o clic en el buscador de la barra HUD.
* **Estética Cyberpunk (Tailwind v4):**
  * Fondo `surface-900` con borde neón `border-neon-cyan/40` y resplandor sutil.
  * Tipografía `Silkscreen` para encabezados de grupo y `JetBrains Mono` para resultados y descripciones.
* **Secciones del Menú:**
  1. **Navegación Directa:** *Explorar Catálogo*, *Mis Listas*, *Transmisión (Feed)*, *Mi Biblioteca*, *Mi Perfil*.
  2. **Búsqueda en Vivo:** Al escribir más de 2 caracteres, consulta con debounce a `/api/catalogue?search={query}` y lista títulos con su año y plataforma.
  3. **Comandos de Sistema:**
     * Conmutar efecto monitor CRT (`CRT Monitor On/Off`).
     * Conmutar efectos de audio retro (`Chiptune Audio On/Off`).
     * Cerrar sesión de usuario.

---

## 3. Componente B: Síntesis de Sonido Retro Chiptune (`ZzFX`)

### A. Estrategia de Cero Dependencias
* **No se instala ningún paquete npm:** El algoritmo generador cabe en un archivo TypeScript local en `src/lib/sound.ts` (< 1 KB).
* **Mecánica:** Modula frecuencias y ondas cuadradas/de sierra mediante la API nativa de audio del navegador (`window.AudioContext`).

### B. Especificación del Módulo: `src/lib/sound.ts`
* **Implementación:**
  ```typescript
  // src/lib/sound.ts
  'use client';

  // Micro-sintetizador Web Audio API procedural (inspirado en ZzFX)
  let audioCtx: AudioContext | null = null;

  function getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!audioCtx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) audioCtx = new AudioCtx();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  export function isAudioEnabled(): boolean {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('savestate_audio') !== 'disabled';
  }

  export function toggleAudio(): boolean {
    const next = !isAudioEnabled();
    localStorage.setItem('savestate_audio', next ? 'enabled' : 'disabled');
    return next;
  }

  // Generador de tono retro 8-bit
  function playTone(freq: number, duration: number, type: OscillatorType = 'square') {
    if (!isAudioEnabled()) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // Ignorar restricciones de autoplay si aún no hubo interacción
    }
  }

  // Sonidos temáticos expuestos para la interfaz
  export const soundFx = {
    // Clic en botones del HUD
    click: () => playTone(800, 0.04, 'square'),
    // Asestar reacción 'Critical Hit' en reseña
    criticalHit: () => {
      playTone(520, 0.06, 'sawtooth');
      setTimeout(() => playTone(1040, 0.12, 'square'), 60);
    },
    // Subir a 100% / Platinum (Logro desbloqueado)
    levelUp: () => {
      playTone(440, 0.08, 'square');
      setTimeout(() => playTone(554.37, 0.08, 'square'), 80);
      setTimeout(() => playTone(659.25, 0.15, 'square'), 160);
    },
    // Error de validación o acción denegada
    error: () => playTone(180, 0.12, 'sawtooth'),
  };
  ```

### C. Respeto Estricto a la Accesibilidad (RNF-05)
* El usuario puede silenciar todos los sonidos en cualquier momento desde la barra HUD o el menú `Ctrl + K`.
* La preferencia se almacena en `localStorage` (`savestate_audio: disabled`).
* Se respeta la política de *autoplay* de los navegadores (el contexto de audio solo se instancia tras el primer gesto de usuario).

---

## 4. Plan de Integración en el Código

1. **Instalación:**
   ```powershell
   npm i cmdk
   ```
2. **Creación de archivos:**
   * Crear `src/lib/sound.ts` con el generador de tonos y helpers de silenciado.
   * Crear `src/components/command-menu.tsx` utilizando `cmdk`.
3. **Puntos de conexión en componentes existentes:**
   * En `src/components/navigation.tsx`: Añadir el botón `[🔍 Ctrl+K]` que abra el Command Menu y un botón conmutador de audio (🔊 / 🔇).
   * En `src/components/review-card.tsx`: Invocar `soundFx.criticalHit()` al votar *Critical Hit*.
   * En `src/components/game-actions.tsx`: Invocar `soundFx.levelUp()` al guardar estado `platinum` o `cleared`.
4. **Verificación y Calidad:**
   * Ejecutar `npm run check` (linter, tipos estrictos y tests).
   * Ejecutar `npm run build` para asegurar compilación limpia en producción.

---

## 5. Consulta y Pasos a Seguir para Codex

¿Deseas proceder con la instalación de `cmdk` y la adición de `src/lib/sound.ts` en la rama de implementación (`implementation/chatgpt`), siguiendo la estructura planteada?
