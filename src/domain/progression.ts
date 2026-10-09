import { ValidationError } from './validation.ts';

export const PLAYER_TITLES = [
  { level: 1, name: 'Insert Coin' },
  { level: 3, name: 'Button Masher' },
  { level: 7, name: 'Backlog Explorer' },
  { level: 10, name: 'Cartridge Blower' },
  { level: 20, name: 'Save Scummer' },
  { level: 25, name: 'Speedrunner' },
  { level: 30, name: 'Achievement Hunter' },
  { level: 40, name: 'Secret Boss' },
  { level: 50, name: 'Final Boss' },
] as const;
export const AVATAR_FRAMES = [
  { level: 1, id: 'default', name: 'Clásico' },
  { level: 5, id: 'bronze', name: 'Bronce Arcade' },
  { level: 10, id: 'famicom', name: 'Famicom 8-Bit' },
  { level: 15, id: 'neon', name: 'Cyber Neon' },
  { level: 20, id: 'gold', name: 'Dorado 16-Bit' },
  { level: 25, id: 'crt', name: 'CRT Glitch' },
  { level: 30, id: 'platinum', name: 'Platino' },
  { level: 40, id: 'vaporwave', name: 'Vaporwave' },
  { level: 50, id: 'boss', name: 'Final Boss' },
] as const;
export type PlayerTitle = (typeof PLAYER_TITLES)[number]['name'];
export type AvatarFrame = (typeof AVATAR_FRAMES)[number]['id'];
export const XP_ACTIONS = {
  cleared: 150,
  platinum: 300,
  session: 10,
  review: 75,
  highlight: 40,
  steam_connected: 200,
  psn_connected: 200,
  xbox_connected: 200,
} as const;
export type XpAction = keyof typeof XP_ACTIONS;
export interface XpAward {
  success: boolean;
  reason?: string;
  awarded?: number;
  total_xp?: number;
  level?: number;
  leveled_up?: boolean;
}
export interface XpEvent {
  id: string;
  user_id: string;
  amount: number;
  action: XpAction;
  reference_id: string | null;
  created_at: string;
}

export function levelFromXp(xp: number): number {
  if (!Number.isInteger(xp) || xp < 0 || xp > 2147483647) throw new ValidationError('XP inválida.');
  return Math.floor(Math.pow(xp / 100, 1 / 1.65)) + 1;
}
export function xpForLevel(level: number): number {
  if (!Number.isInteger(level) || level < 1 || level > levelFromXp(2147483647) + 1)
    throw new ValidationError('Nivel inválido.');
  return Math.ceil(100 * Math.pow(level - 1, 1.65));
}
export function xpProgress(xp: number) {
  const level = levelFromXp(xp),
    start = xpForLevel(level),
    end = xpForLevel(level + 1);
  const current = xp - start,
    max = end - start;
  return { current, max, percent: Math.min(100, Math.max(0, (current / max) * 100)) };
}
export function unlockedRewards(level: number): { titles: PlayerTitle[]; frames: AvatarFrame[] } {
  xpForLevel(level);
  return {
    titles: PLAYER_TITLES.filter((reward) => level >= reward.level).map((reward) => reward.name),
    frames: AVATAR_FRAMES.filter((reward) => level >= reward.level).map((reward) => reward.id),
  };
}
export function equippedRewards(title: unknown, frame: unknown, level: number) {
  const allowed = unlockedRewards(level);
  if (
    !allowed.titles.includes(title as PlayerTitle) ||
    !allowed.frames.includes(frame as AvatarFrame)
  )
    throw new ValidationError('La recompensa no está desbloqueada para tu nivel.');
  return { equipped_title: title as PlayerTitle, equipped_frame: frame as AvatarFrame };
}
