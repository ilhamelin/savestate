import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
test('Discord Bridge reads real allowlisted channels, isolates cache entries and rejects read-only sends', async () => {
  const fixture = `data:text/javascript,${encodeURIComponent(`
    import {AppError} from '@/lib/http';
    export const state={authenticated:true,claims:0,lastSearch:null,linked:false,privateAllowed:true,prepared:null,removed:null};
    export async function authenticatedAdmin(){throw new AppError('Admin access not allowed in Discord tests',403);}
    const owner='11111111-1111-4111-8111-111111111111';
    export function unstable_cache(fn){const cache=new Map();return (...args)=>{const key=JSON.stringify(args);if(!cache.has(key))cache.set(key,fn(...args));return cache.get(key);};}
    export function revalidateTag(){}
    export function after(){}
    export async function authenticated(){if(!state.authenticated)throw new AppError('Unauthorized',401);return {user:{id:owner},db:{auth:{async getUser(){return {data:{user:{id:owner,identities:state.linked?[{provider:'discord',identity_data:{provider_id:'999999999999999999'}}]:[]}},error:null}}},storage:{from(bucket){if(bucket!=='discord-private-media')throw Error('Public bucket not permitted');return {async createSignedUploadUrl(path){state.prepared=path;return {data:{token:'upload-token'},error:null}},async download(){return {data:new Blob(['GIF89atest'],{type:'image/gif'}),error:null}},async remove(paths){state.removed=paths;return {data:[],error:null}}}}},from(){return {select(){return this;},eq(){return this;},ilike(field,query){state.lastSearch=query;return this;},order(){return this;},limit(){return this;},async abortSignal(){return {data:[{id:'game',title:'Halo',slug:'halo'}],error:null};},async single(){return {data:{username:'player'},error:null};}};},async rpc(){state.claims++;return {data:0,error:null};}}};}
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
    'DISCORD_PRIVATE_CHAT_ALLOWED_USERS',
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
  delete process.env.DISCORD_PRIVATE_CHAT_ALLOWED_USERS;
  process.env.DISCORD_BOT_TOKEN = 'test-only-token';
  process.env.DISCORD_CHANNEL_ID = main;
  delete process.env.DISCORD_CHECKPOINTS_CHANNEL_ID;
  delete process.env.DISCORD_ANNOUNCEMENTS_CHANNEL_ID;
  process.env.NEXT_PUBLIC_APP_URL = 'https://example.com';
  const requests: { url: string; method: string; body?: Record<string, unknown> }[] = [];
  const uploadedForms: FormData[] = [];
  let screenHistory: unknown[] = [];
  const privateChat = '747219024324198532';
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
      body:
        typeof init?.body === 'string'
          ? JSON.parse(init.body)
          : init?.body instanceof FormData
            ? JSON.parse(String(init.body.get('payload_json')))
            : undefined,
    });
    if (init?.body instanceof FormData) uploadedForms.push(init.body);
    if (url.endsWith('widget.json')) return Response.json({ presence_count: 1, members: [] });
    assert.equal(new Headers(init?.headers).get('Authorization'), 'Bot test-only-token');
    if (url.endsWith(`/channels/${main}`)) return Response.json({ guild_id: guild });
    if (url.endsWith(`/channels/${privateChat}`)) {
      const { state } = await import(fixture);
      return Response.json({
        id: privateChat,
        guild_id: guild,
        type: 0,
        permission_overwrites: state.privateAllowed
          ? []
          : [{ id: guild, type: 0, deny: '1024', allow: '0' }],
      });
    }
    if (url.endsWith(`/guilds/${guild}`))
      return Response.json({ id: guild, owner_id: '888888888888888888' });
    if (url.endsWith(`/guilds/${guild}/roles`))
      return Response.json([{ id: guild, permissions: '101376' }]);
    if (url.endsWith(`/guilds/${guild}/members/999999999999999999`))
      return Response.json({ user: { id: '999999999999999999' }, roles: [] });
    if (url.endsWith(`/guilds/${guild}/channels`))
      return Response.json([
        { id: main, name: 'web-chat', type: 0 },
        { id: checkpoints, name: '💾-checkpoints', type: 0 },
        { id: announcements, name: 'anuncios-savestate', type: 5 },
        { id: privateChat, name: '〘🕵〙chat-privado', type: 0 },
        { id: '555555555555555555', name: 'admin-private', type: 0 },
      ]);
    for (const id of [main, checkpoints, announcements, privateChat]) {
      if (url.endsWith(`/channels/${id}/messages?limit=30`)) return Response.json([message(id)]);
    }
    if (url.endsWith(`/channels/${main}/messages`) && method === 'POST')
      return Response.json(message(main));
    if (url.endsWith(`/channels/${privateChat}/messages`) && method === 'POST')
      return Response.json(message(privateChat));
    if (url.endsWith(`/channels/${privateChat}/messages/${main}`))
      return Response.json({ id: main, channel_id: main });
    if (url.endsWith(`/channels/${announcements}/messages?limit=100`))
      return Response.json(screenHistory);
    if (url.endsWith(`/channels/${announcements}/messages`) && method === 'POST') {
      screenHistory = [{ author: { bot: true }, embeds: requests.at(-1)?.body?.embeds }];
      return Response.json({ id: announcements });
    }
    throw Error('Unexpected Discord target');
  };
  try {
    const service = await import('../../src/services/discord.ts');
    const route = await import('../../src/app/api/discord/messages/route.ts');
    const gamesRoute = await import('../../src/app/api/discord/games/route.ts');
    const privateUploadRoute = await import('../../src/app/api/discord/private-upload/route.ts');
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
    const multimediaPost = (content: string, mediaUrl: string) =>
      new Request('https://example.com/api/discord/messages', {
        method: 'POST',
        headers: { origin: 'https://example.com', 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: 'web-chat', content, mediaUrl }),
      });
    assert.equal(
      (await route.POST(multimediaPost('x'.repeat(500), 'https://i.imgur.com/game.gif'))).status,
      200,
    );
    assert.equal(
      requests.at(-1)?.body?.content,
      '**[@player en Savestate]:** ' + 'x'.repeat(500) + '\nhttps://i.imgur.com/game.gif',
    );
    assert.deepEqual(requests.at(-1)?.body?.allowed_mentions, {
      parse: [],
      users: [],
      replied_user: false,
    });
    assert.equal(
      (await route.POST(multimediaPost('', 'https://media.tenor.com/example/game.gif'))).status,
      200,
    );
    assert.match(
      String(requests.at(-1)?.body?.content),
      /\nhttps:\/\/media.tenor.com\/example\/game.gif$/,
    );
    const claimsBeforeInvalid = state.claims;
    assert.equal(
      (await route.POST(multimediaPost('Hello', 'https://i.imgur.com.evil.test/a.gif'))).status,
      400,
    );
    assert.equal(state.claims, claimsBeforeInvalid);
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
    const privateRead = () =>
      new Request('https://example.com/api/discord/messages?channel=chat-privado');
    const beforePrivate = requests.length;
    assert.equal((await route.GET(privateRead())).status, 403);
    assert.equal((await route.POST(post('chat-privado'))).status, 403);
    assert.equal(requests.length, beforePrivate);
    process.env.DISCORD_PRIVATE_CHAT_ALLOWED_USERS = '11111111-1111-4111-8111-111111111111';
    assert.equal((await route.GET(privateRead())).status, 200);
    assert.equal((await route.POST(post('chat-privado'))).status, 200);
    delete process.env.DISCORD_PRIVATE_CHAT_ALLOWED_USERS;
    assert.equal((await route.GET(privateRead())).status, 403);
    state.linked = true;
    const privateResponse = await route.GET(privateRead());
    assert.equal(privateResponse.status, 200);
    const privateData = await privateResponse.json();
    assert.equal(privateData.messages[0].content, `channel ${privateChat}`);
    assert.equal(privateData.privateChatAccess.canSend, true);
    assert.equal((await route.POST(post('chat-privado'))).status, 200);
    assert.equal(
      requests.at(-1)?.url,
      `https://discord.com/api/v10/channels/${privateChat}/messages`,
    );
    const prepare = () =>
      new Request('https://example.com/api/discord/private-upload', {
        method: 'POST',
        headers: { origin: 'https://example.com', 'Content-Type': 'application/json' },
        body: JSON.stringify({ size: 10, contentType: 'image/gif' }),
      });
    const preparedResponse = await privateUploadRoute.POST(prepare());
    assert.equal(preparedResponse.status, 200);
    const prepared = (await preparedResponse.json()).data;
    assert.equal(prepared.bucket, 'discord-private-media');
    assert.equal(prepared.url, undefined);
    const filePost = (channel: string) =>
      new Request('https://example.com/api/discord/messages', {
        method: 'POST',
        headers: { origin: 'https://example.com', 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, privateAttachmentPath: prepared.path, content: '' }),
      });
    assert.equal((await route.POST(filePost('web-chat'))).status, 403);
    assert.equal((await route.POST(filePost('chat-privado'))).status, 200);
    const uploaded = uploadedForms.at(-1)?.get('files[0]');
    assert.ok(uploaded instanceof File);
    assert.equal(await uploaded.text(), 'GIF89atest');
    assert.deepEqual(state.removed, [prepared.path]);
    assert.ok(!String(requests.at(-1)?.body?.content).includes('supabase'));
    const privateReply = new Request('https://example.com/api/discord/messages', {
      method: 'POST',
      headers: { origin: 'https://example.com', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: 'chat-privado',
        content: 'Wrong channel',
        replyToMessageId: main,
      }),
    });
    assert.equal((await route.POST(privateReply)).status, 400);
    state.privateAllowed = false;
    assert.equal((await privateUploadRoute.POST(prepare())).status, 403);
    const readsBeforeRevocation = requests.filter((item) =>
      item.url.includes(`/channels/${privateChat}/messages?`),
    ).length;
    assert.equal((await route.GET(privateRead())).status, 403);
    assert.equal((await route.POST(post('chat-privado'))).status, 403);
    assert.equal(
      requests.filter((item) => item.url.includes(`/channels/${privateChat}/messages?`)).length,
      readsBeforeRevocation,
    );
    state.linked = false;
    const announcement = {
      tmdbId: 94605,
      mediaType: 'tv',
      title: 'Arcane',
      nextAirDate: '2026-12-10',
      season: 3,
      episode: 1,
      providerName: 'Netflix',
      posterUrl: 'https://image.tmdb.org/t/p/w500/poster.jpg',
    };
    const [first, concurrent] = await Promise.all([
      service.announceScreenUpcomingToDiscord(announcement),
      service.announceScreenUpcomingToDiscord(announcement),
    ]);
    assert.equal(first.published, true);
    assert.equal(concurrent.published, true);
    const screenPosts = requests.filter(
      (item) => item.method === 'POST' && item.url.endsWith(`/channels/${announcements}/messages`),
    );
    assert.equal(screenPosts.length, 1);
    const body = screenPosts[0]!.body!;
    const embed = (
      body.embeds as {
        title: string;
        color: number;
        fields: { name: string; value: string }[];
        thumbnail: { url: string };
      }[]
    )[0]!;
    assert.equal(embed.title, '📢 PRÓXIMO ESTRENO // SaveState Screen');
    assert.equal(embed.color, 0x00f0ff);
    assert.equal(embed.thumbnail.url, announcement.posterUrl);
    assert.ok(embed.fields.some((field) => /Temporada 3 · Episodio 1/.test(field.value)));
    assert.ok(embed.fields.some((field) => /<t:\d+:R>/.test(field.value)));
    assert.deepEqual(body.allowed_mentions, { parse: [] });
    assert.equal(body.enforce_nonce, true);
    assert.ok(String(body.nonce).length <= 25);
    assert.equal((await service.announceScreenUpcomingToDiscord(announcement)).published, false);
    process.env.DISCORD_ANNOUNCEMENTS_CHANNEL_ID = '999999999999999999';
    await assert.rejects(
      service.announceScreenUpcomingToDiscord({ ...announcement, tmdbId: 100088 }),
      /canal anuncios-savestate/,
    );
    delete process.env.DISCORD_ANNOUNCEMENTS_CHANNEL_ID;
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
