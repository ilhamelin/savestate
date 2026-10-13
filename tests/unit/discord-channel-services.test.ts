import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
test('Discord Bridge reads real allowlisted channels, isolates cache entries and rejects read-only sends', async () => {
  const fixture = `data:text/javascript,${encodeURIComponent(`
    import {AppError} from '@/lib/http';
    export const state={authenticated:true,claims:0,lastSearch:null};
    export function unstable_cache(fn){const cache=new Map();return (...args)=>{const key=JSON.stringify(args);if(!cache.has(key))cache.set(key,fn(...args));return cache.get(key);};}
    export function revalidateTag(){}
    export function after(){}
    export async function authenticated(){if(!state.authenticated)throw new AppError('Unauthorized',401);return {user:{id:'owner'},db:{from(){return {select(){return this;},eq(){return this;},ilike(field,query){state.lastSearch=query;return this;},order(){return this;},limit(){return this;},async abortSignal(){return {data:[{id:'game',title:'Halo',slug:'halo'}],error:null};},async single(){return {data:{username:'player'},error:null};}};},async rpc(){state.claims++;return {data:0,error:null};}}};}
  `)}`;
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      if (specifier === 'server-only')
        return { url: 'data:text/javascript,export {};', shortCircuit: true };
      if (['next/cache', 'next/server', '@/lib/session'].includes(specifier))
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
  const names = [
    'DISCORD_BOT_TOKEN',
    'DISCORD_CHANNEL_ID',
    'DISCORD_CHECKPOINTS_CHANNEL_ID',
    'DISCORD_ANNOUNCEMENTS_CHANNEL_ID',
    'NEXT_PUBLIC_APP_URL',
  ];
  const previous = names.map((name) => process.env[name]);
  const oldFetch = globalThis.fetch;
  const main = '222222222222222222',
    checkpoints = '333333333333333333',
    announcements = '444444444444444444',
    guild = '111111111111111111';
  process.env.DISCORD_BOT_TOKEN = 'test-only-token';
  process.env.DISCORD_CHANNEL_ID = main;
  delete process.env.DISCORD_CHECKPOINTS_CHANNEL_ID;
  delete process.env.DISCORD_ANNOUNCEMENTS_CHANNEL_ID;
  process.env.NEXT_PUBLIC_APP_URL = 'https://example.com';
  const requests: { url: string; method: string; body?: Record<string, unknown> }[] = [];
  const message = (id: string) => ({
    id,
    author: { username: 'Native player', id: '999999999999999999' },
    content: `channel ${id}`,
    timestamp: '2026-10-12T12:00:00Z',
    attachments: [],
    pinned: false,
  });
  globalThis.fetch = async (input, init) => {
    const url = String(input),
      method = init?.method ?? 'GET';
    requests.push({
      url,
      method,
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    });
    if (url.endsWith('widget.json')) return Response.json({ presence_count: 1, members: [] });
    assert.equal(new Headers(init?.headers).get('Authorization'), 'Bot test-only-token');
    if (url.endsWith(`/channels/${main}`)) return Response.json({ guild_id: guild });
    if (url.endsWith(`/guilds/${guild}/channels`))
      return Response.json([
        { id: main, name: 'web-chat', type: 0 },
        { id: checkpoints, name: '💾-checkpoints', type: 0 },
        { id: announcements, name: 'anuncios-savestate', type: 5 },
        { id: '555555555555555555', name: 'admin-private', type: 0 },
      ]);
    for (const id of [main, checkpoints, announcements]) {
      if (url.endsWith(`/channels/${id}/messages?limit=30`)) return Response.json([message(id)]);
    }
    if (url.endsWith(`/channels/${main}/messages`) && method === 'POST')
      return Response.json(message(main));
    throw Error('Unexpected Discord target');
  };
  try {
    const service = await import('../../src/services/discord.ts');
    const route = await import('../../src/app/api/discord/messages/route.ts');
    const gamesRoute = await import('../../src/app/api/discord/games/route.ts');
    const { state } = await import(fixture);
    for (const [frequency, id] of [
      ['web-chat', main],
      ['checkpoints', checkpoints],
      ['announcements', announcements],
    ] as const) {
      const response = await route.GET(
        new Request(`https://example.com/api/discord/messages?channel=${frequency}`),
      );
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.channel, frequency);
      assert.equal(body.viewerUsername, 'player');
      assert.equal(body.messages[0].content, `channel ${id}`);
      assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
    }
    const reads = requests.filter((item) => item.url.includes('/messages?'));
    assert.equal(reads.length, 3);
    await service.fetchDiscordMessages(30, 'checkpoints');
    assert.equal(requests.filter((item) => item.url.includes('/messages?')).length, 3);
    const before = requests.length;
    assert.equal(
      (
        await route.GET(
          new Request('https://example.com/api/discord/messages?channel=555555555555555555'),
        )
      ).status,
      400,
    );
    assert.equal(requests.length, before);
    const post = (channel: string) =>
      new Request('https://example.com/api/discord/messages', {
        method: 'POST',
        headers: { origin: 'https://example.com', 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, content: 'Hello' }),
      });
    assert.equal((await route.POST(post('checkpoints'))).status, 403);
    assert.equal((await route.POST(post('announcements'))).status, 403);
    assert.equal(state.claims, 0);
    assert.equal((await route.POST(post('web-chat'))).status, 200);
    assert.equal(state.claims, 1);
    assert.equal(requests.at(-1)?.url, `https://discord.com/api/v10/channels/${main}/messages`);
    await service.sendDiscordMessage('player', '@Native player hola @everyone', {
      replyToMessageId: main,
      mentions: [{ id: '999999999999999999', username: 'Native player' }],
    });
    const outgoing = requests.at(-1)!.body!;
    assert.match(String(outgoing.content), /<@999999999999999999> hola @everyone/);
    assert.deepEqual(outgoing.allowed_mentions, {
      parse: [],
      users: ['999999999999999999'],
      replied_user: true,
    });
    assert.deepEqual(outgoing.message_reference, { message_id: main, fail_if_not_exists: false });
    const invalidOptions = new Request('https://example.com/api/discord/messages', {
      method: 'POST',
      headers: { origin: 'https://example.com', 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Hello', replyToMessageId: 'bad' }),
    });
    assert.equal((await route.POST(invalidOptions)).status, 400);
    assert.equal(state.claims, 1);
    const games = await gamesRoute.GET(
      new Request('https://example.com/api/discord/games?q=Ha%25_lo'),
    );
    assert.equal(games.status, 200);
    assert.equal(state.lastSearch, '%Ha\\%\\_lo%');
    assert.equal((await games.json()).games[0].slug, 'halo');
    assert.equal(
      (await gamesRoute.GET(new Request('https://example.com/api/discord/games?q=a'))).status,
      400,
    );
    process.env.DISCORD_CHECKPOINTS_CHANNEL_ID = '555555555555555555';
    // Explicit configuration is authorization by the server, never a browser-supplied ID.
    assert.equal((await service.fetchAuthorizedChannels()).checkpoints, '555555555555555555');
    process.env.DISCORD_CHECKPOINTS_CHANNEL_ID = '999999999999999999';
    await assert.rejects(service.fetchDiscordMessages(30, 'checkpoints'), /canal autorizado/);
    state.authenticated = false;
    assert.equal(
      (await gamesRoute.GET(new Request('https://example.com/api/discord/games?q=Halo'))).status,
      401,
    );
    assert.equal(
      (await route.GET(new Request('https://example.com/api/discord/messages'))).status,
      401,
    );
    assert.equal((await route.POST(post('web-chat'))).status, 401);
  } finally {
    globalThis.fetch = oldFetch;
    names.forEach((name, index) => {
      const value = previous[index];
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    });
    hooks.deregister();
  }
});
