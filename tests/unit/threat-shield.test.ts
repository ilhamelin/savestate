import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import {
  recordIpAttempt,
  normalizeThreatIp,
  defconInput,
  quarantineInput,
  socRestriction,
  threatSnapshot,
  DEFAULT_AUTH_RATE_LIMIT,
  SOC_CACHE_TTL_MS,
  type ThreatShieldSnapshot,
  type ThreatSecurityEvent,
} from '../../src/domain/threat-shield.ts';
import type { ThreatShieldStore } from '../../src/services/threat-shield-store.ts';

const fixture =
  'data:text/javascript,' +
  encodeURIComponent(`
 import {AppError} from '@/lib/http';
 export const state={admin:false,user:null,authError:null,authCalls:0,signouts:0,shield:null,configured:false};
 export const threatShieldStore={};
 export const clearSystemSwitchCache=()=>{};
 export const configuredGateSecret=()=> 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
 export const isConfigured=()=>state.configured;
 export const publicEnv=()=>({url:'https://example.supabase.co',key:'anon'});
 export const getSystemSwitches=async()=>({gatekeeper_enabled:false});
 export async function authenticatedAdmin(){if(!state.admin)throw new AppError('Denied',403);return {id:'operator-immutable-id'};}
 export async function serverClient(){return {auth:{
   async signInWithPassword(){state.authCalls++;return {data:{user:state.user},error:state.authError};},
   async signOut(){state.signouts++;}
 }};}
 export function createServerClient(){return {auth:{getUser:async()=>({data:{user:state.user},error:null}),getClaims:async()=>({data:{claims:{}},error:null})}};}
 export const trustedThreatIp=(req)=>process.env.VERCEL==='1'?req.headers.get('x-vercel-forwarded-for'):null;
 export const refreshThreatShieldSnapshot=(...args)=>state.shield.sync(...args);
 export const setDefconLevel=(...args)=>state.shield.setDefconLevel(...args);
 export const changeQuarantine=(...args)=>state.shield.changeQuarantine(...args);
 export const getSocTelemetryReport=()=>state.shield.getSocTelemetryReport();
 export const claimSocAuthSlot=(...args)=>state.shield.claimAuthSlot(...args);
 export const registerFailedAuthAttempt=(...args)=>state.shield.registerFailedAuthAttempt(...args);
 export const threatQuarantineResponse=(ip)=>ip&&state.shield.isIpBlocked(ip)?Response.json({error:'Quarantine'},{status:429,headers:{'Cache-Control':'private, no-store'}}):null;
 export class NextResponse extends Response {
   cookies={set(){},delete(){}};
   static next(){return new NextResponse(null);}
   static json(data,init){return new NextResponse(JSON.stringify(data),init);}
   static redirect(url){return new NextResponse(null,{status:307,headers:{location:String(url)}});}
 }
`);
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'server-only')
      return { url: 'data:text/javascript,export {};', shortCircuit: true };
    if (
      [
        '@/services/threat-shield-store',
        '@/services/system-state',
        '@/services/gatekeeper',
        '@/lib/session',
        '@/integrations/supabase/server',
        '@/lib/env',
        '@supabase/ssr',
        'next/server',
      ].includes(specifier)
    )
      return { url: fixture, shortCircuit: true };
    if (
      specifier === '@/services/threat-shield-service' &&
      !context.parentURL?.endsWith('/src/services/threat-shield-service.ts')
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
    if (url.startsWith('file:') && url.endsWith('.ts') && !url.includes('node_modules'))
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
test.after(() => hooks.deregister());
const { createThreatShield, trustedThreatIp } =
  await import('../../src/services/threat-shield-service.ts');
const { state } = await import(fixture);
const snapshot = (): ThreatShieldSnapshot => ({
  level: 5,
  updatedAt: new Date(0).toISOString(),
  updatedBy: null,
  reason: 'Initial',
  registrationsOpen: true,
  gatekeeperEnabled: false,
  quarantinedIps: [],
});
function backend() {
  let now = Date.parse('2026-10-24T12:00:00Z'),
    reads = 0,
    failures = 0,
    claims = 0,
    unavailable = false;
  const current = snapshot(),
    histories = new Map<string, number[]>(),
    events: ThreatSecurityEvent[] = [];
  const store: ThreatShieldStore = {
    async snapshot() {
      reads++;
      if (unavailable) throw new Error('backend unavailable');
      return structuredClone(current);
    },
    async claimAuth() {
      claims++;
      return claims <= 5;
    },
    async fail(ip, reason) {
      failures++;
      if (unavailable) throw new Error('backend unavailable');
      const entry = current.quarantinedIps.find((q) => q.ip === ip && q.expiresAt > now);
      if (entry)
        return { quarantined: true, recentCount: entry.attempts, expiresAt: entry.expiresAt };
      const times = (histories.get(ip) ?? []).filter((t) => t > now - 60000);
      times.push(now);
      histories.set(ip, times);
      if (times.length >= 5) {
        current.quarantinedIps = current.quarantinedIps.filter((q) => q.ip !== ip);
        current.quarantinedIps.push({
          ip,
          reason,
          attempts: times.length,
          quarantinedAt: now,
          expiresAt: now + 900000,
        });
      }
      return {
        quarantined: times.length >= 5,
        recentCount: times.length,
        expiresAt: times.length >= 5 ? now + 900000 : null,
      };
    },
    async quarantine(ip, action, reason, actor) {
      if (unavailable) throw new Error('backend unavailable');
      current.quarantinedIps = current.quarantinedIps.filter((q) => q.ip !== ip);
      histories.delete(ip);
      if (action === 'block')
        current.quarantinedIps.push({
          ip,
          reason,
          attempts: 0,
          quarantinedAt: now,
          expiresAt: now + 900000,
        });
      events.push({
        id: String(events.length),
        event: 'soc_ip_' + action,
        severity: 'high',
        ip,
        actor_id: actor,
        metadata: { reason },
        created_at: new Date(now).toISOString(),
      });
    },
    async defcon(level, actor, reason) {
      if (unavailable) throw new Error('backend unavailable');
      current.level = level;
      current.updatedBy = actor;
      current.reason = reason;
      current.updatedAt = new Date(now).toISOString();
    },
    async telemetry() {
      return {
        snapshot: structuredClone(current),
        events: structuredClone(events),
        attacksBlockedToday: 0,
      };
    },
  };
  const create = () =>
    createThreatShield({
      store,
      now: () => now,
      clock: () => 1,
      ensureGateReady: () => {},
      invalidateSwitches: () => {},
    });
  return {
    store,
    current,
    create,
    events,
    advance: (ms: number) => {
      now += ms;
    },
    counts: () => ({ reads, failures, claims }),
    fail: () => {
      unavailable = true;
    },
  };
}
test('SOC sliding window excludes expired, future and invalid attempts without mutation', () => {
  const attempts = [0, 40000, 40001, 50000, 60000, 100001, NaN];
  const copy = [...attempts];
  assert.deepEqual(recordIpAttempt(attempts, 100000), { quarantined: false, recentCount: 4 });
  assert.deepEqual(attempts, copy);
  assert.equal(recordIpAttempt([99999, 99998, 99997, 99996], 100000).quarantined, true);
  assert.equal(
    recordIpAttempt([], 100000, { ...DEFAULT_AUTH_RATE_LIMIT, maxAttempts: 1 }).quarantined,
    true,
  );
  assert.throws(() => recordIpAttempt([], NaN));
  assert.throws(() => recordIpAttempt([], 1, { ...DEFAULT_AUTH_RATE_LIMIT, windowMs: 0 }));
});
test('SOC canonical IPs prevent aliases, CIDRs, hostnames and proxy-header spoofing', () => {
  assert.equal(normalizeThreatIp('2001:0db8:0:0:0:0:0:1'), '2001:db8::1');
  assert.equal(normalizeThreatIp('::ffff:192.0.2.1'), '192.0.2.1');
  for (const value of [
    '192.168.01.1',
    '256.0.0.1',
    '1.2.3.4/24',
    ' 1.2.3.4',
    'host.test',
    '::1%lo0',
    '1.2.3.4, 5.6.7.8',
    '[::1]',
  ])
    assert.equal(normalizeThreatIp(value), null);
  const prior = process.env.VERCEL;
  try {
    delete process.env.VERCEL;
    assert.equal(
      trustedThreatIp(
        new Request('https://example.test', { headers: { 'x-vercel-forwarded-for': '192.0.2.1' } }),
      ),
      null,
    );
    process.env.VERCEL = '1';
    assert.equal(
      trustedThreatIp(
        new Request('https://example.test', { headers: { 'x-forwarded-for': '192.0.2.1' } }),
      ),
      null,
    );
    assert.equal(
      trustedThreatIp(
        new Request('https://example.test', {
          headers: { 'x-vercel-forwarded-for': '2001:db8::1' },
        }),
      ),
      '2001:db8::1',
    );
  } finally {
    if (prior === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = prior;
  }
});
test('SOC validates critical confirmation, literal IPs and strict backend payloads', () => {
  assert.deepEqual(
    defconInput({ level: 3, reason: 'Emergency confirmed', confirmCritical: true }),
    { level: 3, reason: 'Emergency confirmed' },
  );
  for (const value of [0, 6, '1', NaN, null])
    assert.throws(() =>
      defconInput({ level: value, reason: 'Emergency confirmed', confirmCritical: true }),
    );
  assert.throws(() => defconInput({ level: 1, reason: 'Emergency confirmed' }));
  assert.throws(() => defconInput({ level: 5, reason: 'bad' }));
  assert.equal(quarantineInput({ action: 'unblock', ip: '::1' }).ip, '::1');
  assert.throws(() =>
    quarantineInput({ action: 'block', ip: 'example.com', reason: 'Manual block' }),
  );
  assert.equal(threatSnapshot(snapshot()).level, 5);
  assert.throws(() => threatSnapshot({ ...snapshot(), level: '5' }));
  assert.throws(() => threatSnapshot({ ...snapshot(), quarantinedIps: [{ ip: 'evil' }] }));
});
test('SOC policy enforces read-only, verified mutations and operator recovery', () => {
  assert.equal(socRestriction(5, '/api/vault', 'POST'), 'open');
  assert.equal(socRestriction(3, '/api/vault', 'POST'), 'verified');
  assert.equal(socRestriction(2, '/api/vault', 'POST'), 'readonly');
  assert.equal(socRestriction(2, '/api/cron/discord-freebies', 'GET'), 'readonly');
  assert.equal(socRestriction(2, '/explore', 'GET'), 'open');
  assert.equal(socRestriction(1, '/explore', 'GET'), 'operator');
  for (const path of [
    '/status',
    '/api/system-status',
    '/guardian',
    '/api/guardian/soc/defcon',
    '/api/auth/password',
    '/api/gatekeeper/verify',
  ])
    assert.equal(socRestriction(1, path, 'POST'), 'open');
  assert.equal(socRestriction(1, '/api/guardian-evil', 'POST'), 'readonly');
});
test('SOC fifth failure quarantines; sixth uses memory; expiry does not extend on denial', async () => {
  const b = backend(),
    shield = b.create(),
    ip = '192.0.2.1';
  for (let i = 0; i < 4; i++)
    assert.equal(
      (await shield.registerFailedAuthAttempt(ip, 'Invalid credentials')).quarantined,
      false,
    );
  assert.equal(
    (await shield.registerFailedAuthAttempt(ip, 'Invalid credentials')).quarantined,
    true,
  );
  const before = b.counts().failures;
  assert.equal(
    (await shield.registerFailedAuthAttempt(ip, 'Invalid credentials')).quarantined,
    true,
  );
  assert.equal(b.counts().failures, before);
  b.advance(900001);
  assert.equal(shield.isIpBlocked(ip), false);
});
test('SOC isolated serverless instances share authoritative failure counts and unblocks', async () => {
  const b = backend(),
    one = b.create(),
    two = b.create(),
    ip = '192.0.2.1';
  for (let i = 0; i < 3; i++) await one.registerFailedAuthAttempt(ip, 'Invalid credentials');
  for (let i = 0; i < 2; i++) await two.registerFailedAuthAttempt(ip, 'Invalid credentials');
  await one.sync();
  assert.equal(one.isIpBlocked(ip), true);
  await two.changeQuarantine(ip, 'unblock', 'Operator recovery', 'operator');
  b.advance(SOC_CACHE_TTL_MS + 1);
  await one.sync();
  assert.equal(one.isIpBlocked(ip), false);
  assert.equal((await one.registerFailedAuthAttempt(ip, 'Invalid credentials')).recentCount, 1);
  assert.equal(b.events[0]?.actor_id, 'operator');
});
test('SOC snapshot TTL, single-flight and returned clones isolate caller mutations', async () => {
  const b = backend(),
    shield = b.create();
  const values = await Promise.all([shield.sync(), shield.sync(), shield.sync()]);
  assert.equal(b.counts().reads, 1);
  values[0]!.level = 1;
  assert.equal((await shield.sync()).level, 5);
  assert.equal(b.counts().reads, 1);
  b.advance(3000);
  await shield.sync();
  assert.equal(b.counts().reads, 2);
  b.fail();
  b.advance(3001);
  await assert.rejects(shield.sync(), /unavailable/);
});
test('SOC failed policy writes do not announce success; lockdown validates TOTP setup first', async () => {
  const b = backend(),
    shield = b.create();
  await shield.sync();
  b.fail();
  await assert.rejects(shield.setDefconLevel(2, 'operator', 'Emergency response'), /unavailable/);
  assert.equal(b.current.level, 5);
  const fresh = backend();
  const noSeed = createThreatShield({
    store: fresh.store,
    ensureGateReady: () => {
      throw new Error('Missing seed');
    },
    invalidateSwitches: () => {},
  });
  await assert.rejects(noSeed.setDefconLevel(1, 'operator', 'Emergency response'), /Missing seed/);
  assert.equal(fresh.current.level, 5);
  await assert.rejects(
    shield.registerFailedAuthAttempt('192.0.2.1', 'Invalid credentials'),
    /unavailable/,
  );
});
test('SOC auth throttling starts at DEFCON 4 and reports honest scoped telemetry', async () => {
  const b = backend(),
    shield = b.create();
  for (let i = 0; i < 7; i++) await shield.claimAuthSlot(5, '192.0.2.1');
  assert.equal(b.counts().claims, 0);
  for (let i = 0; i < 5; i++) await shield.claimAuthSlot(4, '192.0.2.1');
  await assert.rejects(shield.claimAuthSlot(4, '192.0.2.1'), /Límite/);
  await shield.changeQuarantine('192.0.2.1', 'block', 'Manual incident', 'operator');
  const report = await shield.getSocTelemetryReport();
  assert.equal(report.counterScope, 'automatic_quarantines_utc');
  assert.equal(report.attacksBlockedToday, 0);
  assert.equal(report.decisionLatencyMs, null);
  assert.equal(report.quarantinedCount, 1);
  report.quarantinedIps.length = 0;
  report.recentThreats.length = 0;
  assert.equal((await shield.getSocTelemetryReport()).quarantinedCount, 1);
  assert.equal(b.events.length, 1);
});
test('SOC administrative routes authenticate, enforce same origin and bind immutable operator ID', async () => {
  const b = backend();
  state.shield = b.create();
  state.admin = false;
  const telemetry = await import('../../src/app/api/guardian/soc/telemetry/route.ts');
  const defcon = await import('../../src/app/api/guardian/soc/defcon/route.ts');
  const quarantine = await import('../../src/app/api/guardian/soc/quarantine/route.ts');
  const request = (data: unknown, origin = 'https://example.test') =>
    new Request('https://example.test/api/guardian/soc/defcon', {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json' },
      body: JSON.stringify(data),
    });
  assert.equal((await telemetry.GET()).status, 403);
  assert.equal((await defcon.POST(request({ level: 5, reason: 'Normal operation' }))).status, 403);
  state.admin = true;
  assert.equal(
    (
      await defcon.POST(
        request(
          { level: 2, reason: 'Emergency response', confirmCritical: true },
          'https://evil.test',
        ),
      )
    ).status,
    403,
  );
  assert.equal(
    (await defcon.POST(request({ level: 2, reason: 'Emergency response' }))).status,
    400,
  );
  assert.equal(
    (
      await defcon.POST(
        request({
          level: 3,
          reason: 'Emergency response',
          confirmCritical: true,
          operatorId: 'forged',
        }),
      )
    ).status,
    200,
  );
  assert.equal(b.current.updatedBy, 'operator-immutable-id');
  const response = await telemetry.GET();
  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control')!, /private.*no-store/);
  assert.equal(
    (
      await quarantine.POST(
        request({ action: 'block', ip: '192.0.2.2', reason: 'Manual incident' }),
      )
    ).status,
    200,
  );
  assert.equal(b.events[0]?.actor_id, 'operator-immutable-id');
  b.fail();
  assert.equal((await defcon.POST(request({ level: 5, reason: 'Restore normal' }))).status, 500);
  assert.equal(b.current.level, 3);
});
test('Password route counts only invalid credentials and rejects cached quarantines before auth I/O', async () => {
  const b = backend();
  state.shield = b.create();
  state.authCalls = 0;
  state.user = null;
  const prior = process.env.VERCEL;
  process.env.VERCEL = '1';
  const password = await import('../../src/app/api/auth/password/route.ts');
  const request = (origin = 'https://example.test') =>
    new Request('https://example.test/api/auth/password', {
      method: 'POST',
      headers: {
        origin,
        'content-type': 'application/json',
        'x-vercel-forwarded-for': '192.0.2.3',
      },
      body: JSON.stringify({ email: 'user@example.test', password: 'wrong' }),
    });
  try {
    state.authError = { code: 'unexpected_failure', status: 503 };
    assert.equal((await password.POST(request())).status, 503);
    assert.equal(b.counts().failures, 0);
    state.authError = { code: 'invalid_credentials', status: 400 };
    assert.equal((await password.POST(request('https://evil.test'))).status, 403);
    assert.equal(b.counts().failures, 0);
    for (let i = 0; i < 4; i++) assert.equal((await password.POST(request())).status, 401);
    assert.equal((await password.POST(request())).status, 429);
    const before = state.authCalls;
    assert.equal((await password.POST(request())).status, 429);
    assert.equal(state.authCalls, before);
  } finally {
    if (prior === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = prior;
  }
});
test('Password route returns no tokens and rejects non-operator login during lockdown', async () => {
  const b = backend();
  state.shield = b.create();
  state.authError = null;
  state.user = { id: 'ordinary', email: 'user@example.test', email_confirmed_at: '2026-01-01' };
  state.signouts = 0;
  const route = await import('../../src/app/api/auth/password/route.ts');
  const request = () =>
    new Request('https://example.test/api/auth/password', {
      method: 'POST',
      headers: { origin: 'https://example.test', 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.test', password: 'valid' }),
    });
  const response = await route.POST(request());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true });
  await state.shield.setDefconLevel(1, 'operator', 'Emergency response');
  assert.equal((await route.POST(request())).status, 403);
  assert.equal(state.signouts, 1);
});
test('Proxy blocks cached IPs before session work and enforces critical read/write boundaries', async () => {
  const b = backend();
  state.shield = b.create();
  state.configured = false;
  state.user = null;
  const { proxy } = await import('../../src/proxy.ts');
  const prior = process.env.VERCEL;
  process.env.VERCEL = '1';
  const request = (path: string, method = 'GET', token?: string) => {
    const r = new Request('https://example.test' + path, {
      method,
      headers: { 'x-vercel-forwarded-for': '192.0.2.9' },
    });
    return Object.assign(r, {
      nextUrl: new URL(r.url),
      cookies: { get: () => (token ? { value: token } : undefined), getAll: () => [], set() {} },
    }) as unknown as Parameters<typeof proxy>[0];
  };
  try {
    await state.shield.changeQuarantine('192.0.2.9', 'block', 'Manual incident', 'operator');
    const before = b.counts().reads;
    assert.equal((await proxy(request('/explore'))).status, 429);
    assert.equal(b.counts().reads, before);
    await state.shield.changeQuarantine('192.0.2.9', 'unblock', 'Recovery confirmed', 'operator');
    await state.shield.setDefconLevel(2, 'operator', 'Emergency response');
    assert.equal((await proxy(request('/api/vault', 'POST'))).status, 503);
    assert.equal((await proxy(request('/api/cron/discord-freebies'))).status, 503);
    assert.equal((await proxy(request('/explore'))).status, 200);
    await state.shield.setDefconLevel(3, 'operator', 'Emergency response');
    assert.equal((await proxy(request('/api/vault', 'POST'))).status, 403);
    state.user = { id: 'member', email: 'member@example.test', email_confirmed_at: '2026-01-01' };
    assert.equal((await proxy(request('/api/vault', 'POST'))).status, 200);
    await state.shield.setDefconLevel(1, 'operator', 'Emergency response');
    b.current.updatedAt = new Date(Date.now() - 1000).toISOString();
    assert.equal((await proxy(request('/explore'))).status, 403);
    assert.equal((await proxy(request('/status'))).status, 200);
    state.user = {
      id: 'operator',
      email: 'benjaigancioreyes56@gmail.com',
      email_confirmed_at: '2026-01-01',
    };
    const { createGatePass } = await import('../../src/domain/gatekeeper.ts');
    const seed = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
      oldSecret = process.env.GATEKEEPER_SECRET;
    process.env.GATEKEEPER_SECRET = seed;
    try {
      assert.equal((await proxy(request('/explore'))).status, 307);
      const guest = await createGatePass(seed);
      assert.equal((await proxy(request('/explore', 'GET', guest))).status, 307);
      const token = await createGatePass(seed, Date.now(), 'operator');
      assert.equal((await proxy(request('/explore', 'GET', token))).status, 200);
    } finally {
      if (oldSecret === undefined) delete process.env.GATEKEEPER_SECRET;
      else process.env.GATEKEEPER_SECRET = oldSecret;
    }
  } finally {
    if (prior === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = prior;
  }
});
