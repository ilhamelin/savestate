import type { Game, UserGame } from './model.ts';
export function backlogCandidates(entries: UserGame[], games: Game[], platform = '', genre = '') {
  const ids = new Set(
    entries.filter((entry) => entry.status === 'backlog').map((entry) => entry.game_id),
  );
  return games.filter(
    (game) =>
      ids.has(game.id) &&
      (!platform || game.platforms.includes(platform)) &&
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
