export type WorldsStageSlug = 'play-ins' | 'swiss' | 'quarterfinals' | 'semifinals' | 'final';
import rosterSnapshot from './worlds-2026-rosters.json' with { type: 'json' };
export type WorldsState = 'unstarted' | 'inProgress' | 'completed';
export type WorldsRole = 'top' | 'jungle' | 'mid' | 'bottom' | 'support';
export interface WorldsPlayerProfile {
  id: string;
  summonerName: string;
  firstName: string;
  lastName: string;
  role: WorldsRole;
  imageUrl: string | null;
}
export interface WorldsTeamRoster {
  teamId: string;
  code: string;
  name: string;
  homeLeague: string | null;
  players: WorldsPlayerProfile[];
}
export interface WorldsGameTeamStats {
  totalGold: number;
  totalKills: number;
  towers: number;
  barons: number;
  inhibitors: number;
  dragons: string[];
}
export interface WorldsGamePlayerStats {
  participantId: number;
  summonerName: string;
  championId: string;
  championIconUrl: string;
  role: WorldsRole;
  level: number;
  kills: number;
  deaths: number;
  assists: number;
  kdaRatio: number;
  killParticipationPct: number;
  creepScore: number;
  totalGold: number;
  goldSharePct: number;
  isMvp: boolean;
}
export interface WorldsGameTelemetry {
  gameId: string;
  gameNumber: number;
  gameState: 'unstarted' | 'in_game' | 'finished';
  patchVersion: string | null;
  durationSeconds: number | null;
  blueTeam: WorldsGameTeamStats;
  redTeam: WorldsGameTeamStats;
  bluePlayers: WorldsGamePlayerStats[];
  redPlayers: WorldsGamePlayerStats[];
}
export const WORLDS_ROLES: { role: WorldsRole; code: string; label: string }[] = [
  { role: 'top', code: 'TOP', label: 'Carril Superior' },
  { role: 'jungle', code: 'JNG', label: 'Jungla' },
  { role: 'mid', code: 'MID', label: 'Carril Central' },
  { role: 'bottom', code: 'BOT', label: 'Tirador' },
  { role: 'support', code: 'SUP', label: 'Soporte' },
];
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
  state: WorldsState;
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
  state: WorldsState;
  matches: WorldsMatchEvent[];
}
export interface WorldsMatchDetail {
  id: string;
  rosters: Record<string, WorldsTeamRoster>;
  gameTelemetry: Record<number, WorldsGameTelemetry>;
  teams: [WorldsTeam, WorldsTeam] | null;
  games: {
    id: string;
    number: number;
    state: WorldsState;
    blueTeamId: string | null;
    redTeamId: string | null;
    vods: { provider: 'youtube'; parameter: string; locale: string }[];
  }[];
  streams: { provider: 'twitch'; parameter: string; locale: string }[];
}
export interface WorldsSchedule {
  stages: WorldsStageGroup[];
  defaultMatchId: string | null;
  liveMatchId: string | null;
  fetchedAt: string;
  source: 'official' | 'fallback' | 'stale';
}
export function worldsRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function text(value: unknown, max = 150) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}
function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
function state(value: unknown): WorldsState {
  return value === 'inProgress' || value === 'completed' ? value : 'unstarted';
}
export function isPlaceholderTeam(team: unknown) {
  const value = worldsRecord(team),
    name = text(value.name),
    code = text(value.code);
  return !name || !code || /^tbd$/i.test(name) || /^tbd$/i.test(code) || /por definir/i.test(name);
}
export function worldsImageUrl(raw: unknown): string | null {
  try {
    const url = new URL(text(raw, 1000));
    if (
      url.hostname !== 'static.lolesports.com' ||
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.port ||
      /team-tbd\.png/i.test(url.pathname)
    )
      return null;
    url.protocol = 'https:';
    return url.href;
  } catch {
    return null;
  }
}
export const WORLDS_STAGES: { slug: WorldsStageSlug; label: string; dateRangeLabel: string }[] = [
  { slug: 'play-ins', label: 'Play-In', dateRangeLabel: '15–18 oct' },
  { slug: 'swiss', label: 'Fase Suiza', dateRangeLabel: '23–31 oct' },
  { slug: 'quarterfinals', label: 'Cuartos de Final', dateRangeLabel: '3–6 nov' },
  { slug: 'semifinals', label: 'Semifinales', dateRangeLabel: '7–8 nov' },
  { slug: 'final', label: 'Gran Final', dateRangeLabel: '14 nov' },
];
export function mapBlockToStage(blockName: string) {
  const index = /play[ -]?ins?/i.test(blockName)
    ? 0
    : /swiss|suiza/i.test(blockName)
      ? 1
      : /cuartos|quarter/i.test(blockName)
        ? 2
        : /semifinal/i.test(blockName)
          ? 3
          : /^final|gran final/i.test(blockName)
            ? 4
            : -1;
  return index >= 0 ? WORLDS_STAGES[index]! : null;
}
function teams(raw: unknown): [WorldsTeam, WorldsTeam] | null {
  const rows = list(raw);
  if (rows.length !== 2 || rows.some(isPlaceholderTeam)) return null;
  return rows.map((row) => {
    const value = worldsRecord(row),
      result = worldsRecord(value.result);
    return {
      id: text(value.id) || undefined,
      name: text(value.name),
      code: text(value.code, 16),
      imageUrl: worldsImageUrl(value.image),
      gameWins:
        Number.isInteger(result.gameWins) && Number(result.gameWins) >= 0
          ? Number(result.gameWins)
          : null,
    };
  }) as [WorldsTeam, WorldsTeam];
}
export function parseWorldsScheduleEvents(rawEvents: unknown): WorldsMatchEvent[] {
  const events = new Map<string, WorldsMatchEvent>();
  for (const raw of list(rawEvents)) {
    const value = worldsRecord(raw),
      match = worldsRecord(value.match),
      league = worldsRecord(value.league);
    const startTime = text(value.startTime),
      id = text(match.id),
      blockName = text(value.blockName),
      stage = mapBlockToStage(blockName);
    if (
      !stage ||
      !/^\d{1,24}$/.test(id) ||
      !startTime.startsWith('2026-') ||
      !Number.isFinite(Date.parse(startTime)) ||
      (league.slug && league.slug !== 'worlds') ||
      (league.id && league.id !== '98767975604431411')
    )
      continue;
    const confirmed = teams(match.teams),
      count = worldsRecord(match.strategy).count;
    events.set(id, {
      id,
      startTime,
      state: state(value.state),
      blockName,
      stageSlug: stage.slug,
      stageLabel: stage.label,
      bestOf: [1, 3, 5].includes(Number(count)) ? Number(count) : stage.slug === 'swiss' ? 1 : 5,
      hasConfirmedTeams: confirmed !== null,
      teams: confirmed,
    });
  }
  return [...events.values()].sort(
    (a, b) => Date.parse(a.startTime) - Date.parse(b.startTime) || a.id.localeCompare(b.id),
  );
}
export function groupWorldsEventsByStage(events: WorldsMatchEvent[]): WorldsStageGroup[] {
  return WORLDS_STAGES.map((stage) => {
    const matches = events
      .filter((e) => e.stageSlug === stage.slug)
      .sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));
    return {
      ...stage,
      matches,
      firstStartTime: matches[0]?.startTime ?? '',
      lastStartTime: matches.at(-1)?.startTime ?? '',
      state: matches.some((e) => e.state === 'inProgress')
        ? 'inProgress'
        : matches.length > 0 && matches.every((e) => e.state === 'completed')
          ? 'completed'
          : 'unstarted',
    };
  });
}
export function pickDefaultWorldsMatch(events: WorldsMatchEvent[], nowMs = Date.now()) {
  const ordered = [...events].sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));
  return (
    ordered.find((e) => e.state === 'inProgress') ??
    ordered.find((e) => e.state === 'unstarted' && Date.parse(e.startTime) >= nowMs) ??
    ordered.filter((e) => e.state === 'completed').at(-1) ??
    ordered.find((e) => e.state === 'unstarted') ??
    null
  );
}
export function parseWorldsMatchDetail(raw: unknown): WorldsMatchDetail | null {
  const value = worldsRecord(raw),
    league = worldsRecord(value.league),
    match = worldsRecord(value.match),
    id = text(value.id);
  if (!/^\d{1,24}$/.test(id) || (league.id !== '98767975604431411' && league.slug !== 'worlds'))
    return null;
  return {
    id,
    rosters: {},
    gameTelemetry: {},
    teams: teams(match.teams),
    games: list(match.games)
      .slice(0, 5)
      .flatMap((rawGame) => {
        const game = worldsRecord(rawGame),
          number = Number(game.number),
          sides = list(game.teams).map(worldsRecord);
        if (!Number.isInteger(number) || number < 1 || number > 5) return [];
        return [
          {
            id: text(game.id),
            number,
            state: state(game.state),
            blueTeamId: text(sides.find((t) => t.side === 'blue')?.id) || null,
            redTeamId: text(sides.find((t) => t.side === 'red')?.id) || null,
            vods: list(game.vods).flatMap((rawVod) => {
              const vod = worldsRecord(rawVod),
                parameter = text(vod.parameter);
              return vod.provider === 'youtube' && /^[A-Za-z0-9_-]{11}$/.test(parameter)
                ? [{ provider: 'youtube' as const, parameter, locale: text(vod.locale, 20) }]
                : [];
            }),
          },
        ];
      })
      .sort((a, b) => a.number - b.number),
    streams: list(value.streams).flatMap((rawStream) => {
      const stream = worldsRecord(rawStream),
        parameter = text(stream.parameter);
      return stream.provider === 'twitch' && /^[a-z0-9_]{1,30}$/i.test(parameter)
        ? [{ provider: 'twitch' as const, parameter, locale: text(stream.locale, 20) }]
        : [];
    }),
  };
}
export function describeWorldsMatch(match: WorldsMatchEvent, detail?: WorldsMatchDetail | null) {
  const narratives: Record<WorldsStageSlug, string> = {
    'play-ins':
      'El Play-In decide qué equipos avanzan a la fase principal del Mundial. Cada serie pone en juego la continuidad en el torneo.',
    swiss:
      'En la Fase Suiza, los equipos buscan tres victorias para avanzar a cuartos; tres derrotas significan la eliminación. Las series de clasificación y eliminación se juegan al mejor de tres.',
    quarterfinals:
      'Los ocho clasificados disputan eliminatorias directas. El vencedor de esta serie avanza a semifinales.',
    semifinals: 'Los vencedores de cuartos compiten por uno de los dos lugares en la Gran Final.',
    final:
      'La última serie del Mundial decide qué equipo levanta la Copa del Invocador y se convierte en campeón de Worlds 2026.',
  };
  const confirmed = match.hasConfirmedTeams ? (detail?.teams ?? match.teams) : null;
  return {
    phase: match.stageLabel,
    format: `Mejor de ${match.bestOf} · Bo${match.bestOf}`,
    title: confirmed
      ? `${confirmed[0].name} vs ${confirmed[1].name}`
      : `${match.stageLabel} · Cruces por definir`,
    description: `${narratives[match.stageSlug]} ${confirmed ? `${confirmed[0].name} y ${confirmed[1].name} se enfrentan en esta jornada.` : 'Los equipos se definirán al concluir los sorteos y las llaves previas.'}`,
    teams: confirmed,
  };
}
function parseRole(raw: unknown): WorldsRole | null {
  const aliases: Record<string, WorldsRole> = {
    top: 'top',
    jungle: 'jungle',
    jng: 'jungle',
    mid: 'mid',
    middle: 'mid',
    bottom: 'bottom',
    bot: 'bottom',
    adc: 'bottom',
    support: 'support',
    sup: 'support',
    utility: 'support',
  };
  return aliases[text(raw).toLowerCase()] ?? null;
}
export function parseWorldsTeamRoster(rawTeam: unknown): WorldsTeamRoster | null {
  const team = worldsRecord(rawTeam);
  if (isPlaceholderTeam(team) || !/^\d{1,24}$/.test(text(team.id))) return null;
  const players: WorldsPlayerProfile[] = [];
  const ids = new Set<string>();
  for (const raw of list(team.players)) {
    const player = worldsRecord(raw),
      role = parseRole(player.role),
      id = text(player.id),
      summonerName = text(player.summonerName);
    if (!role || !id || !summonerName || ids.has(id)) continue;
    ids.add(id);
    const imageUrl = worldsImageUrl(player.image);
    players.push({
      id,
      summonerName,
      firstName: text(player.firstName),
      lastName: text(player.lastName),
      role,
      imageUrl: imageUrl && !/default-headshot\.png/i.test(imageUrl) ? imageUrl : null,
    });
  }
  players.sort(
    (a, b) =>
      WORLDS_ROLES.findIndex((r) => r.role === a.role) -
      WORLDS_ROLES.findIndex((r) => r.role === b.role),
  );
  return {
    teamId: text(team.id),
    code: text(team.code, 16).toUpperCase(),
    name: text(team.name),
    homeLeague: text(worldsRecord(team.homeLeague).name) || null,
    players,
  };
}
export const FALLBACK_WORLDS_2026_ROSTERS: Record<string, WorldsTeamRoster> = Object.fromEntries(
  Object.values(rosterSnapshot).flatMap((raw) => {
    const roster = parseWorldsTeamRoster(raw);
    return roster ? [[roster.code, roster]] : [];
  }),
);
function stat(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.round(value) : 0;
}
export function parseWorldsGameTelemetry(
  gameId: string,
  gameNumber: number,
  windowJson: unknown,
  firstTimestampIso?: string | null,
): WorldsGameTelemetry | null {
  if (
    !/^\d{1,24}$/.test(gameId) ||
    !Number.isInteger(gameNumber) ||
    gameNumber < 1 ||
    gameNumber > 5
  )
    return null;
  const data = worldsRecord(windowJson),
    metadata = worldsRecord(data.gameMetadata);
  const frames = list(data.frames)
    .map(worldsRecord)
    .filter((frame) => Number.isFinite(Date.parse(text(frame.rfc460Timestamp))));
  frames.sort((a, b) => Date.parse(text(a.rfc460Timestamp)) - Date.parse(text(b.rfc460Timestamp)));
  const last = frames.at(-1);
  if (!last || !last.blueTeam || !last.redTeam) return null;
  const gameState =
    last.gameState === 'finished'
      ? 'finished'
      : last.gameState === 'unstarted'
        ? 'unstarted'
        : 'in_game';
  function teamStats(raw: unknown): WorldsGameTeamStats {
    const team = worldsRecord(raw);
    return {
      totalGold: stat(team.totalGold),
      totalKills: stat(team.totalKills),
      towers: stat(team.towers),
      barons: stat(team.barons),
      inhibitors: stat(team.inhibitors),
      dragons: list(team.dragons)
        .filter((v): v is string => typeof v === 'string')
        .map((v) => text(v, 30))
        .slice(0, 20),
    };
  }
  const blueTeam = teamStats(last.blueTeam),
    redTeam = teamStats(last.redTeam);
  if (
    gameState === 'unstarted' &&
    !blueTeam.totalGold &&
    !redTeam.totalGold &&
    !blueTeam.totalKills &&
    !redTeam.totalKills
  )
    return null;
  function players(
    raw: unknown,
    rawMeta: unknown,
    team: WorldsGameTeamStats,
    blue: boolean,
  ): WorldsGamePlayerStats[] {
    const participants = list(worldsRecord(raw).participants).map(worldsRecord);
    const seen = new Set<number>();
    return list(worldsRecord(rawMeta).participantMetadata)
      .flatMap((rawPlayer) => {
        const meta = worldsRecord(rawPlayer),
          participantId = Number(meta.participantId),
          role = parseRole(meta.role);
        const player = participants.find((p) => Number(p.participantId) === participantId);
        if (
          !player ||
          !role ||
          !Number.isInteger(participantId) ||
          participantId < (blue ? 1 : 6) ||
          participantId > (blue ? 5 : 10) ||
          seen.has(participantId)
        )
          return [];
        seen.add(participantId);
        const kills = stat(player.kills),
          deaths = stat(player.deaths),
          assists = stat(player.assists),
          totalGold = stat(player.totalGold),
          championId = text(meta.championId, 60);
        return [
          {
            participantId,
            summonerName: text(meta.summonerName) || 'Jugador',
            championId,
            championIconUrl: /^[A-Za-z0-9]+$/.test(championId)
              ? `https://ddragon.leagueoflegends.com/cdn/16.17.1/img/champion/${encodeURIComponent(championId)}.png`
              : '',
            role,
            level: stat(player.level),
            kills,
            deaths,
            assists,
            kdaRatio: Number(((kills + assists) / Math.max(1, deaths)).toFixed(2)),
            killParticipationPct: Math.min(
              100,
              Math.round(((kills + assists) / Math.max(1, team.totalKills)) * 100),
            ),
            creepScore: stat(player.creepScore),
            totalGold,
            goldSharePct: Math.min(
              100,
              Math.round((totalGold / Math.max(1, team.totalGold)) * 100),
            ),
            isMvp: false,
          },
        ];
      })
      .sort(
        (a, b) =>
          WORLDS_ROLES.findIndex((r) => r.role === a.role) -
          WORLDS_ROLES.findIndex((r) => r.role === b.role),
      );
  }
  const bluePlayers = players(last.blueTeam, metadata.blueTeamMetadata, blueTeam, true),
    redPlayers = players(last.redTeam, metadata.redTeamMetadata, redTeam, false);
  const favored =
    blueTeam.totalGold !== redTeam.totalGold
      ? blueTeam.totalGold > redTeam.totalGold
        ? bluePlayers
        : redPlayers
      : blueTeam.totalKills !== redTeam.totalKills
        ? blueTeam.totalKills > redTeam.totalKills
          ? bluePlayers
          : redPlayers
        : [...bluePlayers, ...redPlayers];
  const impact = (p: WorldsGamePlayerStats) =>
    p.kills * 3 + p.assists * 1.5 - p.deaths * 1.2 + p.goldSharePct * 0.25;
  const mvp = [...favored].sort(
    (a, b) => impact(b) - impact(a) || a.participantId - b.participantId,
  )[0];
  if (mvp) mvp.isMvp = true;
  const start = Date.parse(firstTimestampIso || text(frames[0]?.rfc460Timestamp));
  return {
    gameId,
    gameNumber,
    gameState,
    patchVersion: text(metadata.patchVersion) || null,
    durationSeconds: Number.isFinite(start)
      ? Math.max(0, Math.round((Date.parse(text(last.rfc460Timestamp)) - start) / 1000))
      : null,
    blueTeam,
    redTeam,
    bluePlayers,
    redPlayers,
  };
}
