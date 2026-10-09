import type { ConsoleProgress } from './console-progress.ts';

export function steamLogAppId(platform: string, note: string): number | null {
  if (platform !== 'PC / Steam') return null;
  const match = /^\[Steam lifetime:([1-9]\d{0,9})\]/.exec(note);
  const id = match ? Number(match[1]) : 0;
  return id > 0 && id <= 4294967295 ? id : null;
}

export function steamAchievementSummary(input: unknown): ConsoleProgress | null {
  if (!input || typeof input !== 'object') return null;
  const stats = (input as { playerstats?: unknown }).playerstats;
  if (!stats || typeof stats !== 'object') return null;
  const { success, achievements } = stats as { success?: unknown; achievements?: unknown };
  if (success !== true || !Array.isArray(achievements) || !achievements.length) return null;
  if (
    achievements.length > 10000000 ||
    achievements.some(
      (item: unknown) =>
        !item ||
        typeof item !== 'object' ||
        ![0, 1].includes((item as { achieved: number }).achieved),
    )
  )
    return null;
  return {
    kind: 'achievements',
    current: achievements.filter((item: { achieved: number }) => item.achieved === 1).length,
    total: achievements.length,
  };
}
