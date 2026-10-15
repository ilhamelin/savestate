-- Memory Card: metadata is private; R2 links are public when shared.
create table if not exists public.user_vault_media (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  r2_key text not null unique,
  file_name text not null check (length(file_name) between 1 and 200),
  file_size bigint not null check (file_size between 1 and 104857600),
  mime_type text not null check (mime_type in ('image/png','image/jpeg','image/webp','image/gif','video/mp4','video/webm')),
  status text not null default 'pending' check (status in ('pending','ready')),
  created_at timestamptz not null default now(),
  check (split_part(r2_key, '/', 1) = user_id::text)
);
-- Upgrade the earlier metadata-only table without replacing existing records.
-- Existing files were already published; only new uploads begin as pending.
alter table public.user_vault_media add column if not exists status text not null default 'ready'
  check (status in ('pending','ready'));
alter table public.user_vault_media alter column status set default 'pending';
-- Legacy installations required a client-supplied URL. URLs are now derived
-- exclusively from the configured R2 origin and the server-owned object key.
alter table public.user_vault_media add column if not exists public_url text;
alter table public.user_vault_media alter column public_url drop not null;
create index if not exists user_vault_media_owner on public.user_vault_media(user_id, created_at desc);
alter table public.user_vault_media enable row level security;
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'user_vault_media'
  loop execute format('drop policy %I on public.user_vault_media', p.policyname); end loop;
end;
$$;
create policy vault_owner_read on public.user_vault_media for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.user_vault_media from anon, authenticated;
grant select on public.user_vault_media to authenticated;
grant all on public.user_vault_media to service_role;

create or replace function public.get_user_vault_storage(p_user_id uuid default auth.uid())
returns table(used_bytes bigint, reserved_bytes bigint, quota_bytes bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_user_id is null or (auth.role() <> 'service_role' and auth.uid() is distinct from p_user_id) then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;
  return query select
    coalesce(sum(v.file_size) filter (where v.status = 'ready'), 0)::bigint,
    coalesce(sum(v.file_size) filter (where v.status = 'pending'), 0)::bigint,
    104857600::bigint
  from public.user_vault_media v where v.user_id = p_user_id;
end;
$$;
revoke all on function public.get_user_vault_storage(uuid) from public, anon;
grant execute on function public.get_user_vault_storage(uuid) to authenticated, service_role;

-- Only the authenticated server flow may reserve or confirm uploads.
create or replace function public.reserve_vault_upload(p_user_id uuid, p_key text, p_name text, p_size bigint, p_mime text)
returns public.user_vault_media
language plpgsql security definer set search_path = '' as $$
declare used bigint; result public.user_vault_media;
begin
  perform 1 from public.profiles where id = p_user_id for update;
  if not found then raise exception 'Profile not found'; end if;
  select coalesce(sum(file_size), 0) into used from public.user_vault_media where user_id = p_user_id;
  if p_size <= 0 or p_size > 104857600 or used + p_size > 104857600 then
    raise exception 'VAULT_QUOTA_EXCEEDED' using errcode = 'P0001';
  end if;
  if (select count(*) from public.user_vault_media where user_id = p_user_id) >= 1000 then
    raise exception 'VAULT_ITEM_LIMIT' using errcode = 'P0001';
  end if;
  insert into public.user_vault_media(user_id, r2_key, file_name, file_size, mime_type)
    values (p_user_id, p_key, p_name, p_size, p_mime) returning * into result;
  return result;
end;
$$;
revoke all on function public.reserve_vault_upload(uuid,text,text,bigint,text) from public, anon, authenticated;
grant execute on function public.reserve_vault_upload(uuid,text,text,bigint,text) to service_role;
