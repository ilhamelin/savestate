import type { Profile } from './model.ts';

export type FriendProfile = Pick<
  Profile,
  'id' | 'username' | 'avatar_url' | 'level' | 'terminal_status'
> & { last_seen_at?: string | null };
export type PlayerFriend = FriendProfile & { current_game: string | null };
export interface FriendRequest {
  id: string;
  profile: FriendProfile;
}

export function formatLastActivity(
  lastSeenAt: string | null | undefined,
  nowMs = Date.now(),
): string {
  if (!lastSeenAt) return 'Inactivo';
  const timestamp = Date.parse(lastSeenAt);
  if (!Number.isFinite(timestamp) || !Number.isFinite(nowMs)) return 'Inactivo';
  const diffSec = Math.max(0, Math.floor((nowMs - timestamp) / 1000));
  if (diffSec < 60) return 'Inactivo · hace unos segundos';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `Inactivo · hace ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Inactivo · hace ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `Inactivo · hace ${diffDays} d`;
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 5) return `Inactivo · hace ${diffWeeks} sem`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `Inactivo · hace ${diffMonths} m`;
  return 'Inactivo · hace más de 1 año';
}

export function friendLevelTier(level: number) {
  if (level >= 30) return 'gold';
  if (level >= 20) return 'purple';
  if (level >= 10) return 'red';
  if (level >= 5) return 'bronze';
  return 'gray';
}
