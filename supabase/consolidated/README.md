# Esquema Consolidado de Base de Datos (Fase 2) — Savestate

Esta carpeta contiene el esquema de base de datos modularizado y consolidado por dominios de negocio. Integra todas las tablas, restricciones, funciones, triggers, políticas de seguridad RLS e índices optimizados acumulados a lo largo de las 34 migraciones del proyecto (incluyendo la optimización de auditoría `202610150034_database_audit_and_optimizations.sql`).

## 📁 Mapeo de Dominios

| Archivo                        | Dominio Funcional            | Tablas y Componentes Clave                                                                                                                                          |
| :----------------------------- | :--------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `01_core_schema.sql`           | **Identidad y Core Social**  | `profiles`, `follows`, `friendships`, disparadores de autenticación y funciones de amigos.                                                                          |
| `02_catalog_and_library.sql`   | **Catálogo y Biblioteca**    | `games`, `user_games`, `play_logs`, `reviews`, `review_reactions`, `review_comments`, `user_lists`, `list_items`, `activity_logs`.                                  |
| `03_social_and_feed.sql`       | **Feed y Mensajería**        | `posts`, `post_reactions`, `post_comments`, `notifications` (con índice parcial de no leídas), `friend_messages`, `global_chat_messages`.                           |
| `04_community_and_boards.sql`  | **Comunidad y Gamificación** | `forum_categories`, `forum_threads`, `forum_replies`, `forum_reactions`, `badges`, `user_badges`, `arcade_duels`, `duel_votes`, `party_requests`, `user_xp_events`. |
| `05_platform_integrations.sql` | **Integraciones Externas**   | `steam_sync_limits`, `steam_account_guards`, `itch_trackers`, `itch_monitor_state`, `discord_message_limits`, `discord_private_media_tokens`.                       |
| `06_multimedia_and_vault.sql`  | **Multimedia y Baúl**        | `user_screen_entries` (cine y series), `user_vault_media` (Cloudflare R2 / Memory Card).                                                                            |

---

## ⚠️ Guía de Uso: Producción vs Desarrollo Local

### 1. En Producción (Supabase Cloud)

- **NO DEBES volver a correr estos archivos en tu base de datos de producción existente.**
- Tu base de datos de producción ya tiene toda esta estructura activa gracias a las migraciones 0001 a 0034.
- La ejecución en caliente ya se completó de manera segura con el script `34_database_audit_and_optimizations`.

### 2. Para Nuevos Entornos o Desarrollo Local

Si en el futuro deseas inicializar una base de datos nueva o ejecutar `supabase db reset`, puedes aplicar estos 6 archivos en orden numérico correlativo (`01` al `06`).
