begin;

alter table public.profiles
  add column room_theme text not null default 'crt_terminal'
  check (room_theme in ('crt_terminal', 'handheld_console', 'retro_shelf'));
grant update (room_theme) on public.profiles to authenticated;

create table public.game_duels (
  id uuid primary key default gen_random_uuid(),
  game_a_id uuid not null references public.games(id) on delete cascade,
  game_b_id uuid not null references public.games(id) on delete cascade,
  title text not null default 'Duelo Comunitario' check (length(btrim(title)) between 1 and 120),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (game_a_id <> game_b_id)
);
create table public.duel_votes (
  duel_id uuid not null references public.game_duels(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  chosen_game_id uuid not null references public.games(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (duel_id, user_id)
);
create index game_duels_active on public.game_duels (created_at desc) where is_active;
create index duel_votes_totals on public.duel_votes (duel_id, chosen_game_id);

create function public.validate_duel_vote() returns trigger
language plpgsql security definer set search_path = '' as $$
declare duel public.game_duels;
begin
  select * into duel from public.game_duels where id = new.duel_id for share;
  if not found or not duel.is_active
     or new.chosen_game_id not in (duel.game_a_id, duel.game_b_id) then
    raise exception 'Invalid or inactive duel';
  end if;
  new.created_at := now();
  return new;
end;
$$;
create trigger validate_duel_vote before insert on public.duel_votes
  for each row execute function public.validate_duel_vote();
revoke all on function public.validate_duel_vote() from public, anon, authenticated;

alter table public.game_duels enable row level security;
alter table public.duel_votes enable row level security;
create policy duels_read on public.game_duels for select using (true);
create policy duel_votes_read on public.duel_votes for select using (true);
create policy duel_votes_cast on public.duel_votes for insert to authenticated
  with check (user_id = (select auth.uid()));
revoke all on public.game_duels, public.duel_votes from anon, authenticated;
grant select on public.game_duels, public.duel_votes to anon, authenticated;
grant insert (duel_id, user_id, chosen_game_id) on public.duel_votes to authenticated;

create function public.duel_results(p_duel_id uuid)
returns table(chosen_game_id uuid, total bigint)
language sql stable security invoker set search_path = '' as $$
  select v.chosen_game_id, count(*) from public.duel_votes v
  where v.duel_id = p_duel_id group by v.chosen_game_id;
$$;
revoke all on function public.duel_results(uuid) from public;
grant execute on function public.duel_results(uuid) to anon, authenticated;

create table public.party_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete cascade,
  platform text not null check (platform in ('PC', 'PlayStation', 'Xbox', 'Nintendo Switch', 'Retro/Emulador', 'Multiplataforma')),
  playstyle text not null check (playstyle in ('casual', 'competitive', 'coop_campaign', 'achievements')),
  schedule text not null check (length(btrim(schedule)) between 3 and 100),
  contact_note text not null check (length(btrim(contact_note)) between 3 and 500),
  expires_at timestamptz not null default (now() + interval '48 hours'),
  created_at timestamptz not null default now(),
  check (expires_at = created_at + interval '48 hours')
);
-- now() is not immutable: expiration belongs in queries/RLS, not an index predicate.
create index party_requests_recent on public.party_requests (created_at desc, id);
create index party_requests_filters on public.party_requests (platform, playstyle, expires_at);
create function public.set_party_expiration() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.created_at := now();
  new.expires_at := new.created_at + interval '48 hours';
  return new;
end;
$$;
create trigger set_party_expiration before insert on public.party_requests
  for each row execute function public.set_party_expiration();
revoke all on function public.set_party_expiration() from public, anon, authenticated;

alter table public.party_requests enable row level security;
create policy party_requests_read on public.party_requests for select using (expires_at > now());
create policy party_requests_create on public.party_requests for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy party_requests_delete on public.party_requests for delete to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.party_requests from anon, authenticated;
grant select, delete on public.party_requests to authenticated;
grant select on public.party_requests to anon;
grant insert (user_id, game_id, platform, playstyle, schedule, contact_note)
  on public.party_requests to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.duel_votes;
  end if;
end;
$$;

commit;
