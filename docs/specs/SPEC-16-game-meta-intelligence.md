# SPEC-16: Game Meta Intelligence (HowLongToBeat, ProtonDB / Steam Deck & Speedrun World Records)

> **Documento:** Especificación Técnica Quirúrgica de Entrega  
> **Rama de Especificación:** `main`  
> **Rama Destino de Implementación:** `implementation/chatgpt` (crear rama `feature/game-meta-intelligence`)  
> **Destinatario:** OpenAI Codex / Lead Engineer  
> **Estado:** Listo para Implementación  
> **Prioridad:** Alta (Inteligencia de juego, valor práctico para el jugador y contenido competitivo)

---

## 1. Objetivo y Contexto

SaveState cuenta con telemetría en vivo de jugadores en Steam, ofertas de tiendas y directos de Twitch. Sin embargo, antes de iniciar o comprar un juego, los jugadores modernos necesitan responder a tres preguntas fundamentales:
1. **¿Cuánto dura pasarse el juego?** (*HowLongToBeat*): Horas estimadas para la campaña principal, misiones secundarias y el 100% completista.
2. **¿Funciona bien en mi consola portátil o en Linux?** (*ProtonDB & Steam Deck*): Sello oficial de compatibilidad para Steam Deck, ROG Ally y sistemas PC.
3. **¿Cuál es la marca máxima humana?** (*Speedrun.com*): El Récord Mundial vigente (World Record) con tiempo y video oficial de la carrera.

El objetivo de **SPEC-16** es construir la suite **Game Meta Intelligence** integrada en la ficha de cada juego (`/games/[slug]`), consumiendo APIs 100% gratuitas y públicas mediante un servicio centralizado y resiliente con caché de 24 horas.

---

## 2. Lista Exacta de Archivos a Crear / Modificar

| Acción | Archivo | Responsabilidad |
|---|---|---|
| **Crear** | `src/domain/game-meta.ts` | Modelos de dominio y tipos estrictos (`GameDuration`, `ProtonDbReport`, `SpeedrunRecord`, `GameMetaReport`), funciones puras de formateo de tiempo y normalización de tiers. |
| **Crear** | `src/services/game-meta-service.ts` | Servicio unificado de consulta con `Promise.allSettled`, integración con HowLongToBeat/IGDB, ProtonDB y Speedrun.com con caché `unstable_cache` de 24 horas. |
| **Crear** | `src/styles/game-meta-hub.css` | Hoja de estilos dedicada con estética táctica retro-ciberpunk, medallas de compatibilidad (Platinum/Gold) y tarjetas de duración. |
| **Crear** | `src/components/game-meta-hub.tsx` | Componente visual que renderiza el panel con los 3 bloques de datos meta y estados de carga/vacío elegantes. |
| **Modificar** | `src/app/games/[slug]/page.tsx` | Integrar `<GameMetaHub title={game.title} />` bajo un bloque `<Suspense>` junto a la telemetría del juego. |
| **Crear** | `tests/unit/game-meta.test.ts` | Pruebas unitarias de dominio y servicio: formateo de segundos a horas, resolución de tiers de ProtonDB, sanitización de URLs de video de Speedrun y resiliencia ante errores de red. |

---

## 3. Contratos de Tipos Estrictos (TypeScript)

### `src/domain/game-meta.ts`

```typescript
export interface GameDuration {
  mainStoryHours: number | null;
  mainExtraHours: number | null;
  completionistHours: number | null;
}

export const PROTON_TIERS = ['platinum', 'gold', 'silver', 'bronze', 'borked', 'pending'] as const;
export type ProtonDbTier = (typeof PROTON_TIERS)[number];

export interface ProtonDbReport {
  tier: ProtonDbTier;
  score: number;
  confidence: string;
  totalReports: number;
  steamDeckVerified: boolean;
  protonUrl: string;
}

export interface SpeedrunRecord {
  categoryName: string;
  timeFormatted: string;
  runnerName: string;
  videoUrl: string | null;
  dateIso: string | null;
  speedrunUrl: string;
}

export interface GameMetaReport {
  duration: GameDuration | null;
  proton: ProtonDbReport | null;
  speedrun: SpeedrunRecord | null;
}
```

---

## 4. Algoritmo y Flujo de Implementación

### 4.1. Servicio Unificado (`src/services/game-meta-service.ts`)

La función maestra `fetchGameMeta(title: string)` ejecuta en paralelo y de forma aislada las 3 consultas mediante `Promise.allSettled`:

```typescript
export const fetchGameMeta = unstable_cache(
  async (title: string): Promise<GameMetaReport> => {
    // 1. Obtener steamAppId para ProtonDB (reutilizando búsqueda oficial de Steam)
    // 2. Ejecutar concurrentemente:
    //    - HowLongToBeat (duración)
    //    - ProtonDB (compatibilidad)
    //    - Speedrun.com (récord mundial)
  },
  ['game-meta-v1'],
  { revalidate: 86400 } // 24 horas de caché
);
```

#### A. HowLongToBeat / Durómetro
- Consulta los datos de duración a través del campo `time_to_beat` de IGDB o el endpoint público de HowLongToBeat.
- Convierte los tiempos de segundos a horas decimales/enteras amigables:
  - `mainStoryHours`: Horas para superar el objetivo principal.
  - `mainExtraHours`: Campaña + misiones secundarias.
  - `completionistHours`: 100% de logros y coleccionables.

#### B. ProtonDB & Steam Deck API
1. Realiza una búsqueda rápida en Steam para obtener el `steamAppId`:
   `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(title)}&l=spanish&cc=US`
2. Si existe `appId`, consulta ProtonDB:
   `https://www.protondb.com/api/v1/reports/summaries/${appId}.json`
3. Valida el `tier` devuelto (`platinum`, `gold`, `silver`, `bronze`, `borked`). Si el tier es `platinum` o `gold`, marca `steamDeckVerified = true`.
4. URL de referencia: `https://www.protondb.com/app/${appId}`.

#### C. Speedrun.com REST API
1. Busca el juego en Speedrun.com:
   `https://www.speedrun.com/api/v1/games?name=${encodeURIComponent(title)}&max=1`
2. Obtiene las categorías del juego (`/api/v1/games/{gameId}/categories`). Prioriza `Any%` o la primera categoría de tipo `per-game`.
3. Consulta el líder de la tabla de posiciones:
   `https://www.speedrun.com/api/v1/leaderboards/{gameId}/category/{categoryId}?top=1&embed=players`
4. Extrae:
   - Tiempo en segundos -> Formatea a `H:MM:SS` (o `MM:SS`).
   - Nombre del jugador (`player.data.names.international` o `player.data.name`).
   - Enlace del video (`run.videos.links[0].uri`).
   - Enlace al leaderboard de Speedrun.com.

---

### 4.2. Diseño Visual e Interfaz (`src/components/game-meta-hub.tsx`)

El componente se estructura como un panel táctico con 3 columnas responsivas (`.game-meta-grid`):

```
┌────────────────────────────────────────────────────────────────────────┐
│ 🎮 GAME META INTELLIGENCE // DURACIÓN, COMPATIBILIDAD & RÉCORDS       │
├────────────────────┬────────────────────┬──────────────────────────────┤
│ ⏳ DURÓMETRO HLTB  │ 🎮 PROTON & DECK   │ ⏱️ WORLD RECORD SPEEDRUN     │
│                    │                    │                              │
│ • Historia: ~14 h  │ 💎 PLATINUM TIER   │ Categoría: Any%              │
│ • Extras:   ~28 h  │ Excelente en Deck  │ 🏆 1h 24m 12s                │
│ • 100%:     ~65 h  │ 60 FPS estables    │ por @GamerSpeedRunner        │
│                    │                    │                              │
│ [Ver en HLTB ↗]    │ [Reporte Proton ↗] │ [Ver carrera en video ↗]     │
└────────────────────┴────────────────────┴──────────────────────────────┘
```

1. **Bloque Durómetro:** Barras de color progresivas (verde para historia, azul para extras, púrpura para 100%).
2. **Bloque ProtonDB:** Medallón de nivel con resplandor (platino `#67e8f9`, oro `#f59e0b`, plata `#94a3b8`), insignia `🎮 Steam Deck Verified` y número de reportes comunitarios.
3. **Bloque Speedrun:** Trofeo dorado, tiempo récord con tipografía monoespaciada de gran visibilidad, nombre del corredor y botón con enlace al video de la carrera.

---

## 5. Criterios de Aceptación Deterministas y Casos Borde

1. **Aislamiento Total de Fallos (Zero Cascading Failures):**
   - El fallo de una de las tres APIs (por ejemplo, si Speedrun.com no tiene ese juego o ProtonDB da 404) **nunca debe cancelar las otras dos métricas ni romper la página de juego**. Cada bloque muestra sus datos de forma independiente o se oculta elegantemente si está ausente.
2. **Validación y Sanitización de URLs:**
   - Las URLs de video devueltas por Speedrun deben pertenecer estrictamente a hosts permitidos (`youtube.com`, `youtu.be`, `twitch.tv`). Enlaces sospechosos o con esquemas inválidos deben descartarse.
3. **Manejo de Tiempos y Formatos:**
   - La conversión de segundos a horas o minutos debe redondear valores decimales a un máximo de 1 decimal (ej: `14.5 h`).
   - Los tiempos menores a 1 hora deben formatearse como minutos (ej: `45 min`).
4. **Caché y Límites de Tasa:**
   - Todas las respuestas deben quedar retenidas en la caché del servidor durante 24 horas (`revalidate: 86400`) para minimizar el tráfico hacia servicios externos.
5. **Verificación de Calidad Obligatoria:**
   - `npm test` superado al 100% (458 pruebas existentes + nuevas pruebas en `tests/unit/game-meta.test.ts`).
   - `npm run typecheck` con 0 errores TypeScript.
   - `npm run lint` con 0 advertencias/errores ESLint.
   - `npm run format:check` 100% conforme con Prettier.
