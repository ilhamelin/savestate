export type WorldsStageSlug = 'play-ins' | 'swiss' | 'quarterfinals' | 'semifinals' | 'final';
export type WorldsState = 'unstarted' | 'inProgress' | 'completed';
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
  teams: [WorldsTeam, WorldsTeam] | null;
  games: {
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
