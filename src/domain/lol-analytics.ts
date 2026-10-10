import type { LolMatchSummary } from './lol-tracker.ts';

export const LOL_QUEUE_FILTERS = {
  all: 'Todas',
  solo: 'Solo/Dúo',
  normal: 'Normales',
  aram: 'ARAM',
  other: 'Otros / Caos',
} as const;
export type LolQueueFilter = keyof typeof LOL_QUEUE_FILTERS;
export function filterLolMatches(matches: LolMatchSummary[], queue: LolQueueFilter) {
  return matches.filter((match) => {
    switch (queue) {
      case 'solo':
        return match.queueId === 420;
      case 'normal':
        return match.queueId === 400 || match.queueId === 430;
      case 'aram':
        return match.queueId === 450;
      case 'other':
        return ![420, 400, 430, 450].includes(match.queueId);
      default:
        return true;
    }
  });
}
export const LOL_ROLES = {
  TOP: { label: 'Top', icon: '▲' },
  JUNGLE: { label: 'Jungle', icon: '♧' },
  MIDDLE: { label: 'Middle', icon: '◆' },
  BOTTOM: { label: 'Bottom', icon: '▼' },
  UTILITY: { label: 'Support', icon: '✦' },
} as const;
export interface LolAggregate {
  id: string;
  label: string;
  icon: string | null;
  games: number;
  wins: number;
  losses: number;
  winrate: number;
  kdaRatio: number;
  perfect: boolean;
  kills: number;
  deaths: number;
  assists: number;
}
export function lolAnalytics(matches: LolMatchSummary[]) {
  const roles = new Map<string, LolMatchSummary[]>();
  const champions = new Map<string, LolMatchSummary[]>();
  for (const match of matches) {
    const role = match.player.role.toUpperCase();
    const canonical = role === 'SUPPORT' ? 'UTILITY' : role;
    if (Object.hasOwn(LOL_ROLES, canonical))
      roles.set(canonical, [...(roles.get(canonical) ?? []), match]);
    champions.set(match.player.championName, [
      ...(champions.get(match.player.championName) ?? []),
      match,
    ]);
  }
  function summarize(
    id: string,
    label: string,
    icon: string | null,
    rows: LolMatchSummary[],
  ): LolAggregate {
    const games = rows.length;
    const wins = rows.filter((row) => row.player.win).length;
    const kills = rows.reduce((sum, row) => sum + row.player.kills, 0);
    const deaths = rows.reduce((sum, row) => sum + row.player.deaths, 0);
    const assists = rows.reduce((sum, row) => sum + row.player.assists, 0);
    return {
      id,
      label,
      icon,
      games,
      wins,
      losses: games - wins,
      winrate: (wins / games) * 100,
      kdaRatio: (kills + assists) / Math.max(1, deaths),
      perfect: deaths === 0,
      kills: kills / games,
      deaths: deaths / games,
      assists: assists / games,
    };
  }
  return {
    roles: Object.entries(LOL_ROLES).flatMap(([id, role]) => {
      const rows = roles.get(id);
      return rows ? [summarize(id, role.label, role.icon, rows)] : [];
    }),
    champions: [...champions]
      .map(([id, rows]) => summarize(id, id, rows[0]?.player.championIcon ?? null, rows))
      .sort((a, b) => b.games - a.games || a.label.localeCompare(b.label))
      .slice(0, 5),
  };
}
