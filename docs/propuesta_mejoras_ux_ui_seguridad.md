# Propuesta Técnica: Refinamiento UX/UI, Optimización Perceptual y Endurecimiento de Seguridad

**Fecha:** 7 de octubre de 2026  
**Rama:** `research/antigravity`  
**Origen:** Auditoría e Investigación (`research/antigravity`)  
**Destino:** Equipo de Implementación (`implementation/chatgpt` / Codex)  
**Propósito:** Transformar una solicitud genérica de "arreglos visuales, optimización y seguridad" en un plan de acción quirúrgico, medible y seguro para el proyecto SaveState.

---

## 1. Diagnóstico de la Solicitud Inicial

### La Petición Original:
> *"Quiero que hagas arreglos visuales, ajustar tamaños y posiciones que he visto en mala posicion, tambien optimizar si es necesario y si se puede las respuestas, osea un ajuste de UX/UI y tambien haz aplicaciones de mejora para la seguridad de la web."*

### Por qué esta formulación es riesgosa para un modelo de código:
1. **Ambigüedad de alcance:** Frases como *"tamaños y posiciones que he visto en mala posición"* obligan al agente a adivinar qué pantalla, qué dispositivo (móvil vs. monitor ultrawide) o qué componente causó el problema. El agente podría alterar elementos intencionales (como esquinas recortadas de terminal o márgenes asimétricos estilo HUD).
2. **Riesgo de sobre-ingeniería:** *"Optimizar si se puede las respuestas"* puede inducir refactorizaciones peligrosas de caché o consultas en lugar de mejoras perceptuales de feedback.
3. **Seguridad difusa:** *"Mejora para la seguridad"* sin un objetivo concreto suele provocar la instalación de librerías innecesarias o bloqueos de CORS/CSP que rompan recursos externos (carátulas de IGDB o WebSockets de Supabase).

---

## 2. Propuesta Estructurada en Tres Pilares

---

### 🎨 Pilar 1: Refinamiento Visual y Responsividad (Layout & Polish)

| Componente | Hallazgo / Oportunidad | Solución Técnica Sugerida |
|---|---|---|
| **`header.tsx` y navegación móvil** | En pantallas estrechas (<640px), la combinación de logo, buscador, temas y avatar de usuario puede colapsar o envolver líneas de forma desordenada. | Implementar menú hamburguesa / drawer colapsable o barra HUD inferior fija para navegación móvil en smartphones. |
| **`game-card.tsx`** | Juegos con títulos extensos (*"The Legend of Zelda: A Link to the Past"*) pueden desnivelar la altura de las tarjetas en la rejilla de catálogo. | Fijar relación de aspecto estricta en carátulas (`aspect-[3/4]`) con `object-cover` y truncar títulos a 2 líneas (`line-clamp-2 min-h-[3rem]`) para mantener las filas perfectamente niveladas. |
| **Top 4 Favoritos (`player-statistics.tsx` / perfil)** | En tablets o pantallas intermedias (640px–1024px), las 4 tarjetas pueden quedar apretadas o deformar sus marcos neón. | Usar una rejilla adaptable: `grid-cols-2 sm:grid-cols-4 gap-3` manteniendo bordes pixelados nítidos sin desbordamiento horizontal. |
| **Formularios de Play Log y Reseña** | Los selectores de fecha, estrellas y estado pueden sentirse muy condensados en pantallas táctiles móviles. | Aumentar el área táctil mínima (*touch target* >= 44x44px) en botones HUD y dar espaciado consistente (`space-y-4`). |

---

### ⚡ Pilar 2: Optimización Perceptual y Rendimiento de Respuesta (UX)

La lentitud percibida en la web casi nunca es del servidor; suele deberse a la **ausencia de feedback inmediato en el cliente**:

1. **Skeletons Temáticos de Carga:**
   * Mientras Next.js resuelve Server Components en `/games/[slug]` o `/explore`, mostrar esqueletos con estética de escaneo CRT (*scanline pulse*) en lugar de pantallas congeladas.
2. **Actualizaciones Optimistas (*Optimistic UI*):**
   * Al hacer clic en un estado de biblioteca (ej. marcar como `Playing` o reaccionar `Critical Hit`), cambiar el estado visual y reproducir el feedback de inmediato en el cliente con `useOptimistic` de React 19, confirmando la mutación en segundo plano.
3. **Debounce en Búsquedas de Cabecera:**
   * Calibrar el retardo de búsqueda en `header-search.tsx` a **300 ms** con cancelación de peticiones anteriores mediante `AbortController`, evitando ráfagas redundantes al servidor.

---

### 🛡️ Pilar 3: Endurecimiento de Seguridad Web (*Security Hardening*)

El proyecto ya cuenta con RLS en 14 tablas y CSP con `nonce` en `src/proxy.ts`. Las siguientes mejoras elevan la postura de seguridad sin tocar la base arquitectónica:

1. **Cabeceras de Seguridad Complementarias en `src/proxy.ts`:**
   * `Permissions-Policy: camera=(), microphone=(), geolocation=(), browsing-topics=()` (desactiva APIs de hardware no utilizadas por SaveState).
   * `Referrer-Policy: strict-origin-when-cross-origin`.
   * `X-Frame-Options: DENY` (complemento explícito al ya existente `frame-ancestors 'none'`).
2. **Validación y Límite de Longitud Estricto en Inputs:**
   * En `community-forms.tsx` y `library-forms.tsx`, validar longitudes máximas tanto en cliente como en servidor (`review.content` <= 10.000 caracteres, `terminal_status` <= 160 caracteres), previniendo abusos de almacenamiento en PostgreSQL.
3. **Sanitización de Salida en Enlaces Externos:**
   * Asegurar que todo enlace a perfiles de terceros (Steam, Discord, Twitch, GitHub) mantenga estrictamente `rel="noopener noreferrer" target="_blank"` (ya validado en dominio, reforzar en renderizado).

---

## 3. Prompt Maestro Optimizado para Enviar a Codex (ChatGPT)

El usuario puede copiar este prompt optimizado y reemplazar la sección entre corchetes con los detalles puntuales que detectó:

```markdown
Hola Codex, queremos realizar un sprint de refinamiento visual (UX/UI), optimización de respuestas y endurecimiento de seguridad en SaveState. He preparado la directiva técnica en `docs/propuesta_mejoras_ux_ui_seguridad.md`.

Por favor, aborda las siguientes tareas organizadas por prioridad:

### 1. Ajustes Visuales y de Layout (Puntualizar si aplica):
- [INSERTAR AQUÍ: Ej. En la vista de móvil de /explore el buscador se desborda / En el perfil las tarjetas de Top 4 no quedan alineadas / etc.]
- En `game-card.tsx`: asegura altura uniforme en la rejilla usando relación de aspecto fija (aspect-[3/4]) y truncamiento a 2 líneas en títulos largos (line-clamp-2).
- En `header.tsx`: revisa que en resoluciones móviles (<640px) los controles del HUD no se solapen.

### 2. Optimización de Respuestas y Feedback (UX):
- Incorpora estados de carga visuales (Skeletons con estética retro/scanline) en Server Components para evitar pantallas congeladas durante búsquedas o navegación.
- Asegura debounce de 300 ms con AbortController en las búsquedas en vivo de `header-search.tsx`.

### 3. Endurecimiento de Seguridad (Hardening en `src/proxy.ts`):
- Agrega las cabeceras `Permissions-Policy: camera=(), microphone=(), geolocation=()` y `Referrer-Policy: strict-origin-when-cross-origin`.
- Verifica que ningún input de texto supere los límites establecidos en las restricciones de base de datos.

Mantén intacta la convención nativa de `src/proxy.ts` y ejecuta `npm run check` al finalizar para certificar tipos, linter y tests.
```
