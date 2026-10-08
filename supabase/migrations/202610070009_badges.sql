begin;

create table public.badges (
  id text primary key,
  name text not null,
  description text not null,
  category text not null check (category in ('milestone', 'genre', 'community', 'special')),
  icon_pixel text not null,
  created_at timestamptz not null default now()
);
create table public.user_badges (
  user_id uuid not null references public.profiles(id) on delete cascade,
  badge_id text not null references public.badges(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);
alter table public.badges enable row level security;
alter table public.user_badges enable row level security;
create policy badges_read on public.badges for select using (true);
create policy user_badges_read on public.user_badges for select using (true);
revoke all on public.badges, public.user_badges from anon, authenticated;
grant select on public.badges, public.user_badges to anon, authenticated;
grant all on public.badges, public.user_badges to service_role;

insert into public.badges (id, name, description, category, icon_pixel) values
  ('first_checkpoint', 'Primer Guardado', 'Registra tu primer juego en la biblioteca.', 'milestone', 'save'),
  ('broadcaster', 'Transmisor', 'Comparte tu primer Momento Gamer.', 'community', 'broadcast'),
  ('coop_comrade', 'Compañero de Armas', 'Publica tu primera convocatoria de juego.', 'community', 'coop'),
  ('arcade_veteran', 'Voz del Arcade', 'Vota en al menos 5 duelos de juegos.', 'community', 'arcade'),
  ('retro_collector', 'Guardián de los 90s', 'Registra 5 juegos publicados antes del año 2000.', 'special', 'retro'),
  ('rpg_master', 'Maestro del Rol', 'Termina 3 RPG/JRPG en Cleared o Platinum.', 'genre', 'rpg'),
  ('completionist', '100% Platino', 'Marca 5 juegos con estado Platinum (100%).', 'milestone', 'platinum');

-- Preserve the badge identity in its recipient-only notification.
alter table public.notifications add column badge_id text
  references public.badges(id) on delete set null;

create function public.notify_badge_unlocked() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (user_id, actor_id, kind, badge_id)
  values (new.user_id, new.user_id, 'badge_unlocked', new.badge_id);
  return new;
end;
$$;
create trigger badge_unlocked_notify after insert on public.user_badges
  for each row execute function public.notify_badge_unlocked();
revoke all on function public.notify_badge_unlocked() from public, anon, authenticated;

-- Only trusted triggers and the self-scoped RPC can call this evaluator.
create function public.award_user_badges(p_user_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare library_count bigint; retro_count bigint; rpg_count bigint; platinum_count bigint;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('savestate.badges:' || p_user_id::text, 0)
  );
  select count(*),
    count(*) filter (where g.release_year < 2000),
    count(*) filter (
      where ug.status in ('cleared', 'platinum') and exists (
        select 1 from unnest(g.genres) genre
        where lower(genre) ~ '(rpg|role[- ]playing)'
      )
    ),
    count(*) filter (where ug.status = 'platinum')
  into library_count, retro_count, rpg_count, platinum_count
  from public.user_games ug join public.games g on g.id = ug.game_id
  where ug.user_id = p_user_id;

  insert into public.user_badges (user_id, badge_id)
  select p_user_id, candidate.id from (values
    ('first_checkpoint', library_count >= 1),
    ('retro_collector', retro_count >= 5),
    ('rpg_master', rpg_count >= 3),
    ('completionist', platinum_count >= 5),
    ('broadcaster', exists (select 1 from public.posts where user_id = p_user_id)),
    ('coop_comrade', exists (select 1 from public.party_requests where user_id = p_user_id)),
    ('arcade_veteran', (select count(*) from public.duel_votes where user_id = p_user_id) >= 5)
  ) as candidate(id, eligible)
  where candidate.eligible
  on conflict (user_id, badge_id) do nothing;
end;
$$;
revoke all on function public.award_user_badges(uuid) from public, anon, authenticated;

create function public.check_user_badges(p_user_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or p_user_id is distinct from auth.uid() then
    raise exception 'Only your own badges can be evaluated' using errcode = '42501';
  end if;
  perform public.award_user_badges(p_user_id);
end;
$$;
revoke all on function public.check_user_badges(uuid) from public, anon, authenticated;
grant execute on function public.check_user_badges(uuid) to authenticated;

create function public.track_user_badges() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.award_user_badges(new.user_id);
  return new;
end;
$$;
revoke all on function public.track_user_badges() from public, anon, authenticated;
create trigger library_badges after insert or update of status, game_id on public.user_games
  for each row execute function public.track_user_badges();
create trigger posts_badges after insert on public.posts
  for each row execute function public.track_user_badges();
create trigger parties_badges after insert on public.party_requests
  for each row execute function public.track_user_badges();
create trigger votes_badges after insert on public.duel_votes
  for each row execute function public.track_user_badges();

-- Upgrade existing players; badges are permanent and notification inserts idempotent.
do $$
declare player record;
begin
  for player in select id from public.profiles loop
    perform public.award_user_badges(player.id);
  end loop;
end;
$$;

commit;
