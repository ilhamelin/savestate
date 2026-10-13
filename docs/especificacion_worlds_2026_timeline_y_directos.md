# Especificación Técnica: Hub de Worlds 2026 — Línea de Tiempo Interactiva, Directos y Detalle de Partidas (`/worlds`)

## 1. Objetivo y Alcance
Crear la vista dedicada **`/worlds`** accesible desde el **`navbar` principal** (`🏆 Worlds`) y enlazada desde `/rift`, siguiendo fielmente la arquitectura de 3 bloques definida por el usuario:
1. **Bloque Superior — Línea de Tiempo Interactiva de los Worlds (`Línea de tiempo de los Worlds`)**:
   - Muestra los **5 hitos oficiales de Worlds 2026** (`Play-ins`, `Swiss / Fase Suiza`, `Cuartos de final`, `Semifinales`, `Final`) y debajo los nodos interactivos de cada fecha y enfrentamiento.
   - **Regla estricta sobre equipos pendientes (`TBD`)**:
     - Cuando la tabla oficial ya tiene equipos confirmados para esa fecha (ej. el 15 de octubre en `Play-ins`: **Cloud9 Kia (`C9`) vs Karmine Corp (`KC`)** y **FURIA (`FUR`) vs MVK Esports (`MVK`)**), se muestran los nombres, códigos, escudos oficiales y marcador de los equipos.
     - Cuando aún no hay tabla oficial definida para esa fecha (`code === 'TBD'` o `name === 'TBD'`), **NO se muestran textos `"TBD"` ni equipos vacíos**; el nodo muestra únicamente la fecha, hora, formato (`Bo1` / `Bo3` / `Bo5`) y la indicación *"Equipos por definir"*.
2. **Bloque Central — Reproductor del Directo / VOD de la Partida (`Directo de la partida correspondiente`)**:
   - Muestra el reproductor `16:9` sincronizado con la partida seleccionada en la línea de tiempo:
     - Selector de señal oficial en directo:
       - `🇪🇸 Español (LVPes · Twitch)` (`channel=lvpes`)
       - `🇲🇽 Español Latam (LLA · Twitch)` (`channel=lla`)
       - `🇺🇸 Inglés Oficial (Riot Games · Twitch)` (`channel=riotgames`)
       - Si la partida ya se jugó y `getEventDetails` incluye `vods` oficiales en YouTube, habilita la pestaña `🎬 Ver Repetición Oficial (VOD)` por cada mapa jugado (`Juego 1`, `Juego 2`, etc.).
     - Incluye una barra de estado sobre el reproductor con cuenta regresiva en vivo hacia la hora de inicio (`startTime`) si la partida seleccionada aún no comienza, o badge `🔴 EN VIVO` si está en curso.
3. **Bloque Inferior — Descripción de la Partida en el Momento (`Descripción de la partida que ocurre en el momento`)**:
   - Tarjeta informativa sincronizada con el nodo activo de la línea de tiempo que detalla:
     - Hito/Fase actual, formato de la serie (`Mejor de 5 · Bo5`, `Mejor de 3 · Bo3`, `Mejor de 1 · Bo1`), fecha y hora local.
     - Si los equipos están confirmados: enfrentamiento cara a cara con sus logos oficiales, marcador de la serie y desglose de mapas (`Juego 1` a `Juego 5`), indicando qué equipo juega en el **Lado Azul** y cuál en el **Lado Rojo** (obtenido de `getEventDetails`).
     - Si aún no hay equipos confirmados: explicación contextual de qué se disputa en esa jornada del Mundial (reglas de clasificación/eliminación de esa fase) sin mostrar placeholders `TBD`.

---

## 2. Fuente de Datos Oficial (`esports-api.lolesports.com`)

### 2.1. Endpoints de la API Pública de LoL Esports
El cliente oficial de `lolesports.com` consume `https://esports-api.lolesports.com/persisted/gw` usando el header `x-api-key` (`process.env.LOLESPORTS_API_KEY ?? '0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z'`):

1. **Calendario de Worlds 2026 (`getSchedule`)**:
   - `GET https://esports-api.lolesports.com/persisted/gw/getSchedule?hl=es-ES&leagueId=98767975604431411`
   - Si `data.schedule.pages?.newer` está presente, realizar una segunda petición con `&pageToken={data.schedule.pages.newer}` para reunir los **46 eventos completos de Worlds 2026** (desde `Play-ins` el `2026-10-15` hasta la `Final` el `2026-11-14`).
   - Filtrar los eventos con `startTime` en `2026` (`startTime.startsWith('2026-')`).
2. **Partidas en Vivo (`getLive`)**:
   - `GET https://esports-api.lolesports.com/persisted/gw/getLive?hl=es-ES`
   - Permite detectar si algún evento de `league.slug === 'worlds'` o `league.id === '98767975604431411'` está actualmente `inProgress`.
3. **Detalle de Serie, Lados Azul/Rojo y VODs (`getEventDetails`)**:
   - `GET https://esports-api.lolesports.com/persisted/gw/getEventDetails?hl=es-ES&id={matchId}`
   - Devuelve:
     - `data.event.match.teams`: equipos con `id`, `name`, `code`, `image` (normalizando `http://static.lolesports.com/...` a `https://static.lolesports.com/...`) y `result.gameWins`.
     - `data.event.match.games`: lista de mapas (`number`, `id`, `state`, `teams: [{ id, side: 'blue' | 'red' }]`, `vods: [{ provider, parameter, locale }]`).
     - `data.event.streams`: streams activos en vivo si la partida está en curso.

---

## 3. Modelo de Dominio (`src/domain/worlds-schedule.ts`)

```ts
export type WorldsStageSlug = 'play-ins' | 'swiss' | 'quarterfinals' | 'semifinals' | 'final';

export interface WorldsTeam {
  id?: string;
  name: string;
  code: string;
  imageUrl: string | null;
  gameWins: number | null;
}

export interface WorldsMatchEvent {
  id: string;
  startTime: string;
  state: 'unstarted' | 'inProgress' | 'completed';
  blockName: string;
  stageSlug: WorldsStageSlug;
  stageLabel: string;
  bestOf: number;
  hasConfirmedTeams: boolean;
  teams: [WorldsTeam, WorldsTeam] | null;
}

export interface WorldsStageGroup {
  slug: WorldsStageSlug;
  label: string;
  dateRangeLabel: string;
  firstStartTime: string;
  lastStartTime: string;
  state: 'unstarted' | 'inProgress' | 'completed';
  matches: WorldsMatchEvent[];
}
```

### Reglas de Normalización en `src/domain/worlds-schedule.ts`:
1. **`isPlaceholderTeam(team)`**:
   - Devuelve `true` si `!team.name || !team.code || /^tbd$/i.test(team.name.trim()) || /^tbd$/i.test(team.code.trim()) || /por definir/i.test(team.name)`.
   - Si cualquiera de los 2 equipos de un evento es placeholder, `hasConfirmedTeams = false` y `teams = null` para que la interfaz **nunca pinte `"TBD"`** cuando no hay tabla oficial aún.
2. **Normalización de Imágenes (`worldsImageUrl`)**:
   - Convierte `http://static.lolesports.com/...` a `https://static.lolesports.com/...` y descarta `team-tbd.png`.
3. **Agrupación por Hitos (`groupWorldsEventsByStage`)**:
   - Mapea `blockName` a los 5 hitos canónicos de la línea de tiempo:
     - `/play-?in/i` → `slug: 'play-ins'`, `label: 'Play-In'`
     - `/swiss|suiza/i` → `slug: 'swiss'`, `label: 'Fase Suiza'`
     - `/cuartos|quarter/i` → `slug: 'quarterfinals'`, `label: 'Cuartos de Final'`
     - `/semifinal/i` → `slug: 'semifinals'`, `label: 'Semifinales'`
     - `/^final|gran final|finals/i` → `slug: 'final'`, `label: 'Gran Final'`
4. **Selección Inteligente de la Partida Inicial (`pickDefaultWorldsMatch`)**:
   - Si hay una partida `inProgress`, selecciona esa partida automáticamente.
   - Si no hay ninguna en curso, selecciona la próxima partida `unstarted` más cercana a la fecha actual (`nowMs`), o la última jugada si el torneo ya terminó.
5. **Descripción Contextual Automática (`describeWorldsMatch`)**:
   - Genera la descripción rica para el bloque verde inferior:
     - Explica la relevancia del enfrentamiento en la fase actual (`Play-In`, `Fase Suiza`, `Cuartos de Final`, `Semifinales`, `Gran Final`), el formato (`Mejor de ${bestOf}`), el estado de la serie y, si los equipos ya están definidos, el enfrentamiento directo (`Cloud9 Kia vs Karmine Corp`, `FURIA vs MVK Esports`, etc.) y la asignación de lados (`Lado Azul` vs `Lado Rojo`) por mapa.

---

## 4. Rutas API en Next.js
1. **`GET /api/worlds`**:
   - Obtiene y combina las páginas de `getSchedule` para Worlds (`leagueId=98767975604431411`) + `getLive`, con caché en memoria de 5 minutos (`300_000 ms`).
   - Devuelve `{ stages: WorldsStageGroup[], defaultMatchId: string | null, liveMatchId: string | null, fetchedAt: string }`.
2. **`GET /api/worlds/[matchId]`**:
   - Consulta `getEventDetails?hl=es-ES&id={matchId}` con caché de 2 minutos para devolver los juegos individuales (`games` con lado azul/rojo de cada equipo y `vods` disponibles) y streams activos.

---

## 5. Diseño de la Vista `/worlds` (`src/app/worlds/page.tsx` y `src/components/worlds-hub.tsx`)
1. **Navegación (`src/components/header-nav.tsx`)**:
   - Añade `{ href: '/worlds', label: 'Worlds', icon: Trophy }` en la barra de navegación principal (`.site-header`).
2. **Sección 1 — Línea de Tiempo Interactiva (`Línea de tiempo de los Worlds`)**:
   - **Carril de Hitos (5 Fases)**: Barra horizontal conectada con línea de progreso mostrando `1. Play-In (15–18 Oct)`, `2. Fase Suiza (23–31 Oct)`, `3. Cuartos de Final (3–6 Nov)`, `4. Semifinales (7–8 Nov)` y `5. Gran Final (14 Nov)`.
   - **Carril de Partidas de la Fase Activa**: Nodos horizontales deslizables para cada serie de la fase seleccionada:
     - Muestra fecha y hora local (`es-CL`), formato (`Bo5`, `Bo3`, `Bo1`) y estado (`EN VIVO`, `PRÓXIMO`, `FINALIZADO`).
     - Si `hasConfirmedTeams === true`: muestra los escudos y códigos de ambos equipos (`C9 vs KC`, `FUR vs MVK`) y el resultado si existe.
     - Si `hasConfirmedTeams === false`: **no muestra equipos ni "TBD"**, sino una etiqueta limpia `"Cruces por definir"`.
3. **Sección 2 — Reproductor en Directo / VOD (`Directo de la partida correspondiente`)**:
   - Cabecera del reproductor con:
     - Indicador de la partida seleccionada en la línea de tiempo + cuenta regresiva en tiempo real si aún no comienza.
     - Botones para elegir canal de transmisión en directo (`🇪🇸 LVPes (Twitch)`, `🇲🇽 LLA (Twitch)`, `🇺🇸 Riot Games (Twitch)`) o `🎬 VOD Oficial` cuando la partida tenga repetición en `getEventDetails`.
   - Reproductor `<iframe>` `16:9` (`https://player.twitch.tv/?channel={channel}&parent=${window.location.hostname}&autoplay=false` o `https://www.youtube-nocookie.com/embed/{vodId}`) más enlaces directos a `lolesports.com/live`, Twitch y YouTube.
4. **Sección 3 — Descripción de la Partida (`Descripción de la partida que ocurre en el momento`)**:
   - Panel detallado inferior sincronizado con la partida seleccionada en la línea de tiempo:
     - Muestra el título de la serie, fase, horario local, formato (`Bo5` / `Bo3`), descripción narrativa de lo que está en juego en esa llave y:
       - Si hay equipos confirmados: tarjetas comparativas de ambos equipos con sus logos oficiales, victorias en la serie y tabla de los mapas (`Juego 1` a `Juego N`) indicando qué equipo juega en el **Lado Azul** y cuál en el **Lado Rojo**.
       - Si aún no hay tabla oficial para esa fecha: explicación de cómo se clasifican los equipos hacia esa llave.
