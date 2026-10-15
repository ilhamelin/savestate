import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
test('Discord bot reuses trackers, validates inputs, protects cron and deduplicates announcement runs', async () => {
  const fixture = `data:text/javascript,${encodeURIComponent(`
    import {AppError} from '@/lib/http';
    import {competitiveInput,normalizedGenshin} from '@/domain/competitive-tracker';
    import {riotId,lolPlatform} from '@/domain/lol-tracker';
    import {AsyncLocalStorage} from 'node:async_hooks';
    const cacheContext=new AsyncLocalStorage();
    export const state={freebies:[],history:[],posts:[],caches:[],after:[],trackers:[],providerError:false,invalidations:0};
    export function unstable_cache(fn){const cache=new Map();state.caches.push(cache);return (...args)=>{const key=JSON.stringify(args);if(!cache.has(key))cache.set(key,cacheContext.run(true,()=>fn(...args)));return cache.get(key);};}
    export function revalidateTag(){if(cacheContext.getStore())throw Error('Cannot revalidate inside a cached function');state.invalidations++;}
    export function after(fn){state.after.push(fn);}
    export async function getActiveFreebies(){return state.freebies;}
    export function publicClient(){throw Error('Competitive commands must not query Supabase');}
    export async function inspectCompetitive(input){const parsed=competitiveInput(input);state.trackers.push(parsed);if(state.providerError)throw new AppError('Configura la clave del tracker.',503);if(parsed.game==='genshin')return normalizedGenshin({playerInfo:{nickname:'Traveler',level:60,worldLevel:8,towerFloorIndex:12,towerLevelIndex:3}},parsed.uid);return {game:'valorant',gameName:parsed.gameName,tagLine:parsed.tagLine,accountLevel:25,currentRank:'Gold 2',rankingInTier:33,matches:[],dataSource:'henrik_full'};}
    export async function inspectLol(id,region,start,count){const parsed=riotId(id),platform=lolPlatform(region);state.trackers.push({game:'lol',platform,start,count});if(state.providerError)throw new AppError('Configura la clave del tracker.',503);return {...parsed,summonerLevel:100,platform,soloQueue:{tier:'GOLD',rank:'II',leaguePoints:42,wins:20,losses:10,winrate:66.7},rankStatus:'available'};}
  `)}`;
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      if (specifier === 'server-only')
        return { url: 'data:text/javascript,export {};', shortCircuit: true };
      if (
        [
          'next/cache',
          'next/server',
          '@/services/freebies',
          '@/services/competitive-tracker',
          '@/integrations/riot/server',
          '@/integrations/supabase/public',
        ].includes(specifier)
      )
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
    'CRON_SECRET',
    'NEXT_PUBLIC_APP_URL',
  ];
  const previous = names.map((name) => process.env[name]),
    oldFetch = globalThis.fetch;
  const main = '222222222222222222',
    announcements = '444444444444444444',
    guild = '111111111111111111';
  process.env.DISCORD_BOT_TOKEN = 'test-only-token';
  process.env.DISCORD_CHANNEL_ID = main;
  delete process.env.DISCORD_CHECKPOINTS_CHANNEL_ID;
  delete process.env.DISCORD_ANNOUNCEMENTS_CHANNEL_ID;
  process.env.CRON_SECRET = 's'.repeat(40);
  process.env.NEXT_PUBLIC_APP_URL = 'https://example.com';
  const oldNow = Date.now;
  Date.now = () => Date.parse('2026-10-20T00:00:00Z');
  try {
    const { state } = await import(fixture);
    state.freebies = Array.from({ length: 3 }, (_, index) => ({
      id: index + 1,
      title: 'Game ' + (index + 1),
      worth: '$19.99',
      thumbnail: 'https://www.gamerpower.com/offers/game.jpg',
      openGiveawayUrl: 'https://www.gamerpower.com/open/game-' + (index + 1),
      platforms: 'Steam',
      endDate: null,
    }));
    state.history = [{ embeds: [{ footer: { text: 'SaveState Freebie #1' } }] }];
    let postAttempts = 0;
    const attemptNonces: string[] = [];
    let alwaysLimited = false;
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      assert.equal(new Headers(init?.headers).get('Authorization'), 'Bot test-only-token');
      if (url.endsWith('/channels/' + main)) return Response.json({ guild_id: guild });
      if (url.endsWith('/guilds/' + guild + '/channels'))
        return Response.json([
          { id: main, name: 'web-chat', type: 0 },
          { id: announcements, name: 'anuncios-savestate', type: 5 },
        ]);
      if (url.endsWith('/channels/' + announcements + '/messages?limit=100'))
        return Response.json(state.history);
      assert.equal(url, 'https://discord.com/api/v10/channels/' + announcements + '/messages');
      assert.equal(init?.method, 'POST');
      postAttempts++;
      const body = JSON.parse(String(init.body));
      attemptNonces.push(body.nonce);
      if (postAttempts === 1 || alwaysLimited)
        return Response.json({ retry_after: 0 }, { status: 429 });
      state.posts.push(body);
      state.history.push({ ...body, timestamp: new Date(Date.now()).toISOString() });
      assert.equal(body.enforce_nonce, true);
      assert.ok(body.nonce.length <= 25);
      assert.deepEqual(body.allowed_mentions, { parse: [] });
      assert.equal(body.components[0].components[0].style, 5);
      return Response.json(
        { id: '555555555555555555', ...body },
        {
          headers: { 'X-RateLimit-Remaining': '0', 'X-RateLimit-Reset-After': '0' },
        },
      );
    };
    const discord = await import('../../src/services/discord.ts');
    const commands = await import('../../src/services/discord-interactions.ts');
    const command = (name: string, options: { name: string; value: string }[] = []) =>
      commands.discordCommandResponse({ data: { name, options } });
    assert.equal((await command('gratis')).data.embeds?.length, 3);
    const valorant = await command('valorant', [{ name: 'usuario', value: 'Player#LAS' }]);
    assert.match(valorant.data.embeds![0]!.description, /33 RR/);
    assert.equal(state.trackers.at(-1).region, 'latam');
    const lol = await command('lol', [{ name: 'usuario', value: 'Player#LAS' }]);
    assert.match(lol.data.embeds![0]!.description, /42 LP/);
    assert.equal(state.trackers.at(-1).platform, 'la2');
    assert.equal(state.trackers.at(-1).count, 1);
    const genshin = await command('genshin', [{ name: 'uid', value: '618285856' }]);
    assert.match(genshin.data.embeds![0]!.description, /Adventure Rank: 60/);
    assert.equal((await command('genshin', [{ name: 'uid', value: 'not-an-id' }])).data.flags, 64);
    assert.equal(
      (
        await command('valorant', [
          { name: 'usuario', value: 'Player#LAS' },
          { name: 'region', value: 'evil.test' },
        ])
      ).data.flags,
      64,
    );
    state.providerError = true;
    const failed = await command('lol', [{ name: 'usuario', value: 'Player#LAS' }]);
    assert.equal(failed.data.flags, 64);
    assert.match(failed.data.content!, /clave del tracker/);
    state.providerError = false;
    const [first, concurrent] = await Promise.all([
      discord.announceNewFreebiesToDiscord(),
      discord.announceNewFreebiesToDiscord(),
    ]);
    assert.deepEqual(first, { published: 2, skipped: 1 });
    assert.deepEqual(concurrent, first);
    assert.equal(state.posts.length, 2);
    assert.equal(postAttempts, 3);
    assert.deepEqual(attemptNonces, ['freebie:2', 'freebie:2', 'freebie:3']);
    assert.equal(state.invalidations, 1);
    const cron = await import('../../src/app/api/cron/discord-freebies/route.ts');
    const request = (secret?: string) =>
      new Request('https://example.com/api/cron/discord-freebies', {
        headers: secret ? { authorization: 'Bearer ' + secret } : {},
      });
    assert.equal((await cron.GET(request())).status, 401);
    assert.equal((await cron.POST(request('wrong'))).status, 401);
    const result = await cron.GET(request('s'.repeat(40)));
    assert.equal(result.status, 200);
    assert.equal(result.headers.get('Cache-Control'), 'no-store');
    assert.equal(state.posts.length, 7);
    discord.scheduleDiscordFreebies();
    assert.equal(state.after.length, 1);
    await state.after[0]();
    assert.equal(state.posts.length, 7);
    assert.equal(state.invalidations, 2);
    state.caches.forEach((cache: Map<unknown, unknown>) => cache.clear());
    assert.deepEqual(await discord.announceGta6CountdownToDiscord(), { published: false });
    assert.deepEqual(await discord.announceZeldaOotCountdownToDiscord(), { published: false });
    assert.deepEqual(await discord.announceMetro2039CountdownToDiscord(), { published: false });
    assert.deepEqual(await discord.announceNewFreebiesToDiscord(), { published: 0, skipped: 3 });
    assert.equal(state.posts.length, 7);
    state.caches.forEach((cache: Map<unknown, unknown>) => cache.clear());
    state.history = null;
    await assert.rejects(discord.announceNewFreebiesToDiscord(), /historial/);
    assert.equal(state.posts.length, 7);
    state.caches.forEach((cache: Map<unknown, unknown>) => cache.clear());
    state.history = [];
    alwaysLimited = true;
    const beforeRetry = postAttempts;
    await assert.rejects(discord.announceNewFreebiesToDiscord(), /limitando/);
    assert.equal(postAttempts - beforeRetry, 3);
    assert.equal(state.posts.length, 7);
    delete process.env.CRON_SECRET;
    assert.equal((await cron.GET(request())).status, 503);
  } finally {
    Date.now = oldNow;
    globalThis.fetch = oldFetch;
    names.forEach((name, index) => {
      const value = previous[index];
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    });
    hooks.deregister();
  }
});
