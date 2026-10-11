-- 025 is already reserved for seasonal profile themes.
begin;
create table public.friend_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(trim(content)) between 1 and 500),
  created_at timestamptz not null default now(),
  check (sender_id <> receiver_id)
);
create index friend_messages_pair_idx on public.friend_messages
  (least(sender_id, receiver_id), greatest(sender_id, receiver_id), created_at desc);
alter table public.friend_messages enable row level security;
revoke all on public.friend_messages from anon, authenticated;
grant select on public.friend_messages to authenticated;
grant insert (sender_id, receiver_id, content) on public.friend_messages to authenticated;
create policy friend_messages_select on public.friend_messages for select to authenticated
  using (auth.uid() = sender_id or auth.uid() = receiver_id);
create policy friend_messages_insert on public.friend_messages for insert to authenticated
  with check (auth.uid() = sender_id and exists (
    select 1 from public.friendships f where f.status = 'accepted' and
    ((f.sender_id = auth.uid() and f.receiver_id = friend_messages.receiver_id)
      or (f.receiver_id = auth.uid() and f.sender_id = friend_messages.receiver_id))
  ));

-- Private Broadcast topics may only be joined by the two accepted friends.
create or replace function public.can_join_friend_chat(p_topic text)
returns boolean language sql stable security invoker set search_path = '' as $$
  select exists (select 1 from public.friendships f where f.status = 'accepted'
    and auth.uid() in (f.sender_id, f.receiver_id)
    and p_topic = 'savestate:dm:' || least(f.sender_id, f.receiver_id)::text || ':' || greatest(f.sender_id, f.receiver_id)::text);
$$;
revoke all on function public.can_join_friend_chat(text) from public;
grant execute on function public.can_join_friend_chat(text) to authenticated;
create policy friend_chat_receive on realtime.messages for select to authenticated
  using (extension = 'broadcast' and public.can_join_friend_chat(realtime.topic()));
create policy friend_chat_send on realtime.messages for insert to authenticated
  with check (extension = 'broadcast' and public.can_join_friend_chat(realtime.topic()));
-- Guard DM topics even if another permissive broadcast policy exists.
create policy friend_chat_receive_guard on realtime.messages as restrictive for select to authenticated
  using (realtime.topic() not like 'savestate:dm:%' or public.can_join_friend_chat(realtime.topic()));
create policy friend_chat_send_guard on realtime.messages as restrictive for insert to authenticated
  with check (realtime.topic() not like 'savestate:dm:%' or public.can_join_friend_chat(realtime.topic()));
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'friend_messages') then
    alter publication supabase_realtime add table public.friend_messages;
  end if;
end $$;
commit;
