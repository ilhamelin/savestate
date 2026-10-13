import { record, nonnegative } from './game-live-telemetry.ts';
import type { ValorantProfile } from './competitive-tracker.ts';
export function valorantImage(value: unknown): string | null {
  try {
    const url = new URL(String(value));
    return url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.port &&
      ['media.valorant-api.com', 'cdn.henrikdev.xyz', 'ddragon.leagueoflegends.com'].includes(
        url.hostname,
      )
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export function optionalText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 200) : null;
}
export function henrikMatches(
  payload: unknown,
  puuid: string,
  name: string,
  tag: string,
): ValorantProfile['matches'] {
  const list = record(payload).data;
  if (!Array.isArray(list)) return [];
  return list.slice(0, 5).flatMap((raw) => {
    const match = record(raw),
      metadata = record(match.metadata);
    const players = record(match.players).all_players;
    if (!Array.isArray(players) || typeof metadata.matchid !== 'string') return [];
    const candidates = players.map(record);
    const player =
      candidates.find((item) => item.puuid === puuid) ??
      candidates.find(
        (item) =>
          typeof item.name === 'string' &&
          typeof item.tag === 'string' &&
          String(item.name).toLowerCase() === name.toLowerCase() &&
          String(item.tag).toLowerCase() === tag.toLowerCase(),
      );
    if (!player) return [];
    const stats = record(player.stats),
      team = record(record(match.teams)[String(player.team).toLowerCase()]);
    const hs = nonnegative(stats.headshots) ?? 0,
      bs = nonnegative(stats.bodyshots) ?? 0,
      ls = nonnegative(stats.legshots) ?? 0;
    const timestamp = nonnegative(metadata.game_start);
    const date =
      timestamp === null
        ? new Date(String(metadata.game_start_patched ?? ''))
        : new Date(timestamp * 1000);
    return [
      {
        matchId: metadata.matchid,
        map: optionalText(metadata.map) ?? 'Mapa desconocido',
        mode: optionalText(metadata.mode) ?? 'Modo desconocido',
        startedAt: Number.isFinite(date.getTime()) ? date.toISOString() : '',
        agentName: optionalText(player.character) ?? 'Agente desconocido',
        agentIconUrl: valorantImage(record(record(player.assets).agent).small),
        kills: nonnegative(stats.kills) ?? 0,
        deaths: nonnegative(stats.deaths) ?? 0,
        assists: nonnegative(stats.assists) ?? 0,
        score: nonnegative(stats.score) ?? 0,
        headshotPercent: Math.round((hs / Math.max(1, hs + bs + ls)) * 100),
        won: typeof team.has_won === 'boolean' ? team.has_won : null,
        roundsWon: nonnegative(team.rounds_won),
        roundsLost: nonnegative(team.rounds_lost),
      },
    ];
  });
}
export function normalizedHenrik(
  accountPayload: unknown,
  mmrPayload: unknown,
  matchPayload: unknown,
  identity: Pick<ValorantProfile, 'puuid' | 'gameName' | 'tagLine'>,
) {
  const account = record(record(accountPayload).data),
    mmr = record(record(mmrPayload).data),
    current = record(mmr.current_data),
    peak = record(mmr.highest_rank);
  const rr = nonnegative(current.ranking_in_tier);
  return {
    accountLevel: nonnegative(account.account_level),
    cardSmallUrl: valorantImage(record(account.card).small),
    cardWideUrl: valorantImage(record(account.card).wide),
    currentRank: optionalText(current.currenttierpatched),
    rankIconUrl: valorantImage(record(current.images).large ?? record(current.images).small),
    rankingInTier: rr,
    lastMmrChange:
      typeof current.mmr_change_to_last_game === 'number' &&
      Number.isFinite(current.mmr_change_to_last_game)
        ? current.mmr_change_to_last_game
        : null,
    elo: nonnegative(current.elo),
    peakRank: optionalText(peak.patched_tier)
      ? `${optionalText(peak.patched_tier)}${optionalText(peak.season) ? ` (${optionalText(peak.season)})` : ''}`
      : null,
    matches: henrikMatches(matchPayload, identity.puuid, identity.gameName, identity.tagLine),
  };
}
export function normalizedLeaderboard(payload: unknown): ValorantProfile['regionalLeaderboard'] {
  const players = record(payload).players;
  if (!Array.isArray(players)) return [];
  return players
    .map(record)
    .flatMap((player) => {
      const rank = nonnegative(player.leaderboardRank);
      if (!rank || !optionalText(player.gameName) || !optionalText(player.tagLine)) return [];
      return [
        {
          rank,
          gameName: optionalText(player.gameName)!,
          tagLine: optionalText(player.tagLine)!,
          rankedRating: nonnegative(player.rankedRating) ?? 0,
          numberOfWins: nonnegative(player.numberOfWins) ?? 0,
        },
      ];
    })
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 5);
}
