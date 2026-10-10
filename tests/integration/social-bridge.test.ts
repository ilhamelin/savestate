import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// No external requests, credentials or database writes: exercise real route/service code with isolated upstream/session adapters.
test('social bridge routes enforce session, origin, quota and sanitized embeds; Discord payloads disable mentions', async () => {
  const state = { authenticated: true, retry: 0, sends: 0, status: 200, claims: 0 };
  const fixture = {
    id: '123456789012345678',
    timestamp: '2026-10-09T12:00:00Z',
    author: { username: 'bot' },
    content: 'GG',
  };
  const mockSession = `import { AppError } from '@/lib/http';
    export async function authenticated() {
      const state = globalThis.__socialBridgeState;
      if (!state.authenticated) throw new AppError('Inicia sesión para continuar.', 401);
      return { user: { id: 'fixture-user' }, db: {
        from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { username: 'fixture' }, error: null }) }) }) }),
        rpc: async () => { state.claims++; return { data: state.retry, error: null }; }
      } };
    }`;
  const globalState = globalThis as typeof globalThis & { __socialBridgeState?: typeof state };
  globalState.__socialBridgeState = state;
  const hooks = registerHooks({
    load(url, context, nextLoad) {
      if (url.startsWith('file:') && url.endsWith('.ts'))
        return {
          format: 'module',
          source: stripTypeScriptTypes(readFileSync(fileURLToPath(url), 'utf8'), {
            mode: 'transform',
          }),
          shortCircuit: true,
        };
      return nextLoad(url, context);
    },
    resolve(specifier, context, nextResolve) {
      let code: string | null = null;
      if (specifier === 'server-only') code = 'export {};';
      if (specifier === '@/lib/session') code = mockSession;
      if (specifier === 'next/cache')
        code = 'export const unstable_cache = (fn) => fn; export function revalidateTag() {}';
      if (specifier === 'next/server') code = 'export function after(fn) { return fn(); }';
      if (code)
        return { url: `data:text/javascript,${encodeURIComponent(code)}`, shortCircuit: true };
      if (specifier.startsWith('@/')) {
        return {
          url: pathToFileURL(resolve('src', `${specifier.slice(2)}.ts`)).href,
          shortCircuit: true,
        };
      }
      if (
        specifier.startsWith('.') &&
        context.parentURL?.startsWith('file:') &&
        !/\.[a-z]+$/.test(specifier)
      ) {
        const file = fileURLToPath(new URL(`${specifier}.ts`, context.parentURL));
        if (existsSync(file)) return { url: pathToFileURL(file).href, shortCircuit: true };
      }
      return nextResolve(specifier, context);
    },
  });
  const originalFetch = globalThis.fetch;
  const previous = {
    token: process.env.DISCORD_BOT_TOKEN,
    channel: process.env.DISCORD_CHANNEL_ID,
    webhook: process.env.DISCORD_WEBHOOK_URL,
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
  };
  process.env.NEXT_PUBLIC_APP_URL = 'https://savestate.test';
  process.env.DISCORD_BOT_TOKEN = 'fixture-token';
  process.env.DISCORD_CHANNEL_ID = '123456789012345678';
  process.env.DISCORD_WEBHOOK_URL =
    'https://discord.com/api/webhooks/123456789012345678/fixture-token';
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.hostname === 'publish.twitter.com' || url.hostname === 'api.instagram.com') {
      assert.equal(url.searchParams.get('omit_script'), 'true');
      assert.equal(init?.redirect, 'error');
      return Response.json({
        html: '<blockquote><p>GG</p><script>bad()</script><a href="javascript:bad()">X</a></blockquote>',
      });
    }
    assert.equal(url.hostname, 'discord.com');
    if (state.status !== 200) return new Response(null, { status: state.status });
    if (init?.method === 'POST') {
      state.sends++;
      const body = JSON.parse(String(init.body));
      assert.deepEqual(body.allowed_mentions.parse, []);
      if (url.pathname.includes('/messages')) {
        assert.equal(body.content, '**[@fixture en Savestate]:** @everyone GG');
        return Response.json(fixture);
      }
      assert.equal(body.embeds[0].color, 0xffd700);
      assert.equal(url.searchParams.get('with_components'), 'true');
      assert.equal(url.searchParams.get('wait'), 'true');
      assert.equal(body.components[0].components[0].style, 5);
      assert.equal(body.components[0].components[0].url, 'https://savestate.test/');
      return new Response(null, { status: 204 });
    }
    return Response.json([fixture]);
  };
  try {
    const discord = await import('../../src/app/api/discord/messages/route.ts');
    const embeds = await import('../../src/app/api/embeds/oembed/route.ts');
    const checkpoint = await import('../../src/services/discord.ts');
    const request = (origin = 'https://savestate.test', content = '@everyone GG') =>
      new Request('https://savestate.test/api/discord/messages', {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
    state.authenticated = false;
    assert.equal((await discord.GET()).status, 401);
    assert.equal((await discord.POST(request())).status, 401);
    state.authenticated = true;
    assert.equal((await discord.POST(request('https://evil.test'))).status, 403);
    assert.equal(
      (await discord.POST(request('https://savestate.test', 'a'.repeat(501)))).status,
      400,
    );
    assert.equal(state.claims, 0);
    state.retry = 3;
    assert.equal((await discord.POST(request())).status, 429);
    assert.equal(state.sends, 0);
    state.retry = 0;
    assert.equal((await discord.POST(request())).status, 200);
    assert.equal(state.sends, 1);
    assert.equal((await discord.GET()).status, 200);
    state.status = 429;
    assert.equal((await discord.GET()).status, 429);
    state.status = 200;
    const embed = await embeds.GET(
      new Request(
        'https://savestate.test/api/embeds/oembed?url=https%3A%2F%2Fx.com%2Fplayer%2Fstatus%2F123',
      ),
    );
    assert.equal(embed.status, 200);
    assert.doesNotMatch((await embed.json()).html, /script|javascript:/);
    assert.equal(
      (
        await embeds.GET(
          new Request('https://savestate.test/api/embeds/oembed?url=http%3A%2F%2F127.0.0.1'),
        )
      ).status,
      400,
    );
    await checkpoint.notifyDiscordCheckpoint({
      type: 'platinum',
      username: 'fixture',
      details: 'GG',
    });
    assert.equal(state.sends, 2);
    await checkpoint.notifyDiscordCheckpoint({
      type: 'platinum',
      username: 'fixture',
      details: 'GG',
      path: '//evil.test',
    });
    assert.equal(state.sends, 3);
    const privateDb = {
      from(table: string) {
        const result = {
          error: null,
          data:
            table === 'profiles'
              ? { username: 'fixture', library_private: true }
              : table === 'user_games'
                ? { status: 'playing', games: { title: 'Private game' } }
                : [
                    {
                      id: 'log',
                      hours_played: 20,
                      console_progress: { kind: 'achievements', current: 10, total: 10 },
                    },
                  ],
        };
        const query = {
          select: () => query,
          eq: () => query,
          maybeSingle: async () => result,
          then: (resolve: (value: typeof result) => unknown) => Promise.resolve(resolve(result)),
        };
        return query;
      },
    } as unknown as Parameters<typeof checkpoint.notifyDiscordProgress>[0];
    const complete = { kind: 'achievements', current: 10, total: 10 };
    await checkpoint.notifyDiscordProgress(privateDb, 'fixture', 'entry', null, complete, 'log');
    await checkpoint.notifyDiscordProgress(
      privateDb,
      'fixture',
      'entry',
      complete,
      complete,
      'log',
    );
    assert.equal(state.sends, 3);
    delete process.env.DISCORD_WEBHOOK_URL;
    await checkpoint.notifyDiscordCheckpoint({
      type: 'platinum',
      username: 'fixture',
      details: 'GG',
    });
    assert.equal(state.sends, 3);
    delete process.env.DISCORD_BOT_TOKEN;
    assert.equal((await discord.POST(request())).status, 503);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries({
      DISCORD_BOT_TOKEN: previous.token,
      DISCORD_CHANNEL_ID: previous.channel,
      DISCORD_WEBHOOK_URL: previous.webhook,
      NEXT_PUBLIC_APP_URL: previous.appUrl,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    delete globalState.__socialBridgeState;
    hooks.deregister();
  }
});
