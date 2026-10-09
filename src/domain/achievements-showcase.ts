import type { Game, PlayLog, UserGame } from './model.ts';
import { achievementPercent } from './library-view.ts';

export type AchievementPlatform = 'all' | 'steam' | 'xbox' | 'playstation';
export interface AchievementGame {
  game: Game;
  hours: number;
  logs: PlayLog[];
  percent: number;
}
export function achievementPlatform(log: PlayLog): AchievementPlatform {
  switch (log.console_progress?.kind) {
    case 'achievements':
      return 'steam';
    case 'gamerscore':
      return 'xbox';
    case 'trophies':
      return 'playstation';
    default:
      return 'all';
  }
}

export function showcaseGames(
  games: Game[],
  entries: UserGame[],
  logs: PlayLog[],
  platform: AchievementPlatform,
  completed: boolean,
): AchievementGame[] {
  const entryGames = new Map(entries.map((entry) => [entry.id, entry.game_id]));
  const groups = new Map<string, PlayLog[]>();
  for (const log of logs) {
    const gameId = entryGames.get(log.user_game_id);
    if (!gameId) continue;
    const group = groups.get(gameId) ?? [];
    group.push(log);
    groups.set(gameId, group);
  }
  return games
    .flatMap((game) => {
      const allLogs = groups.get(game.id) ?? [];
      const progressLogs = allLogs.filter(
        (log) =>
          achievementPlatform(log) !== 'all' &&
          achievementPercent(log) !== null &&
          (platform === 'all' || achievementPlatform(log) === platform),
      );
      const best = new Map<string, PlayLog>();
      for (const log of progressLogs) {
        const key = `${log.console_progress!.kind}:${log.platform_played}`;
        const previous = best.get(key);
        if (!previous || achievementPercent(log)! > achievementPercent(previous)!)
          best.set(key, log);
      }
      const visibleLogs = [...best.values()].sort(
        (a, b) => achievementPercent(b)! - achievementPercent(a)! || a.id.localeCompare(b.id),
      );
      const percent = visibleLogs.length ? achievementPercent(visibleLogs[0]!)! : null;
      if (percent === null || (completed && percent !== 100)) return [];
      const hours =
        allLogs.reduce(
          (total, log) =>
            total +
            (Number.isFinite(log.hours_played) && log.hours_played > 0
              ? Math.round(log.hours_played * 100)
              : 0),
          0,
        ) / 100;
      return [{ game, hours, logs: visibleLogs, percent }];
    })
    .sort(
      (a, b) =>
        b.percent - a.percent ||
        b.hours - a.hours ||
        a.game.title.localeCompare(b.game.title, 'es') ||
        a.game.id.localeCompare(b.game.id),
    );
}
