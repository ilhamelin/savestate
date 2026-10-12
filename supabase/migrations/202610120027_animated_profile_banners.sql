begin;

update storage.buckets
set file_size_limit = 8388608,
    allowed_mime_types = array['image/webp','image/gif','image/png','image/apng','image/avif','image/jpeg','video/webm','video/mp4']
where id = 'profiles';

drop policy if exists profile_media_add on storage.objects;
drop policy if exists profile_media_edit on storage.objects;
drop policy if exists profile_media_remove on storage.objects;

create policy profile_media_add on storage.objects
for insert to authenticated with check (
  bucket_id = 'profiles' and name in (
    auth.uid()::text || '/avatar.webp', auth.uid()::text || '/wallpaper.webp',
    auth.uid()::text || '/banner.webp', auth.uid()::text || '/banner.gif',
    auth.uid()::text || '/banner.png', auth.uid()::text || '/banner.apng',
    auth.uid()::text || '/banner.avif', auth.uid()::text || '/banner.jpg',
    auth.uid()::text || '/banner.webm', auth.uid()::text || '/banner.mp4'
  )
);

create policy profile_media_edit on storage.objects
for update to authenticated using (
  bucket_id = 'profiles' and name in (
    auth.uid()::text || '/avatar.webp', auth.uid()::text || '/wallpaper.webp',
    auth.uid()::text || '/banner.webp', auth.uid()::text || '/banner.gif',
    auth.uid()::text || '/banner.png', auth.uid()::text || '/banner.apng',
    auth.uid()::text || '/banner.avif', auth.uid()::text || '/banner.jpg',
    auth.uid()::text || '/banner.webm', auth.uid()::text || '/banner.mp4'
  )
) with check (
  bucket_id = 'profiles' and name in (
    auth.uid()::text || '/avatar.webp', auth.uid()::text || '/wallpaper.webp',
    auth.uid()::text || '/banner.webp', auth.uid()::text || '/banner.gif',
    auth.uid()::text || '/banner.png', auth.uid()::text || '/banner.apng',
    auth.uid()::text || '/banner.avif', auth.uid()::text || '/banner.jpg',
    auth.uid()::text || '/banner.webm', auth.uid()::text || '/banner.mp4'
  )
);

create policy profile_media_remove on storage.objects
for delete to authenticated using (
  bucket_id = 'profiles' and name in (
    auth.uid()::text || '/avatar.webp', auth.uid()::text || '/wallpaper.webp',
    auth.uid()::text || '/banner.webp', auth.uid()::text || '/banner.gif',
    auth.uid()::text || '/banner.png', auth.uid()::text || '/banner.apng',
    auth.uid()::text || '/banner.avif', auth.uid()::text || '/banner.jpg',
    auth.uid()::text || '/banner.webm', auth.uid()::text || '/banner.mp4'
  )
);

commit;
