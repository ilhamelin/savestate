# SPEC-03: Tarjeta Virtual Gamer 3D (Memory Card PS1 / Cartucho Game Boy)

> **Documento:** Especificación Técnica Quirúrgica de Entrega  
> **Rama de Especificación:** `research/antigravity`  
> **Rama Destino de Implementación:** `implementation/chatgpt`  
> **Destinatario:** OpenAI Codex / Lead Engineer  
> **Prioridad:** Media-Alta (Viralidad en Redes, Identidad Visual y Fidelización)

---

## 1. Objetivo y Contexto

Actualmente, el perfil del jugador en `/players/[username]` cuenta con una utilidad en `src/components/memory-card-export.tsx` que permite descargar un PNG estático de 1080×1350 px. Sin embargo, no existe una **experiencia interactiva inmersiva en pantalla**.

Esta especificación evoluciona ese componente a un **Objeto 3D Interactivo en CSS Puro (sin librerías pesadas tipo Three.js)**:
1. **Interactividad 3D con Inclinación (*Tilt & Specular Glare*):** El cartucho o tarjeta reacciona al movimiento del ratón o al giroscopio táctil en móviles, mostrando un reflejo de luz dinámico sobre el plástico moldeado.
2. **Selector de Chasis Retro (*Skin Switcher*):**
   * **Modo A (PS1 Memory Card):** Carcasa gris texturizada, bloques de guardado (15 blocks), LED indicador y etiqueta adhesiva manuscrita.
   * **Modo B (Game Boy Cartridge):** Carcasa gris DMG clásica o Púrpura Atómico translúcido, hendidura de extracción superior y etiqueta holográfica con el Top 1 / GOTY del jugador.
3. **Reverso 3D con Código QR Dinámico:** Botón de giro de 180° que muestra la parte trasera con tornillo metálico de seguridad *Gamebit* y un código QR que apunta a la URL pública del perfil.
4. **Conservación de la Exportación PNG:** Mantiene la descarga en alta resolución con Canvas para compartir en Instagram Stories / X.

---

## 2. Lista Exacta de Archivos a Crear / Modificar

| Acción | Archivo | Responsabilidad |
|---|---|---|
| **Modificar** | `src/components/memory-card-export.tsx` | Envolver la tarjeta en el contenedor interactivo 3D con selector de chasis y botón de giro (Flip 180°). |
| **Crear** | `src/components/retro-card-3d.tsx` | Componente visual del objeto 3D con las caras Frontal y Trasera, efectos de sombra y luz en CSS. |
| **Crear** | `src/styles/retro-card-3d.css` (o clases en Tailwind v4) | Reglas de transformación 3D (`perspective`, `transform-style: preserve-3d`, `backface-visibility: hidden`). |
| **Modificar** | `src/lib/memory-card-export.ts` | Soporte para exportar tanto el diseño de Memory Card PS1 como el de Cartucho Game Boy. |
| **Crear** | `tests/unit/retro-card-3d.test.ts` | Suite de pruebas unitarias para el renderizado accesible, alternancia de chasis y respeto de `prefers-reduced-motion`. |

---

## 3. Contratos de Tipos Estrictos (TypeScript)

En `src/domain/memory-card.ts` (o dentro de `src/lib/memory-card-export.ts`):

```typescript
export type CardShellSkin = 'ps1_memory_card' | 'gameboy_cartridge' | 'atomic_purple';

export interface CardTiltState {
  rotateX: number; // Grados de rotación vertical (-15 a 15)
  rotateY: number; // Grados de rotación horizontal (-15 a 15)
  glareX: number;  // Porcentaje del destello (0 a 100)
  glareY: number;  // Porcentaje del destello (0 a 100)
  isFlipped: boolean; // Si está mostrando el reverso con el QR
}

export interface InteractiveCardProps {
  username: string;
  avatarUrl: string | null;
  clearRate: number;
  hours: number;
  topGames: Array<{
    id: string;
    title: string;
    coverUrl: string | null;
  }>;
  terminalStatus?: string;
  defaultSkin?: CardShellSkin;
}
```

---

## 4. Algoritmo y Flujo de Lógica Paso a Paso

### 4.1. Física e Interactividad CSS 3D (Cero dependencias)
1. El contenedor exterior aplica `perspective: 1200px`.
2. El contenedor interno de la tarjeta aplica `transform-style: preserve-3d` y transición suave de `transform 0.15s ease-out`.
3. Evento `onMouseMove`:
   ```typescript
   const rect = containerRef.current.getBoundingClientRect();
   const x = (event.clientX - rect.left) / rect.width; // 0 a 1
   const y = (event.clientY - rect.top) / rect.height; // 0 a 1
   const rotateX = (0.5 - y) * 24; // Grados
   const rotateY = (x - 0.5) * 24; // Grados
   ```
4. El destello (*glare*) se proyecta en una capa superior absoluta con:
   `background: radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255,255,255,0.25) 0%, transparent 60%)`.

### 4.2. Caras Frontal y Trasera (*Flip 180°*)
1. La cara frontal (`.card-front`) contiene la calcomanía con los datos del jugador, Top 4 favoritos y horas.
2. La cara trasera (`.card-back`) tiene `transform: rotateY(180deg)` y `backface-visibility: hidden`. Contiene:
   - Tornillo Gamebit metálico en relieve.
   - Código QR SVG generado dinámicamente apuntando a `https://savestate-eight.vercel.app/players/${username}`.
   - Número de serie: `SS-MODEL-1996 · MADE BY SAVESTATE`.

### 4.3. Accesibilidad (`prefers-reduced-motion`)
* Si la media query `(prefers-reduced-motion: reduce)` está activa:
  - `rotateX` y `rotateY` permanecen estrictamente en `0deg`.
  - El giro (*Flip*) ocurre sin animación de transición tridimensional.

---

## 5. Criterios de Aceptación Deterministas

1. **Rendimiento:** Cero uso de Three.js / WebGL pesado; renderizado exclusivamente con aceleración por hardware CSS (`transform3d`). El bundle debe crecer en menos de 5 KB.
2. **Comportamiento en Móviles:** En pantallas táctiles, el toque inclina la tarjeta suavemente y un botón visible `[🔄 Girar Tarjeta]` permite voltearla al código QR.
3. **Exportación PNG:** El botón existente de descarga genera la imagen con el chasis seleccionado.
4. **Verificación CI en la Nube:**
   * `npx tsc --noEmit` sin errores de tipos.
   * `npm run lint` limpio.
   * `npm test` pasa todos los tests unitarios (nuevos tests de `retro-card-3d.test.ts` pasando, total >= 345 tests).
