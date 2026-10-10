# Especificación Técnica: Tracker e Historial de League of Legends en Savestate ("Rift Tracker")

**Versión:** 1.0  
**Fecha:** 10 de octubre de 2026  
**Área:** Perfil de Jugador, Integración Riot Games API y UI de Partidas  
**Destino:** Implementación en Savestate (`savestate 2` / Codex)  

---

## 1. Visión General

El **Rift Tracker** permite a los usuarios de Savestate vincular su Riot ID (`Nombre#TAG`) y servidor para visualizar en su perfil:
1. **Ficha de Invocador y Rango:** Nivel de cuenta, emblema de liga Solo/Dúo (Hierro a Retador), LP, victorias, derrotas y porcentaje de winrate.
2. **Historial de Partidas Recientes:** Lista interactiva de las últimas 10 partidas con resultado (Victoria 🟢 / Derrota 🔴).
3. **Detalles por Partida:** Campeón jugado, KDA, CS (minions y CS/min), build de 6 objetos + centinela, hechizos de invocador y desglose desplegable del 5v5 con los 10 jugadores.

---

## 2. Variables de Entorno Requeridas

En `.env.local` y Vercel:
```env
RIOT_API_KEY=RGAPI-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```
*(Obtenida de forma gratuita en [developer.riotgames.com](https://developer.riotgames.com)).*

---

## 3. Modelo de Dominio (`src/domain/lol-tracker.ts`)

### 3.1. Ruteo Regional y Plataformas
```typescript
export type LolPlatform = 'la1' | 'la2' | 'na1' | 'br1' | 'euw1' | 'eun1' | 'kr' | 'jp1';
export type LolCluster = 'americas' | 'europe' | 'asia';

export const LOL_PLATFORMS: Record<LolPlatform, { name: string; cluster: LolCluster }> = {
  la2: { name: 'LAS (Latinoamérica Sur)', cluster: 'americas' },
  la1: { name: 'LAN (Latinoamérica Norte)', cluster: 'americas' },
  na1: { name: 'Norteamérica (NA)', cluster: 'americas' },
  br1: { name: 'Brasil (BR)', cluster: 'americas' },
  euw1: { name: 'Europa Oeste (EUW)', cluster: 'europe' },
  eun1: { name: 'Europa Nórdica y Este (EUNE)', cluster: 'europe' },
  kr: { name: 'Corea (KR)', cluster: 'asia' },
  jp1: { name: 'Japón (JP)', cluster: 'asia' },
};
```

### 3.2. Estructuras de Datos
```typescript
export interface LolRankEntry {
  tier: string; // IRON, BRONZE, SILVER, GOLD, PLATINUM, EMERALD, DIAMOND, MASTER, GRANDMASTER, CHALLENGER
  rank: string; // I, II, III, IV
  leaguePoints: number;
  wins: number;
  losses: number;
  winrate: number;
}

export interface LolMatchParticipant {
  puuid: string;
  riotId: string;
  championName: string;
  championIcon: string;
  kills: number;
  deaths: number;
  assists: number;
  kda: string;
  cs: number;
  csPerMin: string;
  items: string[]; // URLs de imágenes de los objetos
  spells: string[]; // URLs de los hechizos
  totalDamage: number;
  gold: number;
  win: boolean;
  role: string;
}

export interface LolMatchSummary {
  matchId: string;
  gameMode: string;
  gameDurationMinutes: number;
  gameEndTimestamp: number;
  player: LolMatchParticipant;
  team100: LolMatchParticipant[];
  team200: LolMatchParticipant[];
}

export interface LolProfileData {
  gameName: string;
  tagLine: string;
  summonerLevel: number;
  profileIconUrl: string;
  platform: LolPlatform;
  soloQueue: LolRankEntry | null;
  flexQueue: LolRankEntry | null;
  matches: LolMatchSummary[];
  lastUpdated: string;
}
```

---

## 4. Servicio de Integración (`src/integrations/riot/server.ts`)

Maneja las consultas a Riot Games y Data Dragon:
1. `resolveRiotAccount(gameName, tagLine, cluster)`:
   `GET https://{cluster}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/{gameName}/{tagLine}`
2. `fetchSummonerByPuuid(puuid, platform)`:
   `GET https://{platform}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/{puuid}`
3. `fetchRankedEntries(puuid, platform)`:
   `GET https://{platform}.api.riotgames.com/lol/league/v4/entries/by-puuid/{puuid}`
4. `fetchRecentMatchIds(puuid, cluster, count = 10)`:
   `GET https://{cluster}.api.riotgames.com/lol/match/v5/matches/by-puuid/{puuid}/ids?start=0&count=10`
5. `fetchMatchDetails(matchId, cluster)`:
   `GET https://{cluster}.api.riotgames.com/lol/match/v5/matches/{matchId}`
6. **Data Dragon CDN Assets:**
   Usa la versión actual de parches (ej. `14.20.1`) para generar las URLs de campeones (`/img/champion/{name}.png`), objetos (`/img/item/{id}.png`) y hechizos.

---

## 5. API Route en Next.js (`src/app/api/tracker/lol/route.ts`)

* **`POST /api/tracker/lol/inspect`**:
  * Recibe `{ riotId: "Nombre#TAG", platform: "la2" }`.
  * Valida formato (`Nombre#TAG`).
  * Ejecuta la resolución de Riot API en paralelo.
  * Formatea y devuelve el objeto `LolProfileData`.

---

## 6. Componente de UI (`src/components/profile-lol-tracker.tsx`)

Ubicado en el perfil del jugador:
* **Barra de Entrada Retro:**
  * Campo de texto para Riot ID (`Ej. Faker#KR1` o `Invocador#LAS`).
  * Selector desplegable de servidor (LAS, LAN, NA, EUW, etc.).
  * Botón: `[ Cargar Historial ]`.
* **Tarjeta de Resumen de Invocador:**
  * Icono de perfil oficial con nivel en esquina.
  * Riot ID con badge de servidor.
  * Rango Solo/Dúo con emblema de división, LP y barra de Winrate.
* **Lista de Partidas Recientes:**
  * Tarjeta para cada partida:
    * Borde lateral: Verde neón para **Victoria**, Rojo neón para **Derrota**.
    * Miniatura del campeón con nivel de partida.
    * Estadísticas: KDA (`12/2/8`), ratio coloreado (`6.0 KDA`), CS y daño.
    * Grilla de 6 objetos + centinela con iconos oficiales de Data Dragon.
    * Botón desplegable: `[ ▾ Ver detalles de la partida ]` para ver los 10 jugadores (5v5).
