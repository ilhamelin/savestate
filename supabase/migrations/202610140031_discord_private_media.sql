begin;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('discord-private-media', 'discord-private-media', false, 5242880,
  array['image/png','image/jpeg','image/webp','image/gif'])
on conflict (id) do update set public = false, file_size_limit = 5242880,
  allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists discord_private_media_owner on storage.objects;
create policy discord_private_media_owner on storage.objects
  for all to authenticated
  using (bucket_id = 'discord-private-media' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'discord-private-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists discord_private_media_guard on storage.objects;
create policy discord_private_media_guard on storage.objects as restrictive
  for all to public
  using (bucket_id <> 'discord-private-media' or (select auth.uid())::text = (storage.foldername(name))[1])
  with check (bucket_id <> 'discord-private-media' or (select auth.uid())::text = (storage.foldername(name))[1]);
commit;
