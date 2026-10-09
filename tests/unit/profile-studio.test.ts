import test from 'node:test';
import assert from 'node:assert/strict';
import { profileChanged, profileDraft, QUICK_STATUSES } from '../../src/domain/profile-studio.ts';
import { text } from '../../src/domain/validation.ts';
test('estudio: detecta cambios de identidad, imágenes, privacidad y enlaces; normaliza enlaces vacíos', () => {
  const saved = profileDraft({
    username: 'player',
    avatar_url: null,
    banner_url: null,
    wallpaper_url: null,
    theme_color: 'cyan',
    room_theme: 'crt_terminal',
    terminal_status: '',
    library_private: false,
    social_links: {},
    owned_platforms: [],
  });
  assert.equal(profileChanged(saved, profileDraft(saved)), false);
  assert.equal(profileChanged({ ...saved, social_links: {} }, saved), false);
  for (const change of [
    { username: 'otro' },
    { psn_id: 'psn_player' },
    { xbox_gamertag: 'Xbox Player' },
    { avatar_url: 'blob:avatar' },
    { banner_url: 'blob:banner' },
    { wallpaper_url: '/wallpapers/deep_space.svg' },
    { theme_color: 'green' as const },
    { room_theme: 'retro_shelf' as const },
    { terminal_status: 'En pausa' },
    { library_private: true },
    { social_links: { github: 'https://github.com/player' } },
    { owned_platforms: ['PC / Steam'] },
  ])
    assert.equal(profileChanged({ ...saved, ...change }, saved), true);
  const draft = profileDraft(saved);
  draft.social_links.github = 'https://github.com/player';
  assert.equal(saved.social_links.github, '');
  draft.owned_platforms.push('PS2');
  assert.deepEqual(saved.owned_platforms, []);
  for (const status of QUICK_STATUSES) assert.equal(text(status, 'Estado', 160, 0), status);
});
