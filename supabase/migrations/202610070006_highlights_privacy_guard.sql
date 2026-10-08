begin;

-- Refuerzo repetible ante una aplicación parcial de la 005 o políticas
-- permisivas adicionales creadas desde el panel de Storage.
create or replace function public.track_post_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not new.is_private and new.game_id is not null then
    insert into public.activity_logs
      (user_id, target_game_id, event_type, event_data)
    values (new.user_id, new.game_id, 'moment_shared',
      jsonb_build_object('post_id', new.id, 'title', new.title, 'category', new.category));
  end if;
  return new;
end;
$$;

update storage.buckets set public = false,
  file_size_limit = 1048576, allowed_mime_types = array['image/webp']
where id = 'highlights';

drop policy if exists highlights_read on storage.objects;
create policy highlights_read on storage.objects for select to anon, authenticated
using (bucket_id = 'highlights' and (
  (storage.foldername(name))[1] = auth.uid()::text
  or exists (select 1 from public.posts p
    where p.user_id::text = (storage.foldername(storage.objects.name))[1]
      and storage.objects.name = any(p.image_urls))
));

drop policy if exists highlights_read_guard on storage.objects;
create policy highlights_read_guard on storage.objects
as restrictive for select to anon, authenticated
using (bucket_id <> 'highlights' or (
  (storage.foldername(name))[1] = auth.uid()::text
  or exists (select 1 from public.posts p
    where p.user_id::text = (storage.foldername(storage.objects.name))[1]
      and storage.objects.name = any(p.image_urls))
));

drop policy if exists activity_moment_visibility on public.activity_logs;
create policy activity_moment_visibility on public.activity_logs
as restrictive for select to anon, authenticated
using (event_type <> 'moment_shared' or exists (
  select 1 from public.posts p
  where p.id::text = (activity_logs.event_data ->> 'post_id')
    and p.user_id = activity_logs.user_id
));

-- Esta migración falla y revierte todo si no existe el bucket esperado.
do $$
begin
  if not exists (select 1 from storage.buckets where id = 'highlights' and not public) then
    raise exception 'No se pudo configurar el bucket highlights como privado';
  end if;
end;
$$;

commit;

select id, public from storage.buckets where id = 'highlights';
