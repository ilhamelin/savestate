# Especificación Técnica: Trackers Competitivos de Honkai: Star Rail (Enka HSR) y Rust (Steam Web API), y Retiro de la Pestaña Radar en `/rift`

## 1. Resumen de Cambios

1. **Retirar la pestaña `📡 Radar en Vivo (Steam · Ofertas · Twitch)` de `/rift` (`src/components/competitive-hub-tabs.tsx`)**:
   - Eliminar la pestaña `radar` y la importación de `GameLiveRadarSearch` en `src/components/competitive-hub-tabs.tsx` (y limpiar `src/components/game-live-radar-search.tsx` / `/api/tracker/radar` si ya no se usan), conservando intacto el componente `<GameLiveRadar title={game.title} />` dentro de la vista individual de cada juego (`src/app/games/[slug]/page.tsx`).
2. **Añadir el Tracker de Honkai: Star Rail (`✨ Honkai: Star Rail` vía Enka.Network HSR API)**:
   - Consulta en vivo por UID (`9` o `10` dígitos) a `https://enka.network/api/hsr/uid/{uid}` cruzado con el diccionario oficial en español/inglés de Enka HSR (`avatars.json`, `weapons.json` y `hsr.json`).
   - Muestra el perfil Trazacaminos (Nivel Trazacaminos `TL`, Nivel de Equilibrio `EQ`, Logros, Personajes obtenidos, Conos de Luz) y las tarjetas completas de personajes de apoyo/escaparate con retrato oficial, rareza (`5★`/`4★`), Vía (`Destrucción`, `Cacería`, `Nihilidad`, `Armonía`, etc.), Elemento (`Fuego`, `Hielo`, `Rayo`, `Viento`, `Cuántico`, `Imaginario`, `Físico`), Eidolón (`E0`–`E6`), Cono de Luz equipado (`S1`–`S5`) y estadísticas calculadas (`PV`, `ATQ`, `DEF`, `VEL`, `Prob. CRIT`, `Daño CRIT`).
3. **Añadir el Tracker de Rust (`☢️ Rust · Steam ID` vía Steam Web API - AppID `252490`)**:
   - Acepta un **SteamID64** (`7656119...`), una **URL de perfil de Steam** (`https://steamcommunity.com/id/...` o `/profiles/...`) o un **Vanity ID** de Steam reutilizando `steamProfile` y `STEAM_API_KEY`.
   - Consulta en paralelo el perfil del jugador (`GetPlayerSummaries`), horas jugadas en Rust (`GetOwnedGames`), logros (`GetPlayerAchievements`) y telemetría de combate/supervivencia (`ISteamUserStats/GetUserStatsForGame/v0002/?appid=252490`):
     - **Combate PvP**: Bajas de jugadores (`kill_player`), Muertes (`deaths`), Ratio K/D, Headshots (`headshot`), Disparos realizados (`bullet_fired`), Impactos a jugadores (`bullet_hit_player`), Precisión de tiro y Bajas con arco (`arrow_hit_player`).
     - **Supervivencia y PvE**: Científicos eliminados (`kill_scientist`), Animales cazados (`kill_bear + kill_boar + kill_wolf + kill_stag`), Veces herido/levantado (`wounded` / `wounded_healed`).
     - **Farmeo y Raideo**: Madera recolectada (`harvested_wood`), Piedra recolectada (`harvested_stones`), Mineral de metal (`acquired_metal.ore`), Mineral de azufre (`acquired_sulfur.ore`), Cohetes disparados (`rockets_fired`) y Planos estudiados (`blueprint_studied`).

---

## 2. Arquitectura Técnica

### 2.1. Honkai: Star Rail Store (`src/services/hsr-enka-store.ts`)

Crear `src/services/hsr-enka-store.ts` con `'server-only'` y `unstable_cache` (`revalidate: 86400`, clave `['hsr-enka-store-v1']`):
- Descargar en paralelo con `AbortSignal.timeout(6000)` y cabecera `'User-Agent': 'SaveState/1.0 (+https://savestate.app)'`:
  - `https://raw.githubusercontent.com/EnkaNetwork/API-docs/master/store/hsr/avatars.json`
  - `https://raw.githubusercontent.com/EnkaNetwork/API-docs/master/store/hsr/weapons.json`
  - `https://raw.githubusercontent.com/EnkaNetwork/API-docs/master/store/hsr/hsr.json`
- Exportar `getHsrEnkaStore()` devolviendo `{ avatars, weapons, locEs: loc.es ?? {}, locEn: loc.en ?? {} }`.

### 2.2. Modelos y Normalizadores en `src/domain/competitive-tracker.ts`

1. **`HsrProfile` (`game: 'hsr'`)**:
   - `uid: string`
   - `nickname: string`
   - `level: number` (Nivel Trazacaminos)
   - `worldLevel: number` (Nivel de Equilibrio)
   - `signature: string`
   - `platform: string`
   - `achievements: number`
   - `avatarCount: number`
   - `lightConeCount: number`
   - `showcase: HsrShowcaseCharacter[]` donde cada personaje incluye:
     - `avatarId: number`
     - `name: string`
     - `iconUrl: string | null` (`https://enka.network${meta.AvatarSideIconPath}`)
     - `rarity: 4 | 5`
     - `level: number`
     - `eidolons: number` (`avatar.rank ?? 0`)
     - `element: string` (`Fuego 🔥`, `Hielo ❄️`, `Rayo ⚡`, `Viento 🌪️`, `Cuántico 🌌`, `Imaginario ✨`, `Físico ⚔️`)
     - `elementCode: 'pyro' | 'cryo' | 'electro' | 'anemo' | 'geo' | 'neutral'`
     - `path: string` (`Destrucción`, `Cacería`, `Erudición`, `Armonía`, `Nihilidad`, `Conservación`, `Abundancia`, `Reminiscencia`)
     - `stats: { hp: number; atk: number; def: number; speed: number; critRate: number; critDmg: number }`
     - `lightCone: { name: string; iconUrl: string | null; level: number; superimposition: number; rarity: number } | null`
     - `relicsCount: number`

2. **`RustProfile` (`game: 'rust'`)**:
   - `steamId: string`
   - `personaName: string`
   - `avatarUrl: string | null`
   - `profileUrl: string | null`
   - `hoursPlayed: number | null`
   - `recentHours2Weeks: number | null`
   - `statsPublic: boolean`
   - `achievementsUnlocked: number | null`
   - `combat: { killsPvp: number; deaths: number; kdRatio: number; headshots: number; bulletsFired: number; bulletsHitPlayer: number; accuracyPercent: number; scientistsKilled: number; animalsKilled: number } | null`
   - `survival: { woodHarvested: number; stoneHarvested: number; metalOre: number; sulfurOre: number; rocketsFired: number; blueprintsStudied: number; woundedHealed: number } | null`

### 2.3. Pestañas en `src/components/competitive-hub-tabs.tsx`

La barra superior de `/rift` tendrá exactamente estas 5 pestañas de juegos competitivos/multijugador (sin la pestaña de Radar en Vivo):
1. `⚔️ League of Legends`
2. `🎯 Valorant (Riot ID)`
3. `✨ Genshin Impact`
4. `🚂 Honkai: Star Rail`
5. `☢️ Rust (Steam)`
