import test from 'node:test';
import assert from 'node:assert/strict';
import {
  discordSharedGame,
  discordNearBottom,
  sameDiscordMessages,
} from '../../src/domain/discord-client.ts';

test('shared game cards accept local catalogue links and preserve the title', () => {
  assert.deepEqual(
    discordSharedGame(
      '🎮 God of War (https://savestate-eight.vercel.app/games/god-of-war--1)',
      'https://savestate-eight.vercel.app',
    ),
    { title: 'God of War', href: '/games/god-of-war--1' },
  );
  assert.deepEqual(
    discordSharedGame('🎮 Portal (http://localhost:3000/games/portal)', 'http://localhost:3000'),
    { title: 'Portal', href: '/games/portal' },
  );
});
test('shared game cards cannot promote foreign hosts, credentials or unrelated routes', () => {
  for (const url of [
    'https://evil.example/games/portal',
    'https://savestate-eight.vercel.app.evil.example/games/portal',
    'https://user@savestate-eight.vercel.app/games/portal',
    'https://savestate-eight.vercel.app/settings',
    'https://savestate-eight.vercel.app/games/portal?redirect=evil',
    'https://savestate-eight.vercel.app/games/portal#bad',
  ]) {
    assert.equal(
      discordSharedGame('🎮 Portal (' + url + ')', 'https://savestate-eight.vercel.app'),
      null,
    );
  }
  assert.equal(discordSharedGame('plain text', 'https://savestate-eight.vercel.app'), null);
  assert.equal(discordSharedGame('🎮 Portal (https://example.com/games/portal)', 'invalid'), null);
});
test('history anchoring retains the near-bottom threshold and stable empty batches', () => {
  assert.equal(discordNearBottom(420, 500, 1000), true);
  assert.equal(discordNearBottom(419, 500, 1000), false);
  assert.equal(sameDiscordMessages([], []), true);
});

test('terminal renders accessible grouped controls and hides private channels before authorization', async () => {
  const { registerHooks } = await import('node:module');
  const { readFileSync, existsSync } = await import('node:fs');
  const { resolve } = await import('node:path');
  const { pathToFileURL, fileURLToPath } = await import('node:url');
  const { default: ts } = await import('typescript');
  const { createElement } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { load } = await import('cheerio');
  const moduleUrl = (source: string) => 'data:text/javascript,' + encodeURIComponent(source);
  const image = moduleUrl(
    'import {createElement} from ' +
      JSON.stringify(import.meta.resolve('react')) +
      "; export default function Image({unoptimized,...props}) {return createElement('img',props)}",
  );
  const link = moduleUrl(
    'import {createElement} from ' +
      JSON.stringify(import.meta.resolve('react')) +
      "; export default function Link(props) {return createElement('a',props)}",
  );
  const components = moduleUrl(
    'export function VaultVideo(){return null} export function VaultPicker(){return null} export function DiscordGamePicker(){return null} export function DiscordLinkedRoleCard(){return null}',
  );
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      if (specifier === 'next/image') return { url: image, shortCircuit: true };
      if (specifier === 'next/link') return { url: link, shortCircuit: true };
      if (
        [
          '@/components/vault-video',
          '@/components/vault-picker',
          '@/components/discord-game-picker',
          '@/components/discord-linked-role-card',
        ].includes(specifier)
      )
        return { url: components, shortCircuit: true };
      if (specifier === '@/integrations/supabase/browser')
        return {
          url: moduleUrl('export function browserClient(){throw new Error("Browser only")}'),
          shortCircuit: true,
        };
      if (specifier.startsWith('@/')) {
        const path = resolve('src', specifier.slice(2));
        return {
          url: pathToFileURL(path + (existsSync(path + '.ts') ? '.ts' : '.tsx')).href,
          shortCircuit: true,
        };
      }
      return next(specifier, context);
    },
    load(url, context, next) {
      if (url.startsWith('file:') && /\.tsx?$/.test(url) && !url.includes('node_modules'))
        return {
          format: 'module',
          source: ts.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), {
            compilerOptions: {
              module: ts.ModuleKind.ESNext,
              target: ts.ScriptTarget.ES2022,
              jsx: ts.JsxEmit.ReactJSX,
            },
          }).outputText,
          shortCircuit: true,
        };
      return next(url, context);
    },
  });
  try {
    const { DiscordChat } = await import('../../src/components/discord-chat.tsx');
    const $ = load(
      renderToStaticMarkup(createElement(DiscordChat, { inviteUrl: 'https://discord.gg/test' })),
    );
    assert.equal($('.discord-tools-group button').length, 5);
    assert.equal($('.discord-emoji-palette button').length, 4);
    assert.equal($('.discord-send-action button[disabled]').length, 1);
    assert.equal($('.discord-channel-pill').length, 3);
    assert.equal($('.discord-channel-pill[aria-pressed=true]').length, 1);
    assert.doesNotMatch($('.discord-channel-list').text(), /chat-privado/);
    assert.match($('.discord-live').text(), /CONECTANDO/);
    assert.doesNotMatch($('.discord-live').text(), /24ms/);
    assert.equal($('textarea[maxlength=500]').length, 1);
    assert.equal($('.discord-presence-scroll[aria-label]').length, 1);
    for (const el of $(
      '.discord-channel-pill,.discord-tools-group button,.discord-emoji-palette button,.discord-send-action button',
    ).toArray())
      assert.ok($(el).attr('aria-label'));
  } finally {
    hooks.deregister();
  }
});
