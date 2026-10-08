begin;

-- Requiere la migración 004 y el bucket highlights existentes.
do $$
begin
  if not exists (select 1 from storage.buckets where id = 'highlights') then
    raise exception 'Falta el bucket highlights de la migración 004';
  end if;
end;
$$;

create or replace function public.track_post_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not new.is_private and new.game_id is not null then
    insert into public.activity_logs
      (user_id, target_game_id, event_type, event_data)
    values (
      new.user_id, new.game_id, 'moment_shared',
      jsonb_build_object(
        'post_id', new.id, 'title', new.title, 'category', new.category
      )
    );
  end if;
  return new;
end;
$$;

-- Se suma a activity_read: también protege momentos que pasan a privados
-- después de publicarse y oculta actividad cuyo post ya fue eliminado.
create policy activity_moment_visibility on public.activity_logs
as restrictive for select to anon, authenticated
using (
  event_type <> 'moment_shared'
  or exists (
    select 1 from public.posts p
    where p.id::text = (activity_logs.event_data ->> 'post_id')
      and p.user_id = activity_logs.user_id
  )
);

update storage.buckets
set public = false,
    file_size_limit = 1048576,
    allowed_mime_types = array['image/webp']
where id = 'highlights';

drop policy highlights_read on storage.objects;
create policy highlights_read on storage.objects
for select to anon, authenticated
using (
  bucket_id = 'highlights'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1 from public.posts p
      where p.user_id::text = (storage.foldername(storage.objects.name))[1]
        and storage.objects.name = any(p.image_urls)
    )
  )
);

-- posts se consulta bajo su propia RLS: solo el autor puede leer un post
-- is_private; los demás requieren can_view_post y visibilidad de biblioteca.
-- image_urls guardará rutas del bucket, nunca URLs públicas o firmadas:
-- <user_id>/<post_id>/<archivo>.webp. La aplicación firmará por 300 segundos.
-- highlights_add y highlights_remove de la 004 siguen limitados al autor.

commit;
