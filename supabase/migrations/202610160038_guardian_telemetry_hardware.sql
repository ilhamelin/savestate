begin;

create or replace function public.guardian_telemetry()
returns jsonb language sql security definer set search_path = '' as $$
  select jsonb_build_object(
    'storage_bytes', (select coalesce(sum(file_size), 0) from public.user_vault_media),
    'users_total', (select count(*) from public.profiles),
    'users_recent', (select count(distinct user_id) from public.user_games where updated_at > now() - interval '15 minutes'),
    'db_connections_active', (select count(*) from pg_catalog.pg_stat_activity where datname = current_database()),
    'db_connections_max', (select setting::int from pg_catalog.pg_settings where name = 'max_connections'),
    'db_size_bytes', pg_catalog.pg_database_size(current_database()),
    'db_cache_hit_ratio', (
      select round(sum(blks_hit) * 100.0 / nullif(sum(blks_hit) + sum(blks_read), 0), 1)
      from pg_catalog.pg_stat_database where datname = current_database()
    )
  );
$$;

revoke all on function public.guardian_telemetry() from public, anon, authenticated;
grant execute on function public.guardian_telemetry() to service_role;

commit;
