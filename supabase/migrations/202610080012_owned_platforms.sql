begin;

alter table public.profiles
  add column if not exists owned_platforms text[] not null default '{}';

grant update (owned_platforms) on public.profiles to authenticated;

commit;
