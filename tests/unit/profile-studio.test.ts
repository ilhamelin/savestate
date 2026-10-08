import test from 'node:test';
import assert from 'node:assert/strict';
import { profileChanged, profileDraft, QUICK_STATUSES } from '../../src/domain/profile-studio.ts';
import { text } from '../../src/domain/validation.ts';
test('estudio: detecta cambios de identidad, imágenes, privacidad y enlaces; normaliza enlaces vacíos', () => {
  const saved = profileDraft({
    username: 'player',
    avatar_url: null,
    banner_url: null,
    theme_color: 'cyan',
    terminal_status: '',
    library_private: false,
    social_links: {},
  });
  assert.equal(profileChanged(saved, profileDraft(saved)), false);
  assert.equal(profileChanged({ ...saved, social_links: {} }, saved), false);
  for (const change of [
    { username: 'otro' },
    { avatar_url: 'blob:avatar' },
    { banner_url: 'blob:banner' },
    { theme_color: 'green' as const },
    { terminal_status: 'En pausa' },
    { library_private: true },
    { social_links: { github: 'https://github.com/player' } },
  ])
    assert.equal(profileChanged({ ...saved, ...change }, saved), true);
  const draft = profileDraft(saved);
  draft.social_links.github = 'https://github.com/player';
  assert.equal(saved.social_links.github, '');
  for (const status of QUICK_STATUSES) assert.equal(text(status, 'Estado', 160, 0), status);
});
