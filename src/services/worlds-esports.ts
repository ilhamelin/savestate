import 'server-only';
import fallbackEvents from '@/domain/worlds-2026-fallback.json';
import { AppError } from '@/lib/http';
import { mergeWorldsTelemetry } from '@/domain/worlds-telemetry';
import {
  groupWorldsEventsByStage,
  parseWorldsScheduleEvents,
  parseWorldsMatchDetail,
  pickDefaultWorldsMatch,
  worldsRecord,
  type WorldsSchedule,
  type WorldsMatchDetail,
  parseWorldsTeamRoster,
  parseWorldsGameTelemetry,
  FALLBACK_WORLDS_2026_ROSTERS,
  type WorldsTeam,
  type WorldsTeamRoster,
} from '@/domain/worlds-schedule';
const BASE = 'https://esports-api.lolesports.com/persisted/gw';
const LEAGUE = '98767975604431411';
async function esportsRequest(endpoint: string, params: Record<string, string> = {}) {
  const url = `${BASE}/${endpoint}?${new URLSearchParams({ hl: 'es-ES', ...params })}`;
  const response = await fetch(url, {
    headers: {
      'x-api-key': process.env.LOLESPORTS_API_KEY || '0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z',
    },
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(6000),
  });
  if (!response.ok || Number(response.headers.get('content-length')) > 2_000_000)
    throw new AppError('LoL Esports no está disponible temporalmente.', 503);
  const raw = await response.text();
  if (raw.length > 2_000_000) throw new AppError('Respuesta de LoL Esports demasiado grande.', 503);
  return worldsRecord(worldsRecord(JSON.parse(raw)).data);
}
let scheduleCache: { value: WorldsSchedule; expires: number } | null = null;
let pendingSchedule: Promise<WorldsSchedule> | null = null;
async function loadSchedule(): Promise<WorldsSchedule> {
  const livePromise = esportsRequest('getLive').catch(() => null);
  const schedulePromise = (async () => {
    let data = await esportsRequest('getSchedule', { leagueId: LEAGUE });
    const events: unknown[] = [];
    const tokens = new Set<string>();
    for (let page = 0; page < 4; page++) {
      const schedule = worldsRecord(data.schedule);
      if (Array.isArray(schedule.events)) events.push(...schedule.events);
      const next = worldsRecord(schedule.pages).newer;
      if (typeof next !== 'string' || !next || next.length > 1000 || tokens.has(next) || page === 3)
        break;
      tokens.add(next);
      data = await esportsRequest('getSchedule', { leagueId: LEAGUE, pageToken: next });
    }
    const parsed = parseWorldsScheduleEvents(events);
    if (!parsed.length) throw new AppError('Calendario de Worlds no disponible.', 503);
    return parsed;
  })();
  const [scheduleResult, liveResult] = await Promise.allSettled([schedulePromise, livePromise]);
  const official = scheduleResult.status === 'fulfilled';
  const prior = scheduleCache?.value;
  const events = official
    ? scheduleResult.value
    : prior && prior.source !== 'fallback'
      ? prior.stages.flatMap((stage) => stage.matches)
      : parseWorldsScheduleEvents(fallbackEvents);
  const live =
    liveResult.status === 'fulfilled' ? worldsRecord(liveResult.value?.schedule).events : [];
  for (const event of parseWorldsScheduleEvents(live)) {
    if (event.state !== 'inProgress') continue;
    const index = events.findIndex((e) => e.id === event.id);
    if (index >= 0) events[index] = event;
    else events.push(event);
  }
  const now = Date.now();
  return {
    stages: groupWorldsEventsByStage(events),
    defaultMatchId: pickDefaultWorldsMatch(events, now)?.id ?? null,
    liveMatchId: events.find((e) => e.state === 'inProgress')?.id ?? null,
    fetchedAt: official || !prior ? new Date(now).toISOString() : prior.fetchedAt,
    source: official ? 'official' : prior && prior.source !== 'fallback' ? 'stale' : 'fallback',
  };
}
export async function fetchWorldsSchedule(): Promise<WorldsSchedule> {
  if (scheduleCache && scheduleCache.expires > Date.now()) return scheduleCache.value;
  if (!pendingSchedule)
    pendingSchedule = loadSchedule()
      .then((value) => {
        scheduleCache = {
          value,
          expires: Date.now() + (value.source === 'official' ? 300_000 : 60_000),
        };
        return value;
      })
      .finally(() => {
        pendingSchedule = null;
      });
  return pendingSchedule;
}
const detailsCache = new Map<string, { value: WorldsMatchDetail; expires: number }>();
const pendingDetails = new Map<string, Promise<WorldsMatchDetail>>();
const rosterCache = new Map<string, { value: WorldsTeamRoster | null; expires: number }>();
const pendingRosters = new Map<string, Promise<WorldsTeamRoster | null>>();
async function teamRoster(team: WorldsTeam): Promise<WorldsTeamRoster | null> {
  const fallback = FALLBACK_WORLDS_2026_ROSTERS[team.code.toUpperCase()] ?? null;
  if (!team.id || !/^\d{1,24}$/.test(team.id)) return fallback;
  const id = team.id,
    cached = rosterCache.get(id);
  if (cached && cached.expires > Date.now()) return cached.value;
  const pending = pendingRosters.get(id);
  if (pending) return pending;
  const request = (async () => {
    let value = fallback;
    try {
      const data = await esportsRequest('getTeams', { id });
      const rows = Array.isArray(data.teams) ? data.teams : [];
      const roster = parseWorldsTeamRoster(rows.find((raw) => worldsRecord(raw).id === id));
      if (roster?.players.length && roster.code === team.code.toUpperCase()) value = roster;
    } catch {
      /* Roster outage must not hide series or telemetry. */
    }
    if (rosterCache.size >= 100) rosterCache.delete(rosterCache.keys().next().value!);
    rosterCache.set(id, { value, expires: Date.now() + 1800000 });
    return value;
  })().finally(() => pendingRosters.delete(id));
  pendingRosters.set(id, request);
  return request;
}
async function feedWindow(gameId: string, startingTime?: string) {
  const url = `https://feed.lolesports.com/livestats/v1/window/${gameId}${startingTime ? `?${new URLSearchParams({ startingTime })}` : ''}`;
  const response = await fetch(url, {
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(6000),
  });
  if (!response.ok) throw new Error('Telemetry unavailable');
  const raw = await response.text();
  if (raw.length > 2000000) throw new Error('Telemetry too large');
  return worldsRecord(JSON.parse(raw));
}
const telemetryCache = new Map<
  string,
  { value: ReturnType<typeof parseWorldsGameTelemetry>; expires: number }
>();
async function gameTelemetry(game: WorldsMatchDetail['games'][number]) {
  if (game.state === 'unstarted' || !/^\d{1,24}$/.test(game.id)) return null;
  const cached = telemetryCache.get(game.id);
  if (cached && cached.expires > Date.now()) return cached.value;
  try {
    const first = await feedWindow(game.id),
      frames = Array.isArray(first.frames) ? first.frames : [];
    const ts = worldsRecord(frames[0]).rfc460Timestamp;
    const firstTs = typeof ts === 'string' && Number.isFinite(Date.parse(ts)) ? ts : null;
    let last = first;
    if (firstTs) {
      const iso = (ms: number) =>
        new Date(Math.floor(ms / 10000) * 10000).toISOString().replace(/\.\d{3}Z$/, 'Z');
      try {
        last = await feedWindow(game.id, iso(Date.parse(firstTs) + 7200000));
      } catch {
        if (game.state === 'inProgress')
          last = await feedWindow(game.id, iso(Date.now() - 30000)).catch(() => first);
      }
    }
    const value = parseWorldsGameTelemetry(
      game.id,
      game.number,
      { ...last, gameMetadata: last.gameMetadata ?? first.gameMetadata },
      firstTs,
    );
    if (!value) return cached?.value ?? null;
    const retained = mergeWorldsTelemetry(cached?.value ? { [game.number]: cached.value } : {}, {
      [game.number]: value,
    })[game.number]!;
    if (telemetryCache.size >= 500) telemetryCache.delete(telemetryCache.keys().next().value!);
    telemetryCache.set(game.id, {
      value: retained,
      expires: Date.now() + (retained.gameState === 'finished' ? 7 * 86400 * 1000 : 15000),
    });
    return retained;
  } catch {
    return cached?.value ?? null;
  }
}
export async function fetchWorldsMatchDetail(matchId: string): Promise<WorldsMatchDetail> {
  if (!/^\d{1,24}$/.test(matchId)) throw new AppError('Identificador de partida inválido.', 400);
  const cached = detailsCache.get(matchId);
  if (cached && cached.expires > Date.now()) return cached.value;
  const pending = pendingDetails.get(matchId);
  if (pending) return pending;
  const request = (async () => {
    const data = await esportsRequest('getEventDetails', { id: matchId });
    const detail = parseWorldsMatchDetail(data.event);
    if (!detail || detail.id !== matchId)
      throw new AppError('No se encontró esta partida de Worlds.', 404);
    const [rosters, telemetry] = await Promise.all([
      Promise.all((detail.teams ?? []).map(teamRoster)),
      Promise.all(detail.games.map(gameTelemetry)),
    ]);
    for (const roster of rosters) if (roster) detail.rosters[roster.code] = roster;
    for (const game of telemetry) if (game) detail.gameTelemetry[game.gameNumber] = game;
    detail.gameTelemetry = mergeWorldsTelemetry(
      Object.fromEntries(
        Object.entries(cached?.value.gameTelemetry ?? {}).filter(([, value]) =>
          detail.games.some((game) => game.id === value.gameId && game.number === value.gameNumber),
        ),
      ),
      detail.gameTelemetry,
    );
    if (detailsCache.size >= 100) detailsCache.delete(detailsCache.keys().next().value!);
    detailsCache.set(matchId, {
      value: detail,
      expires:
        Date.now() + (detail.games.some((game) => game.state === 'inProgress') ? 15000 : 60000),
    });
    return detail;
  })().finally(() => {
    pendingDetails.delete(matchId);
  });
  pendingDetails.set(matchId, request);
  return request;
}
