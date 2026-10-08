-- Replace only the account-change SQLSTATE; preserve function logic and grants.
-- Safe to repeat, including after installing the corrected migration 014.
begin;

do $migration$
declare
  definition text;
  old_guard constant text := 'raise exception ''Steam account changed'' using errcode = ''40001'';';
  new_guard constant text := 'raise exception ''Steam account changed'' using errcode = ''P0001'';';
begin
  definition := pg_get_functiondef('public.apply_steam_sync(uuid,text,jsonb)'::regprocedure);
  if strpos(definition, old_guard) > 0 then
    execute replace(definition, old_guard, new_guard);
  elsif strpos(definition, new_guard) = 0 then
    raise exception 'Unexpected apply_steam_sync account guard; no changes applied';
  end if;
end;
$migration$;

commit;

select substring(
  pg_get_functiondef('public.apply_steam_sync(uuid,text,jsonb)'::regprocedure)
  from 'Steam account changed[^\n]+'
) as account_guard;
