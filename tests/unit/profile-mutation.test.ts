import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { GALLERY_AVATARS } from '../../src/domain/profile-studio.ts';
import { APPEARANCE_BACKUP_KEY } from '../../src/domain/profile-appearance.ts';

test('Profile mutation persists gallery media and safely retries extended themes on legacy constraints', async () => {
  const fixture = `data:text/javascript,${encodeURIComponent(`
    export const state = { mode: 'legacy', updates: [], stored: null };
    export function reset(mode) {
      state.mode = mode; state.updates = [];
      state.stored = { id: '11111111-1111-4111-8111-111111111111', username: 'player', level: 1,
        equipped_title: 'Insert Coin', equipped_frame: 'default', theme_color: 'cyan',
        room_theme: 'crt_terminal', social_links: {}, avatar_url: null, banner_url: null };
    }
    export function publicEnv() { return { url: 'https://project.supabase.co', key: 'test' }; }
    export async function authenticated() {
      return { user: { id: state.stored.id }, db: { from() {
        let payload = null;
        const query = {
          select() { return this; }, eq(column, value) { if (column !== 'id' || value !== state.stored.id) throw Error('Wrong owner'); return this; },
          update(value) { payload = value; return this; },
          async single() {
            if (!payload) return { data: state.stored, error: null };
            state.updates.push(payload);
            if (state.mode === 'denied') return { data: null, error: { code: '42501' } };
            if (state.mode === 'legacy' && (!['cyan','green','pink','amber'].includes(payload.theme_color) || !['crt_terminal','handheld_console','retro_shelf'].includes(payload.room_theme)))
              return { data: null, error: { code: '23514' } };
            state.stored = { ...state.stored, ...payload }; return { data: state.stored, error: null };
          }
        };
        return query;
      } } };
    }
  `)}`;
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      if (specifier === 'server-only')
        return { url: 'data:text/javascript,export {};', shortCircuit: true };
      if (specifier === '@/lib/session' || specifier === '@/lib/env')
        return { url: fixture, shortCircuit: true };
      if (specifier.startsWith('@/'))
        return {
          url: pathToFileURL(resolve('src', specifier.slice(2) + '.ts')).href,
          shortCircuit: true,
        };
      return next(specifier, context);
    },
    load(url, context, next) {
      if (url.startsWith('file:') && url.endsWith('.ts'))
        return {
          format: 'module',
          shortCircuit: true,
          source: stripTypeScriptTypes(readFileSync(fileURLToPath(url), 'utf8'), {
            mode: 'transform',
          }),
        };
      return next(url, context);
    },
  });
  try {
    const { state, reset } = await import(fixture);
    const { profileMutation } = await import('../../src/services/profile.ts');
    const input = {
      username: 'player',
      terminal_status: '',
      library_private: false,
      theme_color: '#7C3AED',
      room_theme: 'halloween_crypt',
      social_links: { github: 'https://github.com/player' },
      avatar_url: '/avatars/halloween_pumpkin.svg',
      banner_url: null,
    };
    reset('legacy');
    const result = await profileMutation(input);
    assert.equal(state.updates.length, 2);
    assert.equal(state.stored.theme_color, 'cyan');
    assert.equal(state.stored.room_theme, 'crt_terminal');
    assert.equal(state.stored.social_links[APPEARANCE_BACKUP_KEY], 'v1:#7c3aed:halloween_crypt');
    assert.equal(result.theme_color, '#7c3aed');
    assert.equal(result.room_theme, 'halloween_crypt');
    assert.deepEqual(result.social_links, input.social_links);
    const next = await profileMutation({
      ...input,
      room_theme: undefined,
      social_links: { discord: 'https://discord.gg/test' },
    });
    assert.equal(next.room_theme, 'halloween_crypt');
    assert.equal(next.social_links.discord, 'https://discord.gg/test');
    state.mode = 'modern';
    await profileMutation({ ...input, theme_color: 'christmas', room_theme: 'christmas_lodge' });
    assert.equal(state.stored.theme_color, 'christmas');
    assert.equal(state.stored.room_theme, 'christmas_lodge');
    assert.equal(state.stored.social_links[APPEARANCE_BACKUP_KEY], undefined);
    for (const avatar of GALLERY_AVATARS) {
      reset('modern');
      assert.equal(
        (await profileMutation({ ...input, avatar_url: avatar.url })).avatar_url,
        avatar.url,
      );
      assert.equal(state.updates.length, 1);
    }
    for (const changes of [
      { theme_color: '#fff' },
      { room_theme: 'evil' },
      { avatar_url: '/avatars/unknown.svg' },
      { avatar_url: '/avatars/cyan.svg?script=bad' },
      { avatar_url: 'https://evil.test/a.webp' },
      { equipped_frame: 'final_boss' },
      { social_links: { [APPEARANCE_BACKUP_KEY]: 'v1:purple:halloween_crypt' } },
    ]) {
      reset('modern');
      await assert.rejects(() => profileMutation({ ...input, ...changes }));
      assert.equal(state.updates.length, 0);
    }
    reset('denied');
    await assert.rejects(() => profileMutation(input));
    assert.equal(state.updates.length, 1);
  } finally {
    hooks.deregister();
  }
});
