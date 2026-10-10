import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

test('itch routes require session/origin, reject SSRF, enforce quota and preserve private edits', async () => {
  const id = '00000000-0000-4000-8000-000000000000';
  const state = {
    authenticated: true,
    owner: true,
    slot: true,
    notifications: 0,
    webhooks: 0,
    fetches: 0,
    row: {
      id,
      user_id: id,
      url: 'https://studio.itch.io/game',
      metadata: {
        id: '1',
        url: 'https://studio.itch.io/game',
        title: 'Indie',
        author: 'Studio',
        coverImage: null,
        tags: [],
        screenshots: [],
        devlog: null,
        devlogAvailable: true,
      },
      current_played_version: '1.0',
      status: 'playing',
      milestones: [],
      private_notes: 'private save',
      last_checked_at: '2026-10-08T12:00:00Z',
    },
  };
  const globalState = globalThis as typeof globalThis & { __itchState?: typeof state };
  globalState.__itchState = state;
  const adapter = `
    const state=globalThis.__itchState;
    export const db={
      from() { let update=null; const query={select(){return query},eq(){return query},order(){return query},limit(){return query},update(value){update=value;return query},maybeSingle:async()=>({data:state.owner?state.row:null,error:null}),single:async()=>{if(update)Object.assign(state.row,update);return {data:state.row,error:null}},then(resolve){return Promise.resolve(resolve({data:state.owner?[state.row]:[],error:null}))}};return query;},
      async rpc(name,args){if(name==='claim_itch_check')return {data:state.slot,error:null};const old=state.row.metadata.devlog?.url;state.row.metadata=args.p_metadata;const changed=old!==args.p_metadata.devlog?.url;if(changed)state.notifications++;return {data:changed,error:null}}
    };`;
  const hooks = registerHooks({
    load(url, context, next) {
      if (url.startsWith('file:') && url.endsWith('.ts'))
        return {
          format: 'module',
          source: stripTypeScriptTypes(readFileSync(fileURLToPath(url), 'utf8'), {
            mode: 'transform',
          }),
          shortCircuit: true,
        };
      return next(url, context);
    },
    resolve(specifier, context, next) {
      let code: string | null = null;
      if (specifier === 'server-only') code = 'export {};';
      if (specifier === 'next/cache') code = 'export function revalidatePath() {}';
      if (specifier === '@/services/discord')
        code =
          'export function scheduleDiscordCheckpoint(event){ if(event.username!=="itch.io" || event.details.includes("private save")) throw new Error("Private disclosure");globalThis.__itchState.webhooks++;}';
      if (specifier === '@supabase/supabase-js')
        code = adapter + 'export function createClient(){return db}';
      if (specifier === '@/lib/session')
        code =
          adapter +
          `import {AppError} from '@/lib/http';export async function authenticated(){if(!state.authenticated)throw new AppError('Session required',401);return {db,user:{id:'${id}'}}}`;
      if (code)
        return { url: 'data:text/javascript,' + encodeURIComponent(code), shortCircuit: true };
      if (specifier.startsWith('@/'))
        return {
          url: pathToFileURL(resolve('src', specifier.slice(2) + '.ts')).href,
          shortCircuit: true,
        };
      if (
        specifier.startsWith('.') &&
        context.parentURL?.startsWith('file:') &&
        !/\.[a-z]+$/.test(specifier)
      ) {
        const file = fileURLToPath(new URL(specifier + '.ts', context.parentURL));
        if (existsSync(file)) return { url: pathToFileURL(file).href, shortCircuit: true };
      }
      return next(specifier, context);
    },
  });
  const previousFetch = globalThis.fetch;
  const previous = {
    app: process.env.NEXT_PUBLIC_APP_URL,
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    admin: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
  process.env.NEXT_PUBLIC_APP_URL = 'https://savestate.test';
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://supabase.test';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'fixture';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'fixture';
  globalThis.fetch = async (input, options) => {
    const url = new URL(String(input));
    assert.equal(url.hostname, 'studio.itch.io');
    assert.equal(options?.redirect, 'error');
    state.fetches++;
    if (url.pathname.endsWith('data.json'))
      return Response.json({ id: 1, title: 'Indie', authors: [{ name: 'Studio' }] });
    return new Response(
      '<rss><item><title>Update 1.1</title><link>https://studio.itch.io/game/devlog/1/update</link><pubDate>Thu, 08 Oct 2026 12:00:00 GMT</pubDate></item></rss>',
    );
  };
  try {
    const inspect = await import('../../src/app/api/tracker/itch/inspect/route.ts');
    const check = await import('../../src/app/api/tracker/itch/check-updates/route.ts');
    const routes = await import('../../src/app/api/tracker/itch/route.ts');
    const request = (data: Record<string, unknown>, origin = 'https://savestate.test') =>
      new Request('https://savestate.test/api/tracker/itch', {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    state.authenticated = false;
    assert.equal((await inspect.POST(request({ url: state.row.url }))).status, 401);
    assert.equal((await routes.GET()).status, 401);
    state.authenticated = true;
    assert.equal(
      (await inspect.POST(request({ url: state.row.url }, 'https://evil.test'))).status,
      403,
    );
    assert.equal((await inspect.POST(request({ url: 'https://127.0.0.1/game' }))).status, 400);
    assert.equal(state.fetches, 0);
    const inspected = await inspect.POST(request({ url: state.row.url }));
    assert.equal(inspected.status, 200);
    assert.equal((await inspected.json()).data.devlog.version, '1.1');
    state.owner = false;
    assert.equal((await check.POST(request({ id }))).status, 404);
    state.owner = true;
    state.slot = false;
    assert.equal((await check.POST(request({ id }))).status, 429);
    state.slot = true;
    assert.equal((await check.POST(request({ id }))).status, 200);
    assert.equal(state.notifications, 1);
    assert.equal(state.webhooks, 1);
    assert.equal((await check.POST(request({ id }))).status, 200);
    assert.equal(state.notifications, 1);
    assert.equal(state.webhooks, 1);
    assert.equal(state.row.private_notes, 'private save');
    assert.equal(
      (
        await routes.POST(
          request({
            action: 'save',
            id,
            currentPlayedVersion: '1.1',
            status: 'completed',
            milestones: [],
            privateNotes: 'new private save',
          }),
        )
      ).status,
      200,
    );
    assert.equal(state.row.private_notes, 'new private save');
  } finally {
    hooks.deregister();
    globalThis.fetch = previousFetch;
    delete globalState.__itchState;
    for (const [key, value] of Object.entries({
      NEXT_PUBLIC_APP_URL: previous.app,
      NEXT_PUBLIC_SUPABASE_URL: previous.url,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: previous.key,
      SUPABASE_SERVICE_ROLE_KEY: previous.admin,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
