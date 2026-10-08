begin;

create or replace function public.notify_post_interaction()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  recipient uuid;
begin
  select user_id into recipient from public.posts where id = new.post_id;
  if recipient is not null and recipient <> new.user_id then
    insert into public.notifications (user_id, actor_id, kind)
    values (recipient, new.user_id,
      case when tg_table_name = 'post_comments' then 'post_comment' else 'post_reaction' end);
  end if;
  return new;
end;
$$;

revoke all on function public.notify_post_interaction() from public, anon, authenticated;

drop trigger if exists post_comments_notify on public.post_comments;
create trigger post_comments_notify after insert on public.post_comments
  for each row execute function public.notify_post_interaction();

drop trigger if exists post_reactions_notify on public.post_reactions;
create trigger post_reactions_notify after insert on public.post_reactions
  for each row execute function public.notify_post_interaction();

-- RLS continues to restrict each subscription to the notification recipient.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;

commit;
