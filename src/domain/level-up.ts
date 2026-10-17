import { PLAYER_TITLES } from './progression.ts';
export const seenLevelKey = (userId: string) => `savestate_seen_level_${userId}`;
export function parseSeenLevel(value: string | null): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const level = Number(value);
  return Number.isSafeInteger(level) && level > 0 ? level : null;
}
export function shouldCelebrateLevel(current: number, seen: number | null) {
  return Number.isInteger(current) && current > 0 && seen !== null && current > seen;
}
export function levelUpTitle(level: number) {
  return [...PLAYER_TITLES].reverse().find((title) => title.level <= level)?.name ?? 'Insert Coin';
}
