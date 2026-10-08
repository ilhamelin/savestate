export const GAME_STATUSES = [
  'playing',
  'backlog',
  'cleared',
  'platinum',
  'dropped',
  'wishlist',
] as const;
export type GameStatus = (typeof GAME_STATUSES)[number];
export const STATUS_LABELS: Record<GameStatus, string> = {
  playing: 'Playing',
  backlog: 'Backlog',
  cleared: 'Cleared',
  platinum: '100% / Platinum',
  dropped: 'Dropped',
  wishlist: 'Wishlist',
};
export const REACTIONS = ['critical_hit', 'gg', 'game_over'] as const;
export type Reaction = (typeof REACTIONS)[number];
export type Theme = 'cyan' | 'green' | 'pink' | 'amber';
export interface Profile {
  steam_id: string | null;
  steam_sync_count: number;
  steam_last_sync_at: string | null;
  owned_platforms: string[];
  room_theme: import('./arcade.ts').RoomTheme;
  username_normalized: string;
  id: string;
  username: string;
  avatar_url: string | null;
  banner_url: string | null;
  wallpaper_url: string | null;
  theme_color: Theme;
  terminal_status: string;
  social_links: Record<string, string>;
  library_private: boolean;
  created_at: string;
}
export interface Game {
  id: string;
  igdb_id: number;
  title: string;
  slug: string;
  cover_url: string | null;
  release_year: number | null;
  platforms: string[];
  genres: string[];
  developer: string | null;
  publisher: string | null;
  series: string | null;
  synopsis: string | null;
  cached_at: string;
}
export interface UserGame {
  id: string;
  user_id: string;
  game_id: string;
  status: GameStatus;
  rating: number | null;
  favorite_position: number | null;
  updated_at: string;
}
export interface PlayLog {
  id: string;
  user_game_id: string;
  platform_played: string;
  play_method: 'hardware' | 'emulator' | 'other';
  difficulty: string;
  hours_played: number;
  start_date: string | null;
  finish_date: string | null;
  note: string;
  created_at: string;
}
export interface Review {
  id: string;
  user_game_id: string;
  content: string;
  content_markdown: string;
  has_spoilers: boolean;
  created_at: string;
  updated_at: string;
}
export interface Friendship {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
}
export interface Follow {
  follower_id: string;
  followed_id: string;
  created_at: string;
}
export interface Activity {
  id: string;
  user_id: string;
  target_game_id: string;
  event_type: string;
  event_data: Record<string, unknown>;
  created_at: string;
}
export interface UserList {
  id: string;
  user_id: string;
  title: string;
  description: string;
  is_private: boolean;
  created_at: string;
}
export interface ListItem {
  id: string;
  list_id: string;
  game_id: string;
  position_index: number;
  note: string;
}
export interface ReviewReaction {
  review_id: string;
  user_id: string;
  reaction_type: Reaction;
}
export interface ReviewComment {
  id: string;
  review_id: string;
  user_id: string;
  content: string;
  created_at: string;
}
