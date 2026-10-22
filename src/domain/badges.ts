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

export interface PlayerLevel {
  level: number;
  title: string;
  earnedCount: number;
  totalCount: number;
  progressPercentage: number;
  nextLevelThreshold: number | null;
}
export interface BadgeUnlockEvent {
  badgeId: string;
  badgeName: string;
  badgeDescription: string;
  iconPixel: string;
  unlockedAt: string;
}
export interface BadgeUnlockNotification {
  id: string;
  badgeId: string;
  unlockedAt: string;
}
function normalizedCount(value: number): number {
  return Number.isFinite(value) ? Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(value))) : 0;
}
export function calculatePlayerLevel(earnedCount: number, totalCount: number): PlayerLevel {
  const earned = normalizedCount(earnedCount);
  const total = normalizedCount(totalCount);
  let level = 1;
  let title = 'Iniciado del Checkpoint';
  // SPEC-02 acceptance criterion: the first badge is the next threshold, not two.
  let nextLevelThreshold: number | null = 1;
  if (earned >= 7) {
    level = 5; title = 'Leyenda del Guardado'; nextLevelThreshold = null;
  } else if (earned >= 5) {
    level = 4; title = 'Veterano de Bóveda'; nextLevelThreshold = 7;
  } else if (earned >= 3) {
    level = 3; title = 'Explorador de Cartuchos'; nextLevelThreshold = 5;
  } else if (earned >= 1) {
    level = 2; title = 'Coleccionista Novato'; nextLevelThreshold = 3;
  }
  return { level, title, earnedCount: earned, totalCount: total,
    progressPercentage: total > 0 ? Math.min(100, Math.round((earned / total) * 100)) : 0,
    nextLevelThreshold };
}
export function badgeUnlockNotification(raw: unknown, userId: string): BadgeUnlockNotification | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  if (row.user_id !== userId || row.kind !== 'badge_unlocked' ||
    typeof row.id !== 'string' || !row.id || row.id.length > 100 ||
    typeof row.badge_id !== 'string' || !row.badge_id || row.badge_id.length > 100 ||
    typeof row.created_at !== 'string' || !Number.isFinite(Date.parse(row.created_at))) return null;
  return { id: row.id, badgeId: row.badge_id, unlockedAt: new Date(row.created_at).toISOString() };
}
export function badgeUnlockEvent(notice: BadgeUnlockNotification, badge: Badge): BadgeUnlockEvent | null {
  if (badge.id !== notice.badgeId || typeof badge.name !== 'string' || !badge.name.trim() ||
    typeof badge.description !== 'string' || typeof badge.icon_pixel !== 'string') return null;
  return { badgeId: badge.id, badgeName: badge.name.slice(0, 150),
    badgeDescription: badge.description.slice(0, 500), iconPixel: badge.icon_pixel,
    unlockedAt: notice.unlockedAt };
}
