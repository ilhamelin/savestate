-- 202610150034_database_audit_and_optimizations.sql
-- Auditoría y Optimización de Base de Datos Savestate
-- 1. Creación de índices en claves foráneas no indexadas (acelera DELETE en cascada y JOINs).
-- 2. Índice parcial para conteo rápido de notificaciones no leídas.
-- 3. Optimización de políticas RLS: uso de (select auth.uid()) para evaluación InitPlan única por consulta.
-- 4. Garantía idempotente de restricción de logros de Steam en play_logs.

begin;

-- ============================================================================
-- 1. ÍNDICES DE CLAVES FORÁNEAS Y CONSULTAS FRECUENTES
-- CREATE INDEX normal puede bloquear escrituras mientras construye el índice.
-- Este script es transaccional: para tablas grandes, programar una ventana de
-- mantenimiento o construir los índices CONCURRENTLY por separado, sin BEGIN.
-- ============================================================================

-- Social y Amistades
create index if not exists idx_follows_followed on public.follows(followed_id);
create index if not exists idx_friendships_sender on public.friendships(sender_id, status);
create index if not exists idx_friend_messages_sender on public.friend_messages(sender_id);
create index if not exists idx_friend_messages_receiver on public.friend_messages(receiver_id);

-- Notificaciones
create index if not exists idx_notifications_actor on public.notifications(actor_id);
create index if not exists idx_notifications_thread on public.notifications(forum_thread_id) where forum_thread_id is not null;
create index if not exists idx_notifications_badge on public.notifications(badge_id) where badge_id is not null;
create index if not exists idx_notifications_itch on public.notifications(itch_tracker_id) where itch_tracker_id is not null;
-- Índice parcial crítico: aceleración del badge de campana en cada carga de página
create index if not exists idx_notifications_unread on public.notifications(user_id, created_at desc) where read_at is null;

-- Reseñas y Comentarios
create index if not exists idx_review_comments_review on public.review_comments(review_id, created_at);
create index if not exists idx_review_comments_user on public.review_comments(user_id);
create index if not exists idx_review_reactions_user on public.review_reactions(user_id);
create index if not exists idx_reports_review on public.reports(review_id);

-- Listas y Actividad
create index if not exists idx_list_items_game on public.list_items(game_id);
create index if not exists idx_activity_target_game on public.activity_logs(target_game_id);

-- Momentos / Highlights
create index if not exists idx_post_reactions_user on public.post_reactions(user_id);
create index if not exists idx_post_comments_user on public.post_comments(user_id);

-- Foro
create index if not exists idx_forum_replies_user on public.forum_replies(user_id, created_at desc);
create index if not exists idx_forum_reactions_user on public.forum_reactions(user_id);

-- Arcade y Gamificación
create index if not exists idx_user_badges_badge on public.user_badges(badge_id);
create index if not exists idx_duel_votes_user on public.duel_votes(user_id);
create index if not exists idx_duel_votes_chosen_game on public.duel_votes(chosen_game_id);
create index if not exists idx_party_requests_game on public.party_requests(game_id);
create index if not exists idx_party_requests_user on public.party_requests(user_id);
create index if not exists idx_user_xp_events_user_recent on public.user_xp_events(user_id, created_at desc);

-- Media y Vault
create index if not exists idx_user_screen_entries_tmdb on public.user_screen_entries(tmdb_id, media_type);
create index if not exists idx_user_vault_media_status on public.user_vault_media(user_id, status);

-- ============================================================================
-- 2. ASEGURAR INTEGRIDAD DE PROGRESO DE LOGROS EN PLAY_LOGS
-- ============================================================================

alter table public.play_logs drop constraint if exists play_logs_console_progress_check;
alter table public.play_logs add constraint play_logs_console_progress_check check (
  console_progress is null or case when (
    jsonb_typeof(console_progress) = 'object'
    and console_progress ?& array['kind','current','total']
    and jsonb_typeof(console_progress->'kind') = 'string'
    and console_progress->>'kind' in ('gamerscore','trophies','achievements')
    and jsonb_typeof(console_progress->'current') = 'number'
    and jsonb_typeof(console_progress->'total') = 'number'
  ) then (
    (console_progress->>'current')::numeric between 0 and 10000000
    and (console_progress->>'total')::numeric between 1 and 10000000
    and trunc((console_progress->>'current')::numeric) = (console_progress->>'current')::numeric
    and trunc((console_progress->>'total')::numeric) = (console_progress->>'total')::numeric
  ) else false end
);

-- ============================================================================
-- 3. OPTIMIZACIÓN RLS (INITPLAN VIA SELECT AUTH.UID())
-- ============================================================================

-- Notificaciones
drop policy if exists notifications_read on public.notifications;
create policy notifications_read on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists notifications_mark on public.notifications;
create policy notifications_mark on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Perfiles
drop policy if exists profiles_edit on public.profiles;
create policy profiles_edit on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Biblioteca
drop policy if exists library_add on public.user_games;
create policy library_add on public.user_games for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists library_edit on public.user_games;
create policy library_edit on public.user_games for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists library_remove on public.user_games;
create policy library_remove on public.user_games for delete to authenticated
  using (user_id = (select auth.uid()));

-- Screen Journal
drop policy if exists screen_owner_select on public.user_screen_entries;
create policy screen_owner_select on public.user_screen_entries for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists screen_owner_insert on public.user_screen_entries;
create policy screen_owner_insert on public.user_screen_entries for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists screen_owner_update on public.user_screen_entries;
create policy screen_owner_update on public.user_screen_entries for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists screen_owner_delete on public.user_screen_entries;
create policy screen_owner_delete on public.user_screen_entries for delete to authenticated
  using (user_id = (select auth.uid()));

-- Mensajería Directa
drop policy if exists friend_messages_select on public.friend_messages;
create policy friend_messages_select on public.friend_messages for select to authenticated
  using (sender_id = (select auth.uid()) or receiver_id = (select auth.uid()));

drop policy if exists friend_messages_insert on public.friend_messages;
create policy friend_messages_insert on public.friend_messages for insert to authenticated
  with check (sender_id = (select auth.uid()) and exists (
    select 1 from public.friendships f where f.status = 'accepted' and
    ((f.sender_id = (select auth.uid()) and f.receiver_id = friend_messages.receiver_id)
      or (f.receiver_id = (select auth.uid()) and f.sender_id = friend_messages.receiver_id))
  ));

-- Global Chat
drop policy if exists global_chat_insert on public.global_chat_messages;
create policy global_chat_insert on public.global_chat_messages for insert to authenticated
  with check (user_id = (select auth.uid()));

commit;
