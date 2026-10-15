# Auditoría Técnica y Plan de Optimización / Rework de Base de Datos — Savestate

## 1. Resumen Ejecutivo

Se realizó una auditoría integral sobre la infraestructura de base de datos PostgreSQL (Supabase) del proyecto Savestate, analizando el esquema relacional, los índices existentes, las políticas de seguridad a nivel de fila (Row Level Security - RLS), los triggers, las funciones almacenadas (RPCs) y la organización de las migraciones mostradas en el SQL Editor de Supabase Studio.

### Estado Inicial del Esquema:
- **36 tablas relacionales** en el esquema `public`.
- **28 funciones y procedimientos** almacenados con políticas `SECURITY DEFINER` y `SECURITY INVOKER`.
- **29 índices preexistentes**.
- **33 migraciones históricas** acumuladas de forma incremental.

El sistema demostró una base sólida de integridad (uso extensivo de tipos `UUID`, claves foráneas con `ON DELETE CASCADE`, validaciones `CHECK` estrictas para JSONB y cadenas, y funciones `SECURITY DEFINER` con `set search_path = ''`). Sin embargo, se identificaron **cuellos de botella de rendimiento en RLS**, **claves foráneas sin indexar** que impactan eliminaciones en cascada y consultas de unión, y una dispersión de scripts en el SQL Editor de Supabase.

---

## 2. Diagnóstico y Hallazgos Críticos

### 2.1. Vulnerabilidad de Rendimiento en RLS (Evaluación de `auth.uid()` por fila)
- **Problema detectado**: En 36 políticas RLS creadas en migraciones tempranas, la condición de autorización evaluaba directamente `user_id = auth.uid()`.
- **Impacto técnico**: En PostgreSQL / Supabase, llamar a una función en la cláusula `USING` de RLS sin envolverla provoca que el motor evalúe la función `auth.uid()` una vez por cada fila escaneada por el planificador. En consultas con miles de registros (como `notifications`, `user_screen_entries`, `user_games` o `friend_messages`), esto añade una sobrecarga de CPU innecesaria.
- **Solución implementada**: Envolver la llamada como subconsulta escalar: `user_id = (select auth.uid())`. Esto permite al optimizador de consultas de Postgres tratar la expresión como un **InitPlan**, calculando el ID del usuario autenticado **una sola vez por consulta**.

### 2.2. Claves Foráneas Desindexadas (Sequential Scans en Cascadas y Joins)
- **Problema detectado**: PostgreSQL **no crea índices automáticamente** sobre las columnas con restricciones `REFERENCES`.
- **Impacto técnico**:
  - Al eliminar un registro padre (por ejemplo, un perfil de usuario o un juego), las restricciones `ON DELETE CASCADE` obligan a PostgreSQL a realizar un barrido secuencial (*sequential scan*) completo sobre cada tabla hija sin indexar.
  - Consultas frecuentes como listar los seguidores de un usuario (`follows WHERE followed_id = $1`), los comentarios de una reseña (`review_comments WHERE review_id = $1`) o las reacciones de un usuario requerían escaneos lineales.
- **Solución implementada**: Creación de índices B-tree sobre todas las claves foráneas huérfanas mediante `CREATE INDEX IF NOT EXISTS`.

### 2.3. Ausencia de Índice Parcial en Notificaciones No Leídas
- **Problema detectado**: La consulta para el badge de notificaciones (`WHERE user_id = $1 AND read_at IS NULL`) se ejecuta con cada navegación del usuario.
- **Impacto técnico**: A medida que el historial de notificaciones leídas de un usuario crece, el índice general `(user_id, created_at desc)` obliga a leer páginas de datos con notificaciones antiguas descartadas por filtro.
- **Solución implementada**: Índice parcial especializado:
  ```sql
  create index if not exists idx_notifications_unread
    on public.notifications(user_id, created_at desc)
    where read_at is null;
  ```

### 2.4. Integridad de Progresión de Logros en `play_logs`
- **Problema detectado**: En el historial de Supabase capturado, la migración `202610090019_steam_achievements_progress.sql` (que añade `'achievements'` a `play_logs_console_progress_check`) no aparecía con su nombre asignado en el panel lateral de snippets.
- **Solución implementada**: La nueva migración refuerza de manera idempotente la restricción para aceptar `'gamerscore'`, `'trophies'` y `'achievements'`.

### 2.5. Auditoría de Snippets en Supabase Studio
Al contrastar las capturas del usuario con el repositorio local:
1. Existen snippets no nombrados (`Untitled query`) entre las migraciones 08 y 09, y entre 14 y 15.
2. Inconsistencia de prefijos con ceros a la izquierda (`011_forum_boards`, `012_owned_platforms` frente a `10_steam_import` y `13_profile_wallpapers`).
3. Salto en la numeración: del script `23_itch_monitor` salta a `25_custom_themes_and_seasonal_rooms` (el número `24` no existe en la secuencia).

---

## 3. Fase 1: Optimización Inmediata Implementada (Sin Romper Nada)

Se generó la migración oficial **`202610150034_database_audit_and_optimizations.sql`**, 100% retrocompatible y segura para producción.

### Contenido de la Optimización:
1. **Índices de Alto Rendimiento Agregados**:
   - `idx_follows_followed` en `follows(followed_id)`.
   - `idx_friendships_sender` en `friendships(sender_id, status)`.
   - `idx_friend_messages_sender` y `idx_friend_messages_receiver` en `friend_messages`.
   - `idx_notifications_actor`, `idx_notifications_thread`, `idx_notifications_badge`, `idx_notifications_itch`.
   - `idx_notifications_unread` (índice parcial).
   - `idx_review_comments_review` en `review_comments(review_id, created_at)`.
   - `idx_review_comments_user` y `idx_review_reactions_user`.
   - `idx_list_items_game` en `list_items(game_id)`.
   - `idx_activity_target_game` en `activity_logs(target_game_id)`.
   - `idx_post_reactions_user` y `idx_post_comments_user`.
   - `idx_forum_replies_user` en `forum_replies(user_id, created_at desc)`.
   - `idx_forum_reactions_user` en `forum_reactions(user_id)`.
   - `idx_user_badges_badge` en `user_badges(badge_id)`.
   - `idx_duel_votes_user` y `idx_duel_votes_chosen_game`.
   - `idx_party_requests_game` en `party_requests(game_id)`.
   - `idx_user_xp_events_user_recent` en `user_xp_events(user_id, created_at desc)`.
   - `idx_user_screen_entries_tmdb` en `user_screen_entries(tmdb_id, media_type)`.
   - `idx_user_vault_media_status` en `user_vault_media(user_id, status)`.

2. **Optimización de Políticas RLS**:
   - Políticas actualizadas para evaluar `(select auth.uid())` en `notifications`, `profiles`, `user_games`, `user_screen_entries`, `friend_messages` y `global_chat_messages`.

---

## 4. Fase 2: Plan de Rework Estructural (Hoja de Ruta)

Para evolucionar la base de datos a largo plazo sin interrumpir el servicio ni requerir migraciones destructivas, se propone la siguiente arquitectura:

### 4.1. Consolidación Modular de Esquema (Squashing)
Actualmente existen 34 migraciones individuales. Se planifica consolidar el esquema en 6 dominios cohesivos para entornos locales o despliegues desde cero:
```text
supabase/migrations/
├── 01_core_schema.sql             (auth triggers, profiles, follows, friendships)
├── 02_catalog_and_library.sql     (games, user_games, play_logs, reviews, lists, activity)
├── 03_social_and_feed.sql         (posts, comments, reactions, friend_messages, global_chat)
├── 04_community_and_boards.sql    (forum_categories, threads, replies, badges, arcade)
├── 05_platform_integrations.sql   (steam_sync, console_imports, itch_tracker, discord_bridge)
└── 06_multimedia_and_vault.sql    (screen_journal, watchlist, user_vault_media)
```

### 4.2. Estandarización de Nomenclatura en Supabase Studio
- Eliminar los snippets temporales `Untitled query` del panel del SQL Editor.
- Normalizar los nombres de snippets con formato uniforme `01_` a `34_`.
- Guardar `202610150034_database_audit_and_optimizations.sql` como el snippet `34_database_audit_and_optimizations`.

### 4.3. Estrategia de Vistas Materializadas y Agregaciones Atómicas
- En foros y publicaciones (`forum_threads` y `posts`), los contadores `replies_count` y `views_count` se incrementan actualmente mediante triggers o llamadas directas.
- Para alto tráfico, se evaluará migrar a agregaciones en buffer con `pg_advisory_xact_lock` o tablas de resumen con refresco asíncrono para evitar bloqueos de fila (*row contention*).

---

## 5. Instrucciones de Aplicación y Verificación

1. **En Supabase SQL Editor**:
   - Abrir un nuevo editor SQL.
   - Copiar y ejecutar el contenido de `supabase/migrations/202610150034_database_audit_and_optimizations.sql`.
   - Guardar el snippet como `34_database_audit_and_optimizations`.
2. **En la Aplicación**:
   - Ejecutar la suite de pruebas unitarias y de integración (`npm run check`) para confirmar que ningún contrato de tipos ni lógica de negocio se ve afectado.
