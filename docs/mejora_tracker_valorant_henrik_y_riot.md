# Especificación Técnica: Perfil Completo de Jugador en Valorant (HenrikDev API + Riot Cross-Profile & Act Leaderboard)

## 1. Por qué ocurría el mensaje de solo verificación en Valorant

En el ecosistema de Riot Games:
- Una clave estándar del portal de desarrolladores (`RIOT_API_KEY` / `RGAPI-...`) tiene acceso completo a **League of Legends** y **Teamfight Tactics (TFT)**, pero en **Valorant** Riot restringe los endpoints de historial individual (`/val/match/v1/matchlists/by-puuid`) exclusivamente a claves comerciales con RSO de producción.
- Con `RIOT_API_KEY` estándar, Riot solo permite consultar:
  1. `riot/account/v1/accounts/by-riot-id/{gameName}/{tagLine}` (PUUID y Riot ID).
  2. `riot/account/v1/active-shards/by-game/val/by-puuid/{puuid}` (Shard activo: `latam`, `br`, `na`, `eu`, `ap`, `kr`).
  3. `val/content/v1/contents` y `val/ranked/v1/leaderboards/by-act/{actId}` (Acto competitivo activo y tabla de clasificación oficial Radiante/Inmortal).

Para obtener el **Perfil Completo de cualquier jugador de Valorant** (Nivel de cuenta, Tarjeta/Banner de jugador, Rango actual con ícono, RR, ELO, Pico histórico de rango y últimas partidas con Agente, Mapa, KDA y % de Headshots), el estándar de la comunidad es **HenrikDev Valorant API (`https://api.henrikdev.xyz`)**, combinada con los datos de cuenta Riot (`RIOT_API_KEY`) y assets oficiales de `https://valorant-api.com`.

---

## 2. Arquitectura Dual para el Tracker de Valorant (`src/services/competitive-tracker.ts`)

### 2.1. Modo Completo con `HENRIK_API_KEY` (o `VALORANT_API_KEY`)

Cuando `process.env.HENRIK_API_KEY` esté configurada en el entorno (cabecera `Authorization: process.env.HENRIK_API_KEY`):
1. **Cuenta y Tarjeta de Jugador**:
   - `GET https://api.henrikdev.xyz/valorant/v1/account/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`
   - Extrae: `accountLevel` (`data.account_level`), `cardSmall` (`data.card.small`), `cardWide` (`data.card.wide`), `lastUpdate` (`data.last_update`).
2. **Rango Competitivo, RR, ELO y Pico Histórico**:
   - `GET https://api.henrikdev.xyz/valorant/v2/mmr/${region}/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`
   - Extrae de `data.current_data`:
     - `currentRank`: `currenttierpatched` (ej. `Gold 3`, `Platinum 2`, `Immortal 1`)
     - `rankIconUrl`: `images.large` o `images.small`
     - `rankingInTier`: `ranking_in_tier` (`0`–`100` RR)
     - `lastMmrChange`: `mmr_change_to_last_game` (ej. `+18` / `-14`)
     - `elo`: `elo`
   - Extrae de `data.highest_rank`:
     - `peakRank`: `patched_tier` (ej. `Ascendant 2`)
     - `peakSeason`: `season`
3. **Historial de Últimas 5 Partidas (`matches`)**:
   - `GET https://api.henrikdev.xyz/valorant/v3/matches/${region}/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}?size=5`
   - Para cada partida, busca al jugador en `players.all_players` por `puuid` o `name + tag` y extrae:
     - `matchId`: `metadata.matchid`
     - `map`: `metadata.map`
     - `mode`: `metadata.mode`
     - `startedAt`: `metadata.game_start_patched`
     - `agentName`: `player.character`
     - `agentIconUrl`: `player.assets.agent.small`
     - `kills`: `player.stats.kills`
     - `deaths`: `player.stats.deaths`
     - `assists`: `player.stats.assists`
     - `score`: `player.stats.score`
     - `headshotPercent`: `Math.round((hs / Math.max(1, hs + bs + ls)) * 100)`
     - `won`: booleano comparando el `player.team` (`Red` / `Blue`) con `teams.red.has_won` / `teams.blue.has_won`
     - `roundsWon` / `roundsLost`: `teams[team].rounds_won` / `teams[team].rounds_lost`.

### 2.2. Enriquecimiento Automático con `RIOT_API_KEY` + `valorant-api.com` (Incluso sin `HENRIK_API_KEY`)

Cuando solo `RIOT_API_KEY` esté configurada (sin `HENRIK_API_KEY`), en vez de mostrar solo un texto plano de verificación:
1. **Cross-Profile de Cuenta Riot (`summoner/v4` + DataDragon)**:
   - Consulta con el mismo `puuid` en el servidor regional de Riot (`la2` para `latam`, `br1` para `br`, `na1` para `na`, `euw1` para `eu`, `kr` para `kr`, `jp1` para `ap`) el perfil de cuenta Riot (`/lol/summoner/v4/summoners/by-puuid/${puuid}` y `/tft/league/v1/by-puuid/${puuid}`) para obtener el **Icono de Cuenta Riot**, **Nivel de Cuenta Riot** y **Rango competitivo en el ecosistema Riot (TFT/LoL)** asociados a ese mismo Riot ID.
2. **Estado Competitivo Oficial del Shard de Valorant (`/val/content/v1/contents` + `/val/ranked/v1/leaderboards/by-act/{actId}`)**:
   - Consulta en `https://${activeShard}.api.riotgames.com/val/content/v1/contents?locale=es-MX` el **Acto Competitivo Activo** (`acts.find(a => a.isActive && a.type === 'act')`).
   - Consulta `https://${activeShard}.api.riotgames.com/val/ranked/v1/leaderboards/by-act/${actId}?size=10&startIndex=0` para verificar si el `puuid` figura en el leaderboard Inmortal/Radiante y mostrar el **Top 5 Radiante en Vivo de la Región (`LATAM` / `BR` / `NA`)** junto con la tarjeta de identidad verificada del jugador.
3. **Banner e Iconografía Oficial de `valorant-api.com`**:
   - Obtiene el arte oficial de tarjeta/rango desde `https://valorant-api.com` para presentar un dashboard visualmente rico estilo HUD de Valorant.
