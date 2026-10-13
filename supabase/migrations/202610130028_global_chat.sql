begin;

create table if not exists public.global_chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text,
  media_url text,
  media_type text,
  created_at timestamptz not null default now(),
  constraint global_chat_content_check check (
    (content is not null and char_length(trim(content)) between 1 and 1000)
    or (content is null and media_url is not null)
  ),
  constraint global_chat_media_url_check check (
    media_url is null or (char_length(media_url) <= 2000 and
      (media_url ~ '^https://[^[:space:]]+$' or media_url ~ '^/storage/[^[:space:]]+$'))
  ),
  constraint global_chat_media_type_check check (media_type is null or media_type in ('image', 'gif')),
  constraint global_chat_media_pair_check check (
    (media_url is null and media_type is null) or (media_url is not null and media_type is not null)
  )
);
create index if not exists global_chat_messages_created_idx on public.global_chat_messages(created_at desc, id desc);
create index if not exists global_chat_messages_user_created_idx on public.global_chat_messages(user_id, created_at desc);
alter table public.global_chat_messages enable row level security;
revoke all on public.global_chat_messages from anon, authenticated;
grant select on public.global_chat_messages to anon, authenticated;
grant insert (user_id, content, media_url, media_type) on public.global_chat_messages to authenticated;
drop policy if exists global_chat_select on public.global_chat_messages;
create policy global_chat_select on public.global_chat_messages for select to anon, authenticated using (true);
drop policy if exists global_chat_insert on public.global_chat_messages;
create policy global_chat_insert on public.global_chat_messages for insert to authenticated with check (auth.uid() = user_id);

-- Atomic across serverless instances and direct Supabase clients, unlike an in-memory limit.
create or replace function public.guard_global_chat_rate() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('global-chat:' || new.user_id::text, 0));
  if exists (select 1 from public.global_chat_messages where user_id = new.user_id
    and created_at > pg_catalog.clock_timestamp() - interval '1.5 seconds') then
    raise exception 'global_chat_rate_limit' using errcode = 'P0001';
  end if;
  new.created_at := pg_catalog.clock_timestamp();
  return new;
end;
$$;
revoke all on function public.guard_global_chat_rate() from public, anon, authenticated;
drop trigger if exists global_chat_rate_guard on public.global_chat_messages;
create trigger global_chat_rate_guard before insert on public.global_chat_messages
for each row execute function public.guard_global_chat_rate();

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime'
    and schemaname = 'public' and tablename = 'global_chat_messages') then
    alter publication supabase_realtime add table public.global_chat_messages;
  end if;
end $$;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-media', 'chat-media', true, 5242880, array['image/png','image/jpeg','image/webp','image/gif'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit,
allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists chat_media_public_read on storage.objects;
create policy chat_media_public_read on storage.objects for select to anon, authenticated using (bucket_id = 'chat-media');
drop policy if exists chat_media_auth_insert on storage.objects;
create policy chat_media_auth_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'chat-media' and (storage.foldername(name))[1] = auth.uid()::text
  and array_length(storage.foldername(name), 1) = 1
);
commit;
