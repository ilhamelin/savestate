export const BADGE_IDS = [
  'first_checkpoint',
  'broadcaster',
  'coop_comrade',
  'arcade_veteran',
  'retro_collector',
  'rpg_master',
  'completionist',
] as const;
export interface Badge {
  id: string;
  name: string;
  description: string;
  category: 'milestone' | 'genre' | 'community' | 'special';
  icon_pixel: string;
  created_at: string;
}
export interface UserBadge {
  user_id: string;
  badge_id: string;
  unlocked_at: string;
}
export function badgeOrder(id: string) {
  const index = BADGE_IDS.findIndex((value) => value === id);
  return index < 0 ? BADGE_IDS.length : index;
}
