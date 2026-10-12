# Especificación Técnica: Rediseño Visual y Telemetría Avanzada de Rust al Estilo Cyber-HUD de SaveState

## 1. Resumen Ejecutivo

Este documento especifica la evolución técnica y visual del tracker de **Rust (`appid = 252490`)** en `/rift` para ofrecer toda la riqueza analítica de los trackers especializados de Rust, pero **adaptada al lenguaje visual Cyber-HUD / Terminal Neón de SaveState** (paneles oscuros con bordes `cyber-corner`, acentos naranja óxido `#ff5500` + cian `#00f0ff`, anillos de telemetría SVG segmentados y barras de proporción integradas).

---

## 2. Corrección de Fórmulas y Ampliación de Datos en `src/domain/rust-profile.ts`

### 2.1. Corrección de Bajas PvP (`playerKills`) vs Bajas Totales (`totalKills`)

En el esquema oficial de estadísticas de Facepunch en Steam (`ISteamUserStats/GetUserStatsForGame/v0002/?appid=252490`):
- La variable `kill_player` registra el **total acumulado de bajas de entidades (`totalKills`)**, incluyendo científicos y fauna.
- Por lo tanto:
  - `scientistsKilled = get('kill_scientist')`
  - `bearsKilled = get('kill_bear')`
  - `boarsKilled = get('kill_boar')`
  - `deerKilled = get('kill_stag')`
  - `wolvesKilled = get('kill_wolf')`
  - `chickensKilled = get('kill_chicken')`
  - `horsesKilled = get('kill_horse')`
  - `dwellersKilled = get('kill_tunneldweller')`
  - `pveKills = scientistsKilled + bearsKilled + boarsKilled + deerKilled + wolvesKilled + chickensKilled + horsesKilled + dwellersKilled`
  - `rawKillPlayer = get('kill_player')`
  - **`killsPvp = rawKillPlayer > pveKills ? rawKillPlayer - pveKills : rawKillPlayer`** (para el perfil `76561198395738643`, `5444 - 4988 = 456` bajas reales de jugadores).
  - **`totalKills = killsPvp + pveKills`** (`5,444`).
  - **`headshotRatePercent = bulletsHitPlayer > 0 ? Math.min(100, Number(((headshots / bulletsHitPlayer) * 100).toFixed(2))) : 0`** (ej. `9355 / 25475 = 36.72%`).
  - **`accuracyPercent = bulletsFired > 0 ? Math.min(100, Number(((bulletsHitPlayer / bulletsFired) * 100).toFixed(2))) : 0`** (ej. `25475 / 123447 = 20.64%`).

### 2.2. Desgloses Proporcionales para los 3 Anillos de Telemetría (`breakdowns`)

Crear un tipo reutilizable `RustBreakdownItem = { id: string; label: string; icon: string; count: number; percent: number; color: string }` y calcular tres desgloses en `RustProfile`:

1. **`bulletHitsBreakdown` (`totalBulletHits`)**:
   - `Jugadores` (`bullet_hit_player`, color `#ff5500`)
   - `Estructuras` (`bullet_hit_building`, color `#00f0ff`)
   - `Jugadores abatidos` (`get('bullet_hit_playercorpse') + get('bullet_hit_corpse')`, color `#f59e0b`)
   - `Osos` (`bullet_hit_bear`, color `#a855f7`)
   - `Jabalíes` (`bullet_hit_boar`, color `#22c55e`)
   - `Lobos` (`bullet_hit_wolf`, color `#38bdf8`)
   - `Ciervos` (`bullet_hit_stag`, color `#ec4899`)
   - `Caballos` (`bullet_hit_horse`, color `#eab308`)
   - `Señales` (`bullet_hit_sign`, color `#64748b`)
   - `Otros` (`bullet_hit_entity`, color `#94a3b8`)

2. **`killsBreakdown` (`totalKills`)**:
   - `Jugadores (PvP)` (`killsPvp`, color `#ff5500`)
   - `Científicos` (`kill_scientist`, color `#00f0ff`)
   - `Jabalíes` (`kill_boar`, color `#22c55e`)
   - `Osos` (`kill_bear`, color `#a855f7`)
   - `Ciervos` (`kill_stag`, color `#f59e0b`)
   - `Lobos` (`kill_wolf`, color `#38bdf8`)
   - `Pollos` (`kill_chicken`, color `#ec4899`)
   - `Moradores` (`kill_tunneldweller`, color `#eab308`)
   - `Caballos` (`kill_horse`, color `#64748b`)

3. **`resourcesBreakdown` (`totalResources`)**:
   - `Mineral de Metal` (`acquired_metal.ore`, color `#00f0ff`)
   - `Chatarra (Scrap)` (`acquired_scrap`, color `#f59e0b`)
   - `Combustible Bajo Grado` (`acquired_lowgradefuel`, color `#ff5500`)
   - `Madera` (`harvested_wood`, color `#22c55e`)
   - `Piedra` (`harvested_stones`, color `#94a3b8`)
   - `Mineral de Azufre` (`acquired_sulfur.ore`, color `#eab308`)
   - `Tela` (`harvested_cloth`, color `#a855f7`)
   - `Cuero` (`harvested_leather`, color `#ec4899`)

### 2.3. Los 4 Módulos Tácticos Inferiores (`modules`)

Añadir en `RustProfile`:
- **`building`**:
  - `blocksPlaced`: `Math.round(get('placed_blocks'))`
  - `blocksUpgraded`: `Math.round(get('upgraded_blocks'))`
  - `blueprintsStudied`: `Math.round(get('blueprint_studied'))`
- **`horse`**:
  - `kilometersRidden`: `Math.round(get('horse_distance_ridden_km') || get('horse_distance_ridden') / 1000)`
  - `milesRidden`: `Number(((get('horse_distance_ridden_km') || get('horse_distance_ridden') / 1000) * 0.621371).toFixed(2))`
  - `woundedHealed`: `Math.round(get('wounded_healed'))`
- **`melee`**:
  - `strikes`: `Math.round(get('melee_strikes'))`
  - `throws`: `Math.round(get('melee_throws'))`
  - `rocketsFired`: `Math.round(get('rockets_fired'))`
- **`consumption`**:
  - `calories`: `Math.round(get('calories_consumed'))`
  - `water`: `Math.round(get('water_consumed'))`
  - `woundedTimes`: `Math.round(get('wounded'))`

---

## 3. Diseño Visual Adaptado al Estilo SaveState (`src/components/rust-profile-view.tsx`)

### 3.1. Fila Superior: Panel de Tiempo de Operación + Panel de Telemetría PvP (Grid 1:2)

1. **Panel Izquierdo (`rust-playtime-card`)**:
   - Eyebrow `⏱️ TIEMPO DE OPERACIÓN // STEAM TELEMETRY`.
   - Valor gigante: `{hoursPlayed} HORAS` + badge de horas en las últimas 2 semanas y logros desbloqueados (`🏆 {achievementsUnlocked}`).
   - Barra de proporción táctica SaveState que compara visualmente la proporción de **Bajas PvP vs Bajas PvE** o **Impactos a Jugadores vs Entorno** con etiquetas claras.
2. **Panel Derecho (`rust-pvp-card`)**:
   - Eyebrow `⚔️ TELEMETRÍA PVP // COMBAT MATRIX`.
   - Cuadrícula de 2 filas × 4 columnas:
     - **Fila 1**: `K/D Ratio`, `Bajas de Jugadores (PvP)`, `Muertes`, `Headshots`.
     - **Fila 2**: `Balas Disparadas`, `Impactos a Jugadores`, `Precisión` (`{accuracyPercent}%` acompañado de un mini gráfico circular SVG `<circle>`), `Tasa de Headshot` (`{headshotRatePercent}%` acompañado de un mini gráfico circular SVG `<circle>`).

### 3.2. Fila Central: 3 Columnas de Desglose con Anillos de Radar SVG (`rust-breakdown-grid`)

Tres paneles verticales lado a lado con estética Cyber-HUD:
1. **`🎯 IMPACTOS DE BALA`** (con anillo SVG multicolor mostrando `Total {totalBulletHits}` en el centro y lista inferior con icono, nombre, barra proporcional sutil, valor y `%`).
2. **`💀 DESGLOSE DE BAJAS`** (con anillo SVG multicolor mostrando `Total {totalKills}` en el centro y lista inferior con `Jugadores (PvP)`, `Científicos`, `Jabalíes`, `Osos`, `Ciervos`, `Lobos`, `Pollos`, etc.).
3. **`🌲 RECURSOS RECOLECTADOS`** (con anillo SVG multicolor mostrando `Total {compactFormat(totalResources)}` en el centro y lista inferior con `Mineral de Metal`, `Chatarra`, `Combustible`, `Madera`, `Piedra`, `Azufre`, `Tela`, `Cuero`).

### 3.3. Fila Inferior: 4 Módulos Tácticos (Grid 2×2 `rust-tactical-modules`)

Cuatro paneles compactos con cabecera HUD:
1. **`🏗️ CONSTRUCCIÓN Y BASE`**: `Bloques colocados`, `Bloques mejorados`, `Planos estudiados`.
2. **`🐎 MOVILIDAD Y RESCATE`**: `Kilómetros en caballo`, `Millas recorridas`, `Veces levantado`.
3. **`🪓 CUERPO A CUERPO Y ASEDIO`**: `Golpes melee`, `Armas arrojadizas`, `Cohetes disparados`.
4. **`🍖 SUPERVIVENCIA Y CONSUMO`**: `Calorías consumidas`, `Agua consumida`, `Veces abatido`.
