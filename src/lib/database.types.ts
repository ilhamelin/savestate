import type {
  Profile,
  Game,
  UserGame,
  PlayLog,
  Review,
  Friendship,
  Follow,
  Activity,
  UserList,
  ListItem,
  ReviewReaction,
  ReviewComment,
} from '@/domain/model';
import type { Post, PostReaction, PostComment } from '@/domain/highlights';
import type { GameDuel, DuelVote, PartyRequest } from '@/domain/arcade';
import type { Badge, UserBadge } from '@/domain/badges';
import type { ForumCategory, ForumThread, ForumReply, ForumReaction } from '@/domain/forum';

type Row<T> = { [K in keyof T]: T[K] };
type Table<T, Relations = []> = {
  Row: Row<T>;
  Insert: Partial<Row<T>>;
  Update: Partial<Row<T>>;
  Relationships: Relations;
};
type ForeignKey<Name extends string, Column extends string, Target extends string> = {
  foreignKeyName: Name;
  columns: [Column];
  isOneToOne: false;
  referencedRelation: Target;
  referencedColumns: ['id'];
};
export type Database = {
  public: {
    Tables: {
      forum_categories: Table<ForumCategory>;
      forum_threads: Table<ForumThread>;
      forum_replies: Table<
        ForumReply,
        [ForeignKey<'forum_replies_thread_id_fkey', 'thread_id', 'forum_threads'>]
      >;
      forum_reactions: Table<ForumReaction>;
      badges: Table<Badge>;
      user_badges: Table<UserBadge>;
      game_duels: Table<GameDuel>;
      duel_votes: Table<DuelVote>;
      party_requests: Table<PartyRequest>;
      posts: Table<Post>;
      post_reactions: Table<PostReaction>;
      post_comments: Table<PostComment>;
      profiles: Table<Profile>;
      games: Table<Game>;
      user_games: Table<UserGame, [ForeignKey<'user_games_game_id_fkey', 'game_id', 'games'>]>;
      play_logs: Table<
        PlayLog,
        [ForeignKey<'play_logs_user_game_id_fkey', 'user_game_id', 'user_games'>]
      >;
      reviews: Table<Review>;
      friendships: Table<Friendship>;
      follows: Table<Follow>;
      activity_logs: Table<Activity>;
      user_lists: Table<UserList>;
      list_items: Table<
        ListItem,
        [
          ForeignKey<'list_items_list_id_fkey', 'list_id', 'user_lists'>,
          ForeignKey<'list_items_game_id_fkey', 'game_id', 'games'>,
        ]
      >;
      review_reactions: Table<ReviewReaction>;
      review_comments: Table<ReviewComment>;
      game_suggestions: Table<{
        id: string;
        user_id: string;
        title: string;
        details: string;
        created_at: string;
      }>;
      reports: Table<{
        id: string;
        user_id: string;
        review_id: string;
        reason: string;
        created_at: string;
      }>;
      notifications: Table<{
        forum_thread_id: string | null;
        badge_id: string | null;
        id: string;
        user_id: string;
        actor_id: string;
        kind: string;
        read_at: string | null;
        created_at: string;
      }>;
    };
    Views: Record<string, never>;
    Functions: {
      import_console_game: {
        Args: {
          p_game_id: string;
          p_status: string;
          p_platform: string;
          p_hours: number;
          p_source: string;
        };
        Returns: string;
      };
      claim_steam_sync_slot: {
        Args: Record<string, never>;
        Returns: { allowed: boolean; remaining_slots: number; message: string }[];
      };
      apply_steam_sync: {
        Args: {
          p_user_id: string;
          p_steam_id: string;
          p_games: { appid: number; minutes: number }[];
        };
        Returns: { updated_count: number; hours_added: number }[];
      };
      increment_thread_views: { Args: { p_thread_id: string }; Returns: undefined };
      forum_category_stats: {
        Args: Record<string, never>;
        Returns: {
          category_id: string;
          threads: number;
          messages: number;
          last_activity: string | null;
        }[];
      };
      import_steam_game: {
        Args: { p_game_id: string; p_status: string; p_minutes: number; p_appid: number };
        Returns: string;
      };
      check_user_badges: { Args: { p_user_id: string }; Returns: undefined };
      duel_results: {
        Args: { p_duel_id: string };
        Returns: { chosen_game_id: string; total: number }[];
      };
      can_view_library: { Args: { owner_id: string }; Returns: boolean };
      claim_igdb_request: { Args: Record<string, never>; Returns: boolean };
      community_ratings: {
        Args: { p_game_ids: string[] };
        Returns: { game_id: string; average: number | null; total: number }[];
      };
      game_statistics: {
        Args: { p_game_id: string };
        Returns: {
          average: number | null;
          total: number;
          distribution: Record<string, number>;
          average_hours: number | null;
        }[];
      };
      save_review: {
        Args: {
          p_game_id: string;
          p_rating: number;
          p_content: string;
          p_markdown: string;
          p_has_spoilers: boolean;
        };
        Returns: string;
      };
      set_favorites: { Args: { p_game_ids: string[] }; Returns: undefined };
      set_favorite_slot: {
        Args: { p_slot: number; p_game_id: string | null; p_status?: string };
        Returns: undefined;
      };
      community_rating: {
        Args: { p_game_id: string };
        Returns: { average: number | null; total: number }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
