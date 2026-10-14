begin;
alter table public.user_screen_entries
  add column if not exists followed boolean not null default false;
grant insert (followed), update (followed) on public.user_screen_entries to authenticated;
create index if not exists user_screen_entries_followed_idx
  on public.user_screen_entries (user_id, updated_at desc) where followed;
commit;
