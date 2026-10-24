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
import type { XpEvent, XpAward } from '@/domain/progression';
import type { PlayerFriend } from '@/domain/player-friends';
import type { ItchTrackerRow, ItchMetadata } from '@/domain/itch-tracker';
import type { FriendMessage } from '@/domain/friend-chat';
import type { GlobalChatRow } from '@/domain/global-chat';
import type { ScreenEntryRow } from '@/domain/screen';
import type { VaultMedia, VaultStorage } from '@/domain/vault';

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
      support_tickets: Table<import('@/domain/support-ticket').SupportTicketRow>;
      support_telemetry: Table<{
        id: string;
        fingerprint: string;
        event: import('@/domain/support-ticket').TelemetryErrorEvent;
        created_at: string;
      }>;
      system_broadcasts: Table<
        import('@/domain/guardian-suite').SystemBroadcast & {
          active: boolean;
          created_by: string | null;
        }
      >;
      system_switches: Table<{
        key: string;
        value: boolean | string | number;
        updated_at: string;
        updated_by: string | null;
      }>;
      security_audit_logs: Table<{
        id: string;
        event: string;
        key_hash: string | null;
        metadata: Record<string, unknown>;
        created_at: string;
      }>;
      gatekeeper_attempts: Table<{ key_hash: string; window_start: string; attempts: number }>;
      user_vault_media: Table<VaultMedia>;
      user_screen_entries: Table<ScreenEntryRow>;
      global_chat_messages: Table<
        GlobalChatRow,
        [ForeignKey<'global_chat_messages_user_id_fkey', 'user_id', 'profiles'>]
      >;
      friend_messages: Table<FriendMessage>;
      itch_trackers: Table<ItchTrackerRow>;
      itch_monitor_state: Table<{
        id: boolean;
        lock_token: string | null;
        locked_until: string | null;
        last_run_at: string | null;
        last_success_at: string | null;
      }>;
      user_xp_events: Table<XpEvent>;
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
      user_lists: Table<UserList, [ForeignKey<'user_lists_user_id_fkey', 'user_id', 'profiles'>]>;
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
        itch_tracker_id: string | null;
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
      guardian_soc_snapshot: { Args: Record<string, never>; Returns: unknown };
      guardian_soc_telemetry: { Args: Record<string, never>; Returns: unknown };
      guardian_soc_fail: { Args: { p_ip: string; p_reason: string }; Returns: unknown };
      guardian_soc_defcon: {
        Args: { p_level: number; p_actor: string; p_reason: string };
        Returns: boolean;
      };
      guardian_soc_quarantine: {
        Args: { p_ip: string; p_action: string; p_reason: string; p_actor: string };
        Returns: boolean;
      };
      claim_support_attempt: { Args: { p_key_hash: string; p_kind: string }; Returns: boolean };
      claim_support_ticket: {
        Args: { p_id: string };
        Returns: import('@/domain/support-ticket').SupportTicketRow[];
      };
      record_support_telemetry: {
        Args: {
          p_event: import('@/domain/support-ticket').TelemetryErrorEvent;
          p_fingerprint: string;
        };
        Returns: string;
      };
      grant_player_xp: {
        Args: { p_target_id: string; p_amount: number };
        Returns: { new_xp: number; new_level: number }[];
      };
      guardian_broadcast: {
        Args: { p_message: string; p_category: string; p_active: boolean; p_actor: string };
        Returns: string | null;
      };
      guardian_set_switch: {
        Args: { p_key: string; p_value: boolean | string; p_actor: string };
        Returns: boolean;
      };
      guardian_telemetry: {
        Args: Record<string, never>;
        Returns: {
          storage_bytes: number;
          users_total: number;
          users_recent: number;
          db_connections_active?: number;
          db_connections_max?: number;
          db_size_bytes?: number;
          db_cache_hit_ratio?: number | null;
        };
      };
      guardian_operator_signal: {
        Args: { p_target_id: string; p_actor: string; p_event: string; p_message: string | null };
        Returns: boolean;
      };
      reset_player_account: { Args: { p_target_id: string }; Returns: boolean };
      acknowledge_player_gate: {
        Args: { p_target_id: string; p_locked_at: string };
        Returns: boolean;
      };
      claim_gatekeeper_attempt: { Args: { p_key_hash: string }; Returns: boolean };
      get_user_vault_storage: { Args: { p_user_id?: string }; Returns: VaultStorage[] };
      reserve_vault_upload: {
        Args: { p_user_id: string; p_key: string; p_name: string; p_size: number; p_mime: string };
        Returns: VaultMedia;
      };
      claim_itch_check: { Args: { p_id: string; p_user_id: string }; Returns: boolean };
      apply_itch_check: {
        Args: { p_id: string; p_user_id: string; p_metadata: ItchMetadata };
        Returns: boolean;
      };
      apply_itch_check_v2: {
        Args: { p_id: string; p_user_id: string; p_metadata: ItchMetadata };
        Returns: { updated: boolean; reason: 'installer' | 'release' | null };
      };
      acknowledge_itch_installer: {
        Args: { p_id: string; p_user_id: string; p_upload_ids: string[] };
        Returns: boolean;
      };
      claim_itch_monitor: { Args: Record<string, never>; Returns: string | null };
      finish_itch_monitor: { Args: { p_token: string; p_success: boolean }; Returns: undefined };
      claim_discord_message_slot: { Args: Record<string, never>; Returns: number };
      get_player_friends: { Args: { p_user_id: string }; Returns: PlayerFriend[] };
      award_xp: {
        Args: { p_user_id: string; p_amount: number; p_action: string; p_reference_id?: string };
        Returns: XpAward;
      };
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
