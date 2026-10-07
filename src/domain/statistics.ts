import type { UserGame, Game, PlayLog } from './model.ts';
export function playerStatistics(entries: UserGame[], games: Game[], logs: PlayLog[]) {
  const byEntry = new Map(entries.map((entry) => [entry.id, entry]));
  const byGame = new Map(games.map((game) => [game.id, game]));
  const genres: Record<string, number> = {},
    platforms: Record<string, number> = {};
  const years: Record<string, { hours: number; completed: number }> = {};
  let hours = 0;
  for (const log of logs) {
    const entry = byEntry.get(log.user_game_id);
    if (!entry) continue;
    const amount = Number(log.hours_played);
    hours += amount;
    platforms[log.platform_played] = (platforms[log.platform_played] ?? 0) + amount;
    for (const genre of byGame.get(entry.game_id)?.genres ?? [])
      genres[genre] = (genres[genre] ?? 0) + amount;
    const year = (log.finish_date ?? log.start_date ?? log.created_at).slice(0, 4);
    const stats = years[year] ?? { hours: 0, completed: 0 };
    stats.hours += amount;
    if (log.finish_date) stats.completed++;
    years[year] = stats;
  }
  const rankedGenres = Object.entries(genres).sort((a, b) => b[1] - a[1]);
  const rankedPlatforms = Object.entries(platforms).sort((a, b) => b[1] - a[1]);
  return {
    hours,
    genres: rankedGenres,
    platforms: rankedPlatforms,
    years: Object.entries(years).sort((a, b) => b[0].localeCompare(a[0])),
  };
}
