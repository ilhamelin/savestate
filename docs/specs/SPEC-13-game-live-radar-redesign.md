# SPEC-13: Rediseño Estético y Visual de Telemetría en Vivo (Live Game Radar)

> **Documento:** Especificación Técnica Quirúrgica de Entrega  
> **Rama de Especificación:** `main`  
> **Rama Destino de Implementación:** `implementation/chatgpt` (crear rama `feature/game-live-radar-redesign`)  
> **Destinatario:** OpenAI Codex / Lead Engineer  
> **Estado:** Listo para Implementación  
> **Prioridad:** Media-Alta (Experiencia de usuario, jerarquía visual y pulido estético en páginas de juegos de `/explore`)

---

## 1. Objetivo y Contexto

En las páginas de detalle de cada juego (`/games/[slug]`), accesibles desde la sección **Explorar** del catálogo, se encuentra el componente **Live Game Radar** (`GameLiveTelemetryView`). Este componente consume la API unificada de telemetría en vivo (`fetchGameLiveTelemetry`) que provee:
1. Jugadores concurrentes en tiempo real en **Steam**.
2. Canales en directo y espectadores acumulados en **Twitch**.
3. Ofertas de PC oficiales (Steam, GOG, Epic Games) y de **Instant Gaming** con conversión en vivo a Pesos Chilenos (CLP).
4. Mínimo histórico registrado.

### Problema Detectado (Diagnóstico Visual):
El diseño actual sufre de varias deficiencias estéticas y de espaciado:
1. **Espaciado desequilibrado en ofertas:** La lista de tiendas empuja el nombre del comercio hacia la izquierda (`margin-right: auto`) y amontona el precio y botón a la extrema derecha, dejando un vacío visual antiestético en el centro.
2. **Redundancia en precios sin descuento:** Cuando una tienda vende el juego a precio completo (0% descuento), se muestra el precio tachado exactamente igual al precio actual (ej: `$49.99 USD` tachado junto a `$49.99 USD`), lo cual transmite sensación de error o confusión.
3. **Píldoras y métricas planas:** Las estadísticas clave (jugadores de Steam, espectadores de Twitch, mínimo histórico) se muestran como simples etiquetas de 1px sin jerarquía, careciendo de pulso o estética retro-ciberpunk.
4. **Tarjetas de Twitch desalineadas:** Los títulos de las transmisiones varían entre 1 y 4 líneas, rompiendo la altura de las tarjetas y generando bordes desiguales. Además, no cuentan con micro-interacciones de hover ni viñetas oscuras que garanticen la legibilidad del contador de espectadores sobre capturas claras.
5. **Estilos acoplados en `globals.css`:** Las reglas CSS están dispersas en el archivo global en lugar de residir en una hoja de estilos modular y dedicada.

### Objetivo de SPEC-13:
Transformar el Live Game Radar en un panel táctico de alta fidelidad, coherente con el estilo cyberpunk/retro de SaveState, modularizando sus estilos en `src/styles/game-live-radar.css`, corrigiendo la jerarquía de precios y garantizando un diseño responsivo impecable.

---

## 2. Lista Exacta de Archivos a Crear / Modificar

| Acción | Archivo | Responsabilidad |
|---|---|---|
| **Crear** | `src/styles/game-live-radar.css` | Hoja de estilos dedicada con diseño glassmorphic, métricas tácticas con animación de pulso, grilla balanceada de ofertas y tarjetas multimedia de Twitch con clamp de texto y efectos de hover. |
| **Modificar** | `src/components/game-live-telemetry-view.tsx` | Importar `game-live-radar.css`, estructurar métricas en tarjetas KPI, corregir la renderización condicional de precios tachados (`savingsPercent > 0`), aplicar insignias de tiendas y limitar títulos de Twitch a 2 líneas. |
| **Modificar** | `src/app/globals.css` | Retirar las clases legadas de telemetría (líneas 4801–4889 y la regla en media query 4970–4972) para evitar colisiones y delegar la responsabilidad al nuevo módulo CSS. |
| **Crear** | `tests/unit/game-live-telemetry-view.test.ts` | Pruebas unitarias completas de renderizado del componente: presencia de métricas vivas, omisión de tachado redundante, insignias de tiendas y formato de streams de Twitch. |

---

## 3. Contratos de Tipos y Tokens Visuales

### Variables CSS y Tokens (`src/styles/game-live-radar.css`)

```css
:root {
  --radar-bg: #0b0f19e6;
  --radar-border: #1e293b;
  --radar-border-hover: #334155;
  --radar-steam-glow: #4ade8033;
  --radar-twitch-purple: #9146ff;
  --radar-twitch-glow: #9146ff33;
  --radar-low-gold: #f59e0b;
  --radar-discount-badge: #10b981;
  --radar-discount-text: #042f2e;
  --radar-instant-gaming: #ff6b35;
}
```

### Contrato de Props (`src/components/game-live-telemetry-view.tsx`)

El componente ya recibe:
```typescript
import type { GameLiveTelemetry } from '@/domain/game-live-telemetry';

export interface GameLiveTelemetryViewProps {
  title: string;
  data: GameLiveTelemetry;
}
```

No se alteran los contratos de datos existentes en `@/domain/game-live-telemetry`, garantizando 100% de compatibilidad con los servicios y APIs del proyecto.

---

## 4. Algoritmo de Diseño y Flujo de Implementación

### 4.1. Nueva Estructura Visual de `GameLiveTelemetryView`

```
┌────────────────────────────────────────────────────────────────────────┐
│ 📡 LIVE GAME RADAR // CACHÉ 5 MIN                        [SYS: ACTIVE] │
│ El pulso de The Witcher 3: Wild Hunt                                   │
├────────────────────────────────────────────────────────────────────────┤
│ [ 🟢 STEAM PLAYERS ]      [ 🔴 TWITCH VIEWERS ]   [ 🏷️ ALL-TIME LOW ]   │
│   68.285 jugando ahora      1.442 en 4 canales       $7.09 USD (~$6.9k)│
├────────────────────────────────────────────────────────────────────────┤
│ 🏷️ Ofertas Oficiales PC & Claves     [💱 Tasa ref: 1 USD ≈ $985 CLP]   │
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │ [GOG]     GOG.com           $49.99  [-50%]  $24.99 USD   [Ver ↗]   │ │
│ │                                             (~$24.607 CLP)         │ │
│ ├────────────────────────────────────────────────────────────────────┤ │
│ │ [STEAM]   Steam                             $49.99 USD   [Ver ↗]   │ │
│ │           (Sin descuento)                   (~$49.224 CLP)         │ │
│ ├────────────────────────────────────────────────────────────────────┤ │
│ │ [KEYSHOP] Instant Gaming    Claves PC      Buscar oferta [Ver ↗]   │ │
│ └────────────────────────────────────────────────────────────────────┘ │
├────────────────────────────────────────────────────────────────────────┤
│ 📺 Twitch Live Radar (Transmisiones en Vivo)                           │
│ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐│
│ │ [Thumbnail]   │ │ [Thumbnail]   │ │ [Thumbnail]   │ │ [Thumbnail]   ││
│ │ 🔴 940 esp.   │ │ 🔴 244 esp.   │ │ 🔴 155 esp.   │ │ 🔴 103 esp.   ││
│ │ @Freyja       │ │ @TheDropCreat.│ │ @TembraK      │ │ @tyrisftw     ││
│ │ Deathmarch! D.│ │ [DROPS] SUB=B.│ │ The Witcher 3.│ │ [DROPY] WEEKE.││
│ └───────────────┘ └───────────────┘ └───────────────┘ └───────────────┘│
├────────────────────────────────────────────────────────────────────────┤
│ ℹ️ Precios y disponibilidad sujetos a tienda. Conversión horaria CLP…   │
└────────────────────────────────────────────────────────────────────────┘
```

### 4.2. Especificaciones de Componentes

#### A. Encabezado Táctico (`.radar-header`)
- **Eyebrow:** Fuente monoespaciada, etiqueta `LIVE GAME RADAR // CACHÉ 5 MIN` con icono de señal (`📡`).
- **Título:** `<h2>El pulso de {title}</h2>` con tipografía limpia y sombra de texto sutil.

#### B. Tarjetas KPI de Telemetría (`.radar-stats-cluster`)
En lugar de píldoras simples, se renderizan 3 tarjetas métricas responsivas (`display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0.75rem;`):
1. **Steam Concurrency Card:**
   - Indicador verde con animación de pulso `@keyframes live-radar-pulse`.
   - Cifra grande y destacada (`font-size: 1.35rem; font-weight: 700; color: #4ade80`).
   - Etiqueta: `jugando ahora en Steam`.
2. **Twitch Viewership Card:**
   - Indicador carmesí/púrpura con animación de pulso.
   - Cifra destacada (`font-size: 1.35rem; font-weight: 700; color: #ff718e`).
   - Etiqueta: `espectadores en directo (Top 4)`.
3. **Historical Low Card:**
   - Icono dorado `🏷️`.
   - Cifra destacada en USD (`font-size: 1.35rem; font-weight: 700; color: #f59e0b`).
   - Subtexto: CLP formateado + `mínimo histórico registrado`.

#### C. Grilla de Ofertas PC (`.radar-deals-container`)
- **Cabecera de ofertas:** Título con icono de etiqueta y píldora monoespaciada para la tasa de cambio (`💱 1 USD ≈ $X CLP`).
- **Filas de oferta (`.radar-deal-row`):**
  - **Identidad de tienda (`.radar-store-badge`):**
    - Insignia estilizada según tienda:
      - `Steam`: fondo oscuro con borde celeste `#66c0f440` y texto `#66c0f4`.
      - `GOG`: fondo oscuro con borde morado `#d874fc40` y texto `#d874fc`.
      - `Epic Games`: fondo oscuro con borde gris claro.
      - Otras tiendas: insignia neutra.
  - **Bloque de precios (`.radar-price-block`):**
    - **Si `deal.savingsPercent > 0`:**
      - Mostrar `<del>` con precio original en USD y CLP pequeño.
      - Mostrar insignia de descuento `span.radar-savings-tag` (`-{deal.savingsPercent}%`) con fondo verde esmeralda y alto contraste.
      - Mostrar precio final destacado en USD con precio en CLP abajo en monoespaciado.
    - **Si `deal.savingsPercent === 0`:**
      - **NO mostrar `<del>`** (elimina la redundancia visual). Mostrar directamente el precio actual en USD con su conversión a CLP.
  - **Fila Instant Gaming (`.radar-instant-gaming-row`):**
    - Insignia destacada `KEYSHOP` en color naranja `#ff6b35`.
    - Etiqueta descriptiva "Claves digitales PC" con subtexto "Comparar mejor oferta".
  - **Botón de acción:** Botón con borde nítido, micro-elevación en hover (`translateY(-1px)`) y texto `Ver oferta ↗`.

#### D. Tarjetas de Transmisiones en Vivo (`.radar-streams-grid`)
- **Contenedor:** Grilla responsiva de 4 columnas (`grid-template-columns: repeat(auto-fit, minmax(min(100%, 230px), 1fr)); gap: 1rem;`).
- **Tarjeta (`.radar-stream-card`):**
  - Fondo oscuro glassmorphic con borde sutil. En hover: resplandor púrpura de Twitch (`border-color: #9146ff80; box-shadow: 0 8px 24px -4px rgba(145, 70, 255, 0.2); transform: translateY(-3px);`).
  - **Miniatura 16:9 (`.radar-stream-thumb`):**
    - Esquinas redondeadas (`border-radius: 8px`).
    - Viñeta oscura inferior degradada (`linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.85) 100%)`).
    - Píldora de estado sobre la imagen: `🔴 EN VIVO · X esp.` con fondo semitransparente oscuro y sombra para garantizar legibilidad.
    - Zoom suave en imagen al pasar el cursor (`transform: scale(1.04); transition: transform 0.3s ease;`).
  - **Nombre del streamer:** Texto en negrita con icono sutil o color púrpura.
  - **Título del stream:** Clamp de texto estricto a 2 líneas:
    ```css
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    height: 2.7rem;
    font-size: 0.8rem;
    line-height: 1.35;
    color: #cbd5e1;
    ```
    Incluir `title={stream.title}` en el elemento para tooltip nativo accesible.

#### E. Nota Legal / Pie de Telemetría (`.radar-footer`)
- Caja informativa con borde tenue, icono informativo `ℹ️`, tipografía `0.72rem` atenuada y enlace a ExchangeRate-API.

---

## 5. Criterios de Aceptación Deterministas y Casos Borde

1. **Jerarquía Visual y Ausencia de Redundancias:**
   - Cuando un juego tiene descuento (`savingsPercent > 0`), se visualiza el precio tachado y la insignia de porcentaje (`-X%`).
   - Cuando un juego no tiene descuento (`savingsPercent === 0`), **nunca se muestra el precio tachado duplicado**.
2. **Estabilidad de Altura en Streams de Twitch:**
   - Todas las tarjetas de Twitch en una misma fila deben tener exactamente la misma altura, sin importar si el streamer tiene un título de 1 palabra o de 150 caracteres (garantizado por el clamp a 2 líneas con altura fija).
3. **Animación de Pulso Suave:**
   - Los puntos indicadores de Steam y Twitch deben tener una animación de pulso `@keyframes live-radar-pulse` sutil (sin parpadeos molestos).
   - Debe respetar `@media (prefers-reduced-motion: reduce)` desactivando la animación de pulso y las transiciones de transformación.
4. **Manejo de Estados Vacíos:**
   - Si no hay jugadores ni ofertas ni streams, se muestra el aviso `.notice` amigable existente.
5. **Calidad de Código y Suite de Pruebas:**
   - `npm test` debe superar el 100% de los tests (mínimo 438 tests existentes + nuevos tests).
   - `npm run typecheck` debe compilar con 0 errores TypeScript.
   - `npm run lint` debe ejecutarse con 0 advertencias/errores ESLint.
   - `npm run format:check` debe ser 100% conforme con Prettier.
