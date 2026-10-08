begin;

create table public.forum_categories (
  id text primary key, name text not null, description text not null,
  icon text not null default 'message-square', sort_order int not null default 0,
  created_at timestamptz not null default now()
);
insert into public.forum_categories (id,name,description,icon,sort_order) values
 ('retro-corner','La Taberna Retro','Debates, anécdotas y conservación de consolas de 8, 16 y 32 bits, arcades y joyas del pasado.','gamepad-2',1),
 ('general-gaming','Actualidad y Debate','Lanzamientos recientes, impresiones, noticias de la industria y debates generales.','flame',2),
 ('guides-secrets','Guías, Trucos y Secretos','Estrategias, resoluciones de atascos, speedruns y coleccionables compartidos.','map',3),
 ('indie-sanctuary','El Rincón Indie','Descubrimientos ocultos, desarrolladores independientes y obras de autor.','sparkles',4),
 ('off-topic','Zona de Descanso (Off-Topic)','Música chiptune, setups gamer, cine, anime y charlas libres entre jugadores.','coffee',5);

create table public.forum_threads (
 id uuid primary key default gen_random_uuid(),
 category_id text not null references public.forum_categories(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 game_id uuid references public.games(id) on delete set null,
 title text not null check (length(btrim(title)) between 3 and 150),
 content text not null check (length(btrim(content)) between 5 and 10000),
 is_pinned boolean not null default false, is_locked boolean not null default false,
 views_count int not null default 0 check (views_count >= 0),
 replies_count int not null default 0 check (replies_count >= 0),
 last_reply_at timestamptz not null default now(),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index idx_threads_category_feed on public.forum_threads(category_id,is_pinned desc,last_reply_at desc,id desc);
create index idx_threads_user on public.forum_threads(user_id,created_at desc);
create index idx_threads_game on public.forum_threads(game_id,last_reply_at desc) where game_id is not null;
create table public.forum_replies (
 id uuid primary key default gen_random_uuid(),
 thread_id uuid not null references public.forum_threads(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 reply_to_id uuid references public.forum_replies(id) on delete set null,
 content text not null check (length(btrim(content)) between 1 and 8000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index idx_replies_thread_order on public.forum_replies(thread_id,created_at,id);
create index idx_replies_quote on public.forum_replies(reply_to_id) where reply_to_id is not null;
create table public.forum_reactions (
 reply_id uuid not null references public.forum_replies(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 reaction_type text not null check (reaction_type in ('like','gg','mind_blown','game_over')),
 primary key(reply_id,user_id)
);
alter table public.notifications add column forum_thread_id uuid
 references public.forum_threads(id) on delete cascade;

-- Serialize replies with closing/moderating the parent thread. Validate quotes in SQL.
create function public.validate_forum_reply() returns trigger
language plpgsql security definer set search_path='' as $$
declare locked boolean;
begin
 select is_locked into locked from public.forum_threads where id=new.thread_id for update;
 if not found or locked then raise exception 'Thread closed or missing' using errcode='42501'; end if;
 if new.reply_to_id is not null and not exists (
   select 1 from public.forum_replies where id=new.reply_to_id and thread_id=new.thread_id
 ) then raise exception 'Quote must belong to this thread' using errcode='23514'; end if;
 return new;
end; $$;
create trigger forum_reply_validate before insert on public.forum_replies
 for each row execute function public.validate_forum_reply();

create function public.forum_touch_updated() returns trigger
language plpgsql set search_path='' as $$
begin new.updated_at=now(); return new; end; $$;
create trigger forum_thread_touch before update of title,content,game_id on public.forum_threads
 for each row execute function public.forum_touch_updated();
create trigger forum_reply_touch before update of content on public.forum_replies
 for each row execute function public.forum_touch_updated();

create function public.on_forum_reply_created() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 update public.forum_threads set replies_count=replies_count+1,
 last_reply_at=greatest(last_reply_at,new.created_at) where id=new.thread_id;
 return new;
end; $$;
create trigger trigger_forum_reply_stats after insert on public.forum_replies
 for each row execute function public.on_forum_reply_created();
create function public.on_forum_reply_deleted() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.forum_threads where id=old.thread_id for update;
 update public.forum_threads set replies_count=greatest(0,replies_count-1),
 last_reply_at=greatest(created_at,coalesce((select max(created_at) from public.forum_replies where thread_id=old.thread_id),created_at))
 where id=old.thread_id;
 return old;
end; $$;
create trigger forum_reply_deleted after delete on public.forum_replies
 for each row execute function public.on_forum_reply_deleted();

create function public.notify_forum_reply() returns trigger
language plpgsql security definer set search_path='' as $$
declare thread_author uuid; quoted_author uuid;
begin
 select user_id into thread_author from public.forum_threads where id=new.thread_id;
 if new.reply_to_id is not null then
   select user_id into quoted_author from public.forum_replies where id=new.reply_to_id and thread_id=new.thread_id;
   if quoted_author is not null and quoted_author<>new.user_id then
     insert into public.notifications(user_id,actor_id,kind,forum_thread_id)
     values(quoted_author,new.user_id,'forum_quote',new.thread_id);
   end if;
 end if;
 if thread_author<>new.user_id and thread_author is distinct from quoted_author then
   insert into public.notifications(user_id,actor_id,kind,forum_thread_id)
   values(thread_author,new.user_id,'forum_reply',new.thread_id);
 end if;
 return new;
end; $$;
create trigger trigger_forum_notifications after insert on public.forum_replies
 for each row execute function public.notify_forum_reply();

create function public.increment_thread_views(p_thread_id uuid) returns void
language sql security definer set search_path='' as $$
 update public.forum_threads set views_count=least(2147483647::bigint,views_count::bigint+1)::int where id=p_thread_id;
$$;
create function public.forum_category_stats() returns table(category_id text,threads bigint,messages bigint,last_activity timestamptz)
language sql stable security invoker set search_path='' as $$
 select category_id,count(*),coalesce(sum(replies_count+1),0)::bigint,max(last_reply_at)
 from public.forum_threads group by category_id;
$$;

alter table public.forum_categories enable row level security;
alter table public.forum_threads enable row level security;
alter table public.forum_replies enable row level security;
alter table public.forum_reactions enable row level security;
create policy forum_categories_read on public.forum_categories for select using(true);
create policy forum_threads_read on public.forum_threads for select using(true);
create policy forum_threads_create on public.forum_threads for insert to authenticated with check(user_id=auth.uid());
create policy forum_threads_update on public.forum_threads for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy forum_threads_delete on public.forum_threads for delete to authenticated using(user_id=auth.uid());
create policy forum_replies_read on public.forum_replies for select using(true);
create policy forum_replies_create on public.forum_replies for insert to authenticated with check(
 user_id=auth.uid() and exists(select 1 from public.forum_threads where id=thread_id and not is_locked));
create policy forum_replies_update on public.forum_replies for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy forum_replies_delete on public.forum_replies for delete to authenticated using(user_id=auth.uid());
create policy forum_reactions_read on public.forum_reactions for select using(true);
create policy forum_reactions_manage on public.forum_reactions for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());

-- Only content columns are writable. Moderation and counters belong to trusted SQL.
revoke all on public.forum_categories,public.forum_threads,public.forum_replies,public.forum_reactions from anon,authenticated;
grant select on public.forum_categories,public.forum_threads,public.forum_replies,public.forum_reactions to anon,authenticated;
grant insert(category_id,user_id,game_id,title,content),update(title,content,game_id),delete on public.forum_threads to authenticated;
grant insert(thread_id,user_id,reply_to_id,content),update(content),delete on public.forum_replies to authenticated;
grant insert(reply_id,user_id,reaction_type),update(reaction_type),delete on public.forum_reactions to authenticated;
grant all on public.forum_categories,public.forum_threads,public.forum_replies,public.forum_reactions to service_role;
revoke all on function public.validate_forum_reply(),public.forum_touch_updated(),public.on_forum_reply_created(),public.on_forum_reply_deleted(),public.notify_forum_reply(),public.increment_thread_views(uuid),public.forum_category_stats() from public,anon,authenticated;
grant execute on function public.increment_thread_views(uuid),public.forum_category_stats() to anon,authenticated,service_role;

do $$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='forum_replies') then
   alter publication supabase_realtime add table public.forum_replies;
 end if;
end; $$;
commit;
