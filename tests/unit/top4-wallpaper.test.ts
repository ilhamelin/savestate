import test from 'node:test';
import assert from 'node:assert/strict';
import { favoriteSlot, favoriteGame } from '../../src/domain/top4.ts';
import { isWallpaperPreset, WALLPAPERS, wallpaperForDisplay } from '../../src/domain/wallpaper.ts';
test('Top 4 rejects non-integer slots and invalid game ids, allows explicit clearing', () => {
  for (const slot of [1, 2, 3, 4]) assert.equal(favoriteSlot(slot), slot);
  for (const slot of [0, 5, 1.5, '1', null, undefined, NaN])
    assert.throws(() => favoriteSlot(slot));
  assert.equal(favoriteGame(null), null);
  assert.equal(
    favoriteGame('00000000-0000-0000-0000-000000000001'),
    '00000000-0000-0000-0000-000000000001',
  );
  for (const id of [undefined, '', 'invalid', 1]) assert.throws(() => favoriteGame(id));
});
test('Custom wallpaper only accepts the current owner storage path, including cache version', () => {
  const base = 'https://project.supabase.co';
  const path = `${base}/storage/v1/object/public/profiles/owner/wallpaper.webp?v=1`;
  assert.equal(wallpaperForDisplay(path, 'owner', base), path);
  for (const url of [
    path.replace('/owner/', '/other/'),
    path.replace('wallpaper', 'avatar'),
    'javascript:alert(1)',
    'https://external.test/image.webp',
    '/avatars/cyan.svg',
  ])
    assert.equal(wallpaperForDisplay(url, 'owner', base), null);
  assert.equal(wallpaperForDisplay(WALLPAPERS[0].url, 'owner', base), WALLPAPERS[0].url);
});
test('Wallpaper presets use an exact local allowlist', () => {
  for (const preset of WALLPAPERS) assert.equal(isWallpaperPreset(preset.url), true);
  for (const url of [
    '/wallpapers/other.svg',
    'javascript:alert(1)',
    'https://example.com/image.svg',
    '/wallpapers/deep_space.svg?x=1',
    null,
  ])
    assert.equal(isWallpaperPreset(url), false);
});
