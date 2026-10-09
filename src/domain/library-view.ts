import type { Game, PlayLog, UserGame } from './model.ts';
import { matchesLibraryPlatform } from './library-platforms.ts';
export type LibrarySort = 'updated' | 'title' | 'rating' | 'hours' | 'achievements';
export function achievementPercent(log: PlayLog): number | null {
  const progress = log.console_progress;
  if (
    !progress ||
    !Number.isFinite(progress.current) ||
    !Number.isFinite(progress.total) ||
    progress.current < 0 ||
    progress.total <= 0
  )
    return null;
  return Math.min(100, (progress.current / progress.total) * 100);
}
export function filterLibrary(
  entries: UserGame[],
  games: Game[],
  logs: PlayLog[],
  filters: {
    query: string;
    status: string;
    platform: string;
    genre: string;
    sort: LibrarySort;
    completedAchievements?: boolean;
  },
) {
  const gameMap = new Map(games.map((game) => [game.id, game]));
  const hours = new Map<string, number>();
  const entryLogs = new Map<string, PlayLog[]>();
  const progress = new Map<string, number>();
  for (const log of logs) {
    const percent = achievementPercent(log);
    if (percent !== null)
      progress.set(log.user_game_id, Math.max(progress.get(log.user_game_id) ?? -1, percent));
    hours.set(log.user_game_id, (hours.get(log.user_game_id) ?? 0) + Number(log.hours_played));
    const group = entryLogs.get(log.user_game_id) ?? [];
    group.push(log);
    entryLogs.set(log.user_game_id, group);
  }
  const normalize = (value: string) =>
    value
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLocaleLowerCase('es');
  const query = normalize(filters.query.trim());
  return entries
    .filter((entry) => {
      const game = gameMap.get(entry.game_id);
      return (
        game &&
        (filters.status === 'all' || entry.status === filters.status) &&
        (!filters.completedAchievements || progress.get(entry.id) === 100) &&
        normalize(game.title).includes(query) &&
        matchesLibraryPlatform(game, entryLogs.get(entry.id) ?? [], filters.platform) &&
        (!filters.genre || game.genres.includes(filters.genre))
      );
    })
    .sort((a, b) => {
      const titleOrder = (gameMap.get(a.game_id)?.title ?? '').localeCompare(
        gameMap.get(b.game_id)?.title ?? '',
        'es',
      );
      if (filters.sort === 'rating')
        return (b.rating ?? -1) - (a.rating ?? -1) || titleOrder || a.id.localeCompare(b.id);
      if (filters.sort === 'achievements')
        return (
          (progress.get(b.id) ?? -1) - (progress.get(a.id) ?? -1) ||
          titleOrder ||
          a.id.localeCompare(b.id)
        );
      if (filters.sort === 'hours')
        return (
          (hours.get(b.id) ?? 0) - (hours.get(a.id) ?? 0) || titleOrder || a.id.localeCompare(b.id)
        );
      if (filters.sort === 'title') return titleOrder || a.id.localeCompare(b.id);
      return b.updated_at.localeCompare(a.updated_at) || titleOrder || a.id.localeCompare(b.id);
    });
}
