import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { shouldAnnounceGta6Countdown } from '../../src/domain/gta6-countdown.ts';
test('Release announcements share one history read, preserve independent cooldowns and deduplicate concurrent callers', async () => {
  const fixture =
    'data:text/javascript,' +
    encodeURIComponent(
      `import {AsyncLocalStorage} from 'node:async_hooks';const context=new AsyncLocalStorage();export const state={caches:[],invalidations:0};export function unstable_cache(fn){const cache=new Map();state.caches.push(cache);return(...args)=>{const key=JSON.stringify(args);if(!cache.has(key))cache.set(key,context.run(true,()=>fn(...args)));return cache.get(key);};}export function revalidateTag(){if(context.getStore())throw Error('Invalidation inside cache');state.invalidations++;}export function after(){}export async function getActiveFreebies(){return [];}`,
    );
  const hooks = registerHooks({
    resolve(s, c, next) {
      if (s === 'server-only')
        return { url: 'data:text/javascript,export {};', shortCircuit: true };
      if (['next/cache', 'next/server', '@/services/freebies'].includes(s))
        return { url: fixture, shortCircuit: true };
      if (s.startsWith('@/'))
        return { url: pathToFileURL(resolve('src', s.slice(2) + '.ts')).href, shortCircuit: true };
      return next(s, c);
    },
    load(url, c, next) {
      if (url.startsWith('file:') && url.endsWith('.ts'))
        return {
          format: 'module',
          shortCircuit: true,
          source: stripTypeScriptTypes(readFileSync(fileURLToPath(url), 'utf8'), {
            mode: 'transform',
          }),
        };
      return next(url, c);
    },
  });
  const names = [
      'DISCORD_BOT_TOKEN',
      'DISCORD_CHANNEL_ID',
      'DISCORD_ANNOUNCEMENTS_CHANNEL_ID',
      'DISCORD_CHECKPOINTS_CHANNEL_ID',
      'NEXT_PUBLIC_APP_URL',
    ],
    previous = names.map((n) => process.env[n]);
  const oldFetch = globalThis.fetch,
    oldNow = Date.now;
  let now = Date.parse('2026-10-20T00:00:00Z'),
    reads = 0;
  const primary = '111111111111111111',
    channel = '222222222222222222',
    guild = '333333333333333333';
  Date.now = () => now;
  process.env.DISCORD_BOT_TOKEN = 'mock-only';
  process.env.DISCORD_CHANNEL_ID = primary;
  delete process.env.DISCORD_ANNOUNCEMENTS_CHANNEL_ID;
  delete process.env.DISCORD_CHECKPOINTS_CHANNEL_ID;
  process.env.NEXT_PUBLIC_APP_URL = 'https://example.com';
  const history: unknown[] = [
    {
      timestamp: new Date(now).toISOString(),
      embeds: [
        {
          footer: {
            text: `savestate-gta6-countdown:${shouldAnnounceGta6Countdown([], now).bucket} · Aviso automático cada 5 días`,
          },
        },
      ],
    },
  ];
  const posts: { nonce: string; enforce_nonce: boolean; embeds: { footer: { text: string } }[] }[] =
    [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    assert.equal(new Headers(init?.headers).get('Authorization'), 'Bot mock-only');
    if (url.endsWith('/channels/' + primary)) return Response.json({ guild_id: guild });
    if (url.endsWith('/guilds/' + guild + '/channels'))
      return Response.json([
        { id: primary, name: 'web-chat', type: 0 },
        { id: channel, name: 'anuncios-savestate', type: 5 },
      ]);
    if (url.endsWith('/messages?limit=100')) {
      reads++;
      return Response.json(history);
    }
    assert.equal(url, 'https://discord.com/api/v10/channels/' + channel + '/messages');
    assert.equal(init?.method, 'POST');
    const payload = JSON.parse(String(init.body));
    posts.push(payload);
    history.unshift({ ...payload, timestamp: new Date(now).toISOString() });
    return Response.json(
      { id: '444444444444444444' },
      { headers: { 'X-RateLimit-Remaining': '1' } },
    );
  };
  try {
    const service = await import('../../src/services/discord.ts'),
      { state } = await import(fixture);
    await Promise.all([
      service.announceGta6CountdownToDiscord(),
      service.announceZeldaOotCountdownToDiscord(),
      service.announceTga2026CountdownToDiscord(),
    ]);
    assert.equal(reads, 1);
    assert.equal(posts.length, 2);
    assert.match(posts[0]!.nonce, /^zelda-oot:/);
    assert.match(posts[1]!.nonce, /^tga-2026:/);
    assert.equal(posts[0]!.enforce_nonce, true);
    assert.equal(state.invalidations, 1);
    for (const cache of state.caches) cache.clear();
    assert.deepEqual(await service.announceGta6CountdownToDiscord(), { published: false });
    assert.equal(posts.length, 2);
    now += 5 * 86400000;
    for (const cache of state.caches) cache.clear();
    await service.announceGta6CountdownToDiscord();
    assert.equal(posts.length, 5);
    assert.match(posts[2]!.nonce, /^gta6:/);
    assert.match(posts[3]!.nonce, /^zelda-oot:/);
    assert.match(posts[4]!.nonce, /^tga-2026:/);
    assert.equal(state.invalidations, 2);
  } finally {
    globalThis.fetch = oldFetch;
    Date.now = oldNow;
    names.forEach((n, i) => {
      if (previous[i] === undefined) delete process.env[n];
      else process.env[n] = previous[i];
    });
    hooks.deregister();
  }
});
