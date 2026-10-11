import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  resolveThemeColor,
  themeColor,
  PROFILE_COLORS,
  GALLERY_AVATARS,
} from '../../src/domain/profile-studio.ts';
import { ROOM_THEMES, roomTheme } from '../../src/domain/arcade.ts';
import { WALLPAPERS, isWallpaperPreset } from '../../src/domain/wallpaper.ts';
import {
  legacyAppearance,
  restoreProfileAppearance,
  APPEARANCE_BACKUP_KEY,
} from '../../src/domain/profile-appearance.ts';

test('Profile colors resolve all presets and strict six-digit hex codes with a safe display fallback', () => {
  for (const [key, value] of Object.entries(PROFILE_COLORS)) {
    assert.equal(resolveThemeColor(key), value);
    assert.equal(themeColor(key), key);
  }
  assert.equal(resolveThemeColor('#7C3AED'), '#7c3aed');
  assert.equal(themeColor('#000000'), '#000000');
  for (const invalid of [
    null,
    'purple; color:red',
    '#abc',
    '#12345678',
    'url(evil)',
    '#zzzzzz',
    ' cyan ',
  ]) {
    assert.throws(() => themeColor(invalid));
    assert.equal(resolveThemeColor(String(invalid)), '#00f0ff');
  }
});
test('All seasonal rooms, gallery avatars and wallpapers refer to safe local assets', () => {
  for (const room of ROOM_THEMES) assert.equal(roomTheme(room), room);
  assert.throws(() => roomTheme('halloween_crypt; malicious'));
  assert.equal(GALLERY_AVATARS.length, 12);
  assert.equal(new Set(GALLERY_AVATARS.map((avatar) => avatar.url)).size, 12);
  for (const avatar of GALLERY_AVATARS) {
    const svg = readFileSync(`public${avatar.url}`, 'utf8');
    assert.match(svg, /viewBox="0 0 16 16"/);
    assert.match(svg, /shape-rendering="crispEdges"/);
    assert.doesNotMatch(svg, /<script|https?:\/\/(?!www.w3.org)/);
  }
  for (const preset of WALLPAPERS) {
    assert.equal(isWallpaperPreset(preset.url), true);
    assert.match(readFileSync(`public${preset.url}`, 'utf8'), /<svg/);
  }
});
test('Legacy appearance round-trips extended colors and rooms without leaking or losing social links', () => {
  for (const color of [...Object.keys(PROFILE_COLORS), '#7c3aed'])
    for (const room of ROOM_THEMES) {
      const appearance = {
        theme_color: themeColor(color),
        room_theme: room,
        social_links: { github: 'https://github.com/player' },
      };
      const legacy = legacyAppearance(appearance);
      const restored = restoreProfileAppearance(legacy);
      assert.deepEqual(restored, appearance);
      assert.equal(legacy.social_links[APPEARANCE_BACKUP_KEY], `v1:${color}:${room}`);
    }
  const base = {
    theme_color: 'cyan' as const,
    room_theme: 'crt_terminal' as const,
    social_links: {},
  };
  for (const invalid of [
    'v2:purple:halloween_crypt',
    'v1:#fff:halloween_crypt',
    'v1:purple:unknown',
    'v1:purple:crt_terminal:extra',
  ]) {
    assert.deepEqual(
      restoreProfileAppearance({ ...base, social_links: { [APPEARANCE_BACKUP_KEY]: invalid } }),
      base,
    );
  }
});
