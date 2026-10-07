import type { Game, PlayLog, UserGame } from './model.ts';
export type LibrarySort = 'updated' | 'title' | 'rating' | 'hours';
export function filterLibrary(
  entries: UserGame[],
  games: Game[],
  logs: PlayLog[],
  filters: { query: string; status: string; platform: string; genre: string; sort: LibrarySort },
) {
  const gameMap = new Map(games.map((game) => [game.id, game]));
  const hours = new Map<string, number>();
  for (const log of logs)
    hours.set(log.user_game_id, (hours.get(log.user_game_id) ?? 0) + Number(log.hours_played));
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
        normalize(game.title).includes(query) &&
        (!filters.platform || game.platforms.includes(filters.platform)) &&
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
      if (filters.sort === 'hours')
        return (
          (hours.get(b.id) ?? 0) - (hours.get(a.id) ?? 0) || titleOrder || a.id.localeCompare(b.id)
        );
      if (filters.sort === 'title') return titleOrder || a.id.localeCompare(b.id);
      return b.updated_at.localeCompare(a.updated_at) || titleOrder || a.id.localeCompare(b.id);
    });
}
