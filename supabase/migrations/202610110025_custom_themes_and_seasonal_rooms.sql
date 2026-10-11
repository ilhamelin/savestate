-- Transactional and rerunnable. Existing presets remain valid.
begin;

alter table public.profiles drop constraint if exists profiles_theme_color_check;
alter table public.profiles add constraint profiles_theme_color_check check (
  theme_color in ('cyan', 'green', 'pink', 'amber', 'halloween', 'purple', 'christmas', 'ice')
  or theme_color ~ '^#[0-9a-fA-F]{6}$'
);

alter table public.profiles drop constraint if exists profiles_room_theme_check;
alter table public.profiles add constraint profiles_room_theme_check check (
  room_theme in (
    'crt_terminal', 'handheld_console', 'retro_shelf', 'arcade_cabinet',
    'cyber_deck', 'vaporwave_shrine', 'halloween_crypt', 'christmas_lodge'
  )
);

-- Promote validated compatibility backups, preserving every public social link.
-- Malformed metadata is ignored; no JSON casting or dynamic SQL is used.
with appearance_backups as (
  select id, regexp_match(
    social_links ->> '_savestate_appearance',
    '^v1:(cyan|green|pink|amber|halloween|purple|christmas|ice|#[0-9a-fA-F]{6}):(crt_terminal|handheld_console|retro_shelf|arcade_cabinet|cyber_deck|vaporwave_shrine|halloween_crypt|christmas_lodge)$'
  ) as appearance
  from public.profiles
  where social_links ? '_savestate_appearance'
)
update public.profiles as profile
set theme_color = backup.appearance[1],
    room_theme = backup.appearance[2],
    social_links = profile.social_links - '_savestate_appearance'
from appearance_backups as backup
where profile.id = backup.id and backup.appearance is not null;

commit;
