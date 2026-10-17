import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { gateCode, createGatePass } from '../../src/domain/gatekeeper.ts';

test('Guardian routes enforce verified admin, same origin, distributed limits and gate pass before page/API access', async () => {
  const fixture = `data:text/javascript,${encodeURIComponent(`
    export const state={user:null,profile:null,allowed:true,rateCalls:0,queries:[],audits:[],claimsEmail:'benjaigancioreyes56@gmail.com'};
    export const cache=fn=>fn;
    export const isConfigured=()=>true;
    export const publicEnv=()=>({url:'https://example.supabase.co',key:'anon-test'});
    const query={select(columns,opts){state.queries.push(columns);return opts?.head?Promise.resolve({error:null,count:1}):query;},eq(){return query;},maybeSingle(){return Promise.resolve({data:state.profile,error:null});},ilike(){return query;},order(){return query;},range(){return Promise.resolve({data:[{id:'owner',username:'ilhamelin_v2',level:1,created_at:'2026-10-16T00:00:00Z'}],count:1,error:null});}};
    query.insert=async(row)=>{state.audits.push(row);return {error:null};};
    const db={auth:{async getClaims(){return {data:{claims:state.user?{sub:state.user.id,email:state.claimsEmail}:{}},error:null};},async getUser(){return {data:{user:state.user},error:null};}},from(){return query;},async rpc(){state.rateCalls++;return {data:state.allowed,error:null};}};
    export const serverClient=async()=>db;
    export const createClient=()=>db;
    export const createServerClient=()=>db;
    export const getSystemSwitches=async()=>({gatekeeper_enabled:process.env.GATEKEEPER_ENABLED==='true',registrations_open:true,seasonal_theme:'halloween'});
  `)}`;
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      if (
        [
          '@/lib/env',
          '@/integrations/supabase/server',
          '@supabase/supabase-js',
          '@supabase/ssr',
          '@/services/system-state',
        ].includes(specifier)
      )
        return { url: fixture, shortCircuit: true };
      if (specifier === 'server-only')
        return { url: 'data:text/javascript,export {};', shortCircuit: true };
      if (specifier === 'next/server')
        return {
          url: pathToFileURL(resolve('node_modules/next/server.js')).href,
          shortCircuit: true,
        };
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
          source: stripTypeScriptTypes(readFileSync(fileURLToPath(url), 'utf8'), {
            mode: 'transform',
          }),
          shortCircuit: true,
        };
      return next(url, context);
    },
  });
  const variables = [
    'GATEKEEPER_SECRET',
    'GATEKEEPER_ENABLED',
    'ADMIN_EMAIL',
    'ADMIN_USER_ID',
    'SUPABASE_SERVICE_ROLE_KEY',
    'NEXT_PUBLIC_APP_URL',
  ] as const;
  const prior = Object.fromEntries(variables.map((key) => [key, process.env[key]]));
  const seed = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
  process.env.GATEKEEPER_SECRET = seed;
  process.env.ADMIN_EMAIL = 'benjaigancioreyes56@gmail.com';
  delete process.env.ADMIN_USER_ID;
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only';
  process.env.NEXT_PUBLIC_APP_URL = 'https://savestate.test';
  const request = (path: string, input: unknown = {}, origin = 'https://savestate.test') =>
    new Request(`https://savestate.test${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin },
      body: JSON.stringify(input),
    });
  try {
    const { state } = await import(fixture);
    const { currentAdmin } = await import('../../src/lib/session.ts');
    const { POST: enroll } = await import('../../src/app/api/guardian/enroll/route.ts');
    const { GET: directory } = await import('../../src/app/api/guardian/players/route.ts');
    const { POST: verify } = await import('../../src/app/api/gatekeeper/verify/route.ts');
    assert.equal(await currentAdmin(), null);
    assert.equal((await enroll(request('/api/guardian/enroll'))).status, 403);
    assert.equal(
      (await directory(new Request('https://savestate.test/api/guardian/players'))).status,
      403,
    );
    state.profile = { id: 'owner', username: 'ilhamelin_v2', level: 1 };
    state.user = { id: 'owner', email: 'attacker@example.com', email_confirmed_at: '2026-10-16' };
    assert.equal(await currentAdmin(), null); // Username and claimed metadata email are insufficient.
    state.user.email = 'benjaigancioreyes56@gmail.com';
    state.user.email_confirmed_at = null;
    assert.equal(await currentAdmin(), null);
    state.user.email_confirmed_at = '2026-10-16';
    assert.equal((await currentAdmin())?.id, 'owner');
    assert.equal(
      (await enroll(request('/api/guardian/enroll', {}, 'https://evil.example'))).status,
      403,
    );
    const enrollment = await enroll(request('/api/guardian/enroll'));
    assert.equal(enrollment.status, 200);
    assert.match(enrollment.headers.get('cache-control')!, /no-store/);
    assert.equal((await enrollment.json()).data.secret, seed);
    const players = await directory(
      new Request('https://savestate.test/api/guardian/players?q=ilhamelin'),
    );
    assert.equal(players.status, 200);
    assert.match(players.headers.get('cache-control')!, /no-store/);
    assert.equal((await players.json()).total, 1);
    assert.ok(
      state.queries.includes(
        'id,username,avatar_url,level,terminal_status,created_at,access_locked,access_locked_at',
      ),
    );
    const code = await gateCode(seed);
    assert.equal(
      (await verify(request('/api/gatekeeper/verify', { code }, 'https://evil.example'))).status,
      403,
    );
    state.allowed = false;
    assert.equal((await verify(request('/api/gatekeeper/verify', { code }))).status, 429);
    state.allowed = true;
    assert.equal(
      (await verify(request('/api/gatekeeper/verify', { code: 'not-six-digits' }))).status,
      401,
    );
    assert.equal(state.audits.at(-1).event, 'gatekeeper_invalid_code');
    assert.match(state.audits.at(-1).key_hash, /^[a-f0-9]{64}$/);
    assert.deepEqual(state.audits.at(-1).metadata, {});
    const passResponse = await verify(
      request('/api/gatekeeper/verify', { code, next: '//evil.example' }),
    );
    assert.equal(passResponse.status, 200);
    assert.equal((await passResponse.json()).redirect, '/library');
    const cookie = passResponse.headers.get('set-cookie')!;
    assert.match(cookie, /savestate_gate_pass=/);
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=lax/i);
    assert.match(cookie, /Max-Age=43200/i);
    const proxyModule = await import('../../src/proxy.ts');
    const { NextRequest } = await import('next/server.js');
    process.env.GATEKEEPER_ENABLED = 'false';
    const spoofedPath = await proxyModule.proxy(
      new NextRequest('https://savestate.test/library', { headers: { 'x-pathname': '/guardian' } }),
    );
    assert.equal(spoofedPath.headers.get('x-middleware-request-x-pathname'), '/library');
    assert.equal(
      (await proxyModule.proxy(new NextRequest('https://savestate.test/library'))).status,
      200,
    );
    // Per-account revocation remains enforced with the global switch disabled.
    const lockTime = new Date(Date.now() - 1000).toISOString();
    state.profile.access_locked = true;
    state.profile.access_locked_at = lockTime;
    assert.equal(
      (await proxyModule.proxy(new NextRequest('https://savestate.test/library'))).status,
      307,
    );
    assert.equal(
      (await proxyModule.proxy(new NextRequest('https://savestate.test/api/vault'))).status,
      401,
    );
    const old = await createGatePass(seed, Date.now() - 2000, 'owner');
    const other = await createGatePass(seed, Date.now(), 'another-user');
    for (const invalid of [old, other]) {
      const response = await proxyModule.proxy(
        new NextRequest('https://savestate.test/library', {
          headers: { cookie: `savestate_gate_pass=${invalid}` },
        }),
      );
      assert.equal(response.status, 307);
      assert.match(response.headers.get('set-cookie')!, /Max-Age=0|1970/);
    }
    const renewed = await verify(request('/api/gatekeeper/verify', { code: await gateCode(seed) }));
    assert.equal(renewed.status, 200);
    const renewedToken = renewed.headers.get('set-cookie')!.split(';')[0]!;
    assert.equal(
      (
        await proxyModule.proxy(
          new NextRequest('https://savestate.test/library', { headers: { cookie: renewedToken } }),
        )
      ).status,
      200,
    );
    // Acknowledging one device must not restore stale passes on other devices.
    state.profile.access_locked = false;
    assert.equal(
      (
        await proxyModule.proxy(
          new NextRequest('https://savestate.test/library', {
            headers: { cookie: `savestate_gate_pass=${old}` },
          }),
        )
      ).status,
      307,
    );
    state.profile.access_locked_at = null;
    process.env.GATEKEEPER_ENABLED = 'true';
    const gate = await proxyModule.proxy(new NextRequest('https://savestate.test/library?q=test'));
    assert.equal(gate.status, 307);
    assert.equal(
      new URL(gate.headers.get('location')!).searchParams.get('next'),
      '/library?q=test',
    );
    assert.equal(
      (await proxyModule.proxy(new NextRequest('https://savestate.test/api/vault'))).status,
      401,
    );
    for (const path of ['/guardian', '/login', '/api/guardian/players'])
      assert.equal(
        (await proxyModule.proxy(new NextRequest(`https://savestate.test${path}`))).status,
        200,
      );
    const pass = await createGatePass(seed);
    assert.equal(
      (
        await proxyModule.proxy(
          new NextRequest('https://savestate.test/library', {
            headers: { cookie: `savestate_gate_pass=${pass}` },
          }),
        )
      ).status,
      200,
    );
    delete process.env.GATEKEEPER_SECRET;
    assert.equal((await verify(request('/api/gatekeeper/verify', { code }))).status, 503);
    assert.equal(
      (await proxyModule.proxy(new NextRequest('https://savestate.test/library'))).status,
      307,
    );
  } finally {
    hooks.deregister();
    for (const key of variables) {
      if (prior[key] === undefined) delete process.env[key];
      else process.env[key] = prior[key];
    }
  }
});
