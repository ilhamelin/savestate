import type { Game, PlayLog, UserGame } from './model.ts';

export function platformKey(value: string): string {
  const key = value.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
  if (['pc', 'pc / steam', 'steam', 'pc (microsoft windows)', 'windows'].includes(key)) return 'pc';
  const playstation = /^(?:ps|playstation\s*)([1-5])$/.exec(key);
  return playstation ? `playstation ${playstation[1]}` : key;
}

export function libraryPlatformOptions(
  entries: UserGame[],
  games: Game[],
  logs: PlayLog[],
): string[] {
  const entryIds = new Set(entries.map((entry) => entry.id));
  const played = logs
    .filter((log) => entryIds.has(log.user_game_id))
    .map((log) => log.platform_played);
  const gameIds = new Set(entries.map((entry) => entry.game_id));
  const unique = (values: string[]) =>
    [...new Set(values.filter((value) => typeof value === 'string' && value.trim()))].sort((a, b) =>
      a.localeCompare(b, 'es'),
    );
  const options = unique(played);
  return options.length
    ? options
    : unique(games.filter((game) => gameIds.has(game.id)).flatMap((game) => game.platforms));
}

export function matchesLibraryPlatform(
  game: Game,
  logs: PlayLog[],
  platform: string,
  allowCompatibility = false,
): boolean {
  if (!platform) return true;
  const key = platformKey(platform);
  const played = logs.some(
    (log) => typeof log.platform_played === 'string' && platformKey(log.platform_played) === key,
  );
  return (
    played ||
    ((!logs.length || allowCompatibility) &&
      game.platforms.some((value) => platformKey(value) === key))
  );
}
