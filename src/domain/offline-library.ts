import type { Game, UserGame, PlayLog } from '@/domain/model';
import type { OfflineLibraryRow } from '../../public/offline-library/store.mjs';

export function offlineLibraryRows(
  userId: string,
  entries: UserGame[],
  games: Game[],
  logs: PlayLog[],
): OfflineLibraryRow[] {
  const byId = new Map(games.map((game) => [game.id, game]));
  return entries
    .filter((entry) => entry.user_id === userId)
    .slice(0, 504)
    .flatMap((entry) => {
      const game = byId.get(entry.game_id);
      if (!game) return [];
      const sessions = logs.filter((log) => log.user_game_id === entry.id);
      return [
        {
          gameId: game.id,
          title: game.title.slice(0, 200),
          slug: game.slug,
          status: entry.status,
          rating: entry.rating,
          hours:
            Math.round(
              sessions.reduce((sum, log) => sum + Math.max(0, Number(log.hours_played) || 0), 0) *
                10,
            ) / 10,
          sessions: sessions.length,
          platforms: [...new Set(sessions.map((log) => log.platform_played).filter(Boolean))]
            .slice(0, 20)
            .map((platform) => platform.slice(0, 80)),
        },
      ];
    });
}
export const OFFLINE_PUBLIC_ASSETS = [
  '/library-sw.js',
  '/offline-library/index.html',
  '/offline-library/style.css',
  '/offline-library/app.mjs',
  '/offline-library/store.mjs',
] as const;
export function isOfflineLibraryAsset(path: string): boolean {
  return (OFFLINE_PUBLIC_ASSETS as readonly string[]).includes(path);
}
