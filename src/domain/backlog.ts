import type { Game, PlayLog, UserGame } from './model.ts';
import { matchesLibraryPlatform } from './library-platforms.ts';
export function backlogCandidates(
  entries: UserGame[],
  games: Game[],
  platform = '',
  genre = '',
  logs: PlayLog[] = [],
) {
  const ids = new Set(
    entries.filter((entry) => entry.status === 'backlog').map((entry) => entry.game_id),
  );
  const entryIds = new Map(
    entries.filter((entry) => entry.status === 'backlog').map((entry) => [entry.game_id, entry.id]),
  );
  return games.filter(
    (game) =>
      ids.has(game.id) &&
      matchesLibraryPlatform(
        game,
        logs.filter((log) => log.user_game_id === entryIds.get(game.id)),
        platform,
        true,
      ) &&
      (!genre || game.genres.includes(genre)),
  );
}
export function chooseBacklog(games: Game[], random = Math.random): Game | null {
  if (!games.length) return null;
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1)
    throw new Error('Valor aleatorio inválido.');
  return games[Math.floor(value * games.length)] ?? null;
}
