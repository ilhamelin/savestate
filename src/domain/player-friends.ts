import type { Profile } from './model.ts';

export type FriendProfile = Pick<
  Profile,
  'id' | 'username' | 'avatar_url' | 'level' | 'terminal_status'
>;
export type PlayerFriend = FriendProfile & { current_game: string | null };
export interface FriendRequest {
  id: string;
  profile: FriendProfile;
}

export function friendLevelTier(level: number) {
  if (level >= 30) return 'gold';
  if (level >= 20) return 'purple';
  if (level >= 10) return 'red';
  if (level >= 5) return 'bronze';
  return 'gray';
}
