import type { Profile, Game, UserGame, PlayLog, Review, Friendship, Follow, Activity, UserList, ListItem, ReviewReaction, ReviewComment } from '@/domain/model';
type Table<T> = { Row: T; Insert: Partial<T>; Update: Partial<T>; Relationships: [] };
export type Database = {
  public: {
    Tables: {
      profiles: Table<Profile>; games: Table<Game>; user_games: Table<UserGame>; play_logs: Table<PlayLog>;
      reviews: Table<Review>; friendships: Table<Friendship>; follows: Table<Follow>; activity_logs: Table<Activity>;
      user_lists: Table<UserList>; list_items: Table<ListItem>; review_reactions: Table<ReviewReaction>; review_comments: Table<ReviewComment>;
      game_suggestions: Table<{ id: string; user_id: string; title: string; details: string; created_at: string }>;
      reports: Table<{ id: string; user_id: string; review_id: string; reason: string; created_at: string }>;
    };
    Views: Record<string, never>;
    Functions: {
      save_review: { Args: { p_game_id: string; p_rating: number; p_content: string; p_markdown: string; p_has_spoilers: boolean }; Returns: string };
      set_favorites: { Args: { p_game_ids: string[] }; Returns: undefined };
      community_rating: { Args: { p_game_id: string }; Returns: { average: number | null; total: number }[] };
    };
    Enums: Record<string, never>; CompositeTypes: Record<string, never>;
  };
};
