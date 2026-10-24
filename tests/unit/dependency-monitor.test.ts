import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import {
  DEPENDENCY_SERVICE_IDS,
  DEPENDENCY_CACHE_TTL_MS,
  evaluateHealthStatus,
  computeOverallHealth,
  dependencyIncident,
  knownDependencyFailure,
  type DependencyHealthCheck,
} from '../../src/domain/dependency-monitor.ts';
import { gatekeeperExempt } from '../../src/domain/gatekeeper.ts';
const configFixture =
  'data:text/javascript,' +
  encodeURIComponent(`
  export const jiraConfig=()=>({portalUrl:'https://portal.test'});
  export const cachedTwitchAccessToken=()=>null;
    export const twitchAccessToken=async()=>{throw new Error('Unexpected OAuth request');};
`);
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'server-only')
      return { url: 'data:text/javascript,export {};', shortCircuit: true };
    if (['@/services/jira-support-service', '@/integrations/igdb/server'].includes(specifier))
      return { url: configFixture, shortCircuit: true };
    if (specifier.startsWith('@/')) {
      const path = resolve('src', specifier.slice(2));
      return {
        url: pathToFileURL(existsSync(path + '.ts') ? path + '.ts' : path + '.tsx').href,
        shortCircuit: true,
      };
    }
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
const { createDependencyMonitor } =
  await import('../../src/services/dependency-monitor-service.ts');
test.after(() => hooks.deregister());
const makeService = (
  id: DependencyHealthCheck['id'],
  status: DependencyHealthCheck['status'] = 'operational',
): DependencyHealthCheck => ({
  id,
  status,
  name: id,
  category: 'infrastructure',
  latencyMs: 20,
  lastCheckedAt: '2026-10-23T00:00:00Z',
  message: 'OK',
  endpointPreview: 'Public endpoint',
});
test('Health boundaries, custom latency thresholds and invalid readings are deterministic', () => {
  assert.equal(evaluateHealthStatus(999, false, false), 'operational');
  assert.equal(evaluateHealthStatus(1000, false, false), 'degraded');
  assert.equal(evaluateHealthStatus(50, true, false), 'down');
  assert.equal(evaluateHealthStatus(50, false, true), 'down');
  assert.equal(evaluateHealthStatus(3500, false, false), 'degraded');
  assert.equal(
    evaluateHealthStatus(200, false, false, { degradedLatencyMs: 100, downLatencyMs: 500 }),
    'degraded',
  );
  for (const latency of [NaN, Infinity, -1])
    assert.equal(evaluateHealthStatus(latency, false, false), 'down');
});
test('Core database failures take priority; peripheral outages degrade and missing configuration is explicit', () => {
  const services = DEPENDENCY_SERVICE_IDS.map((id) => makeService(id));
  assert.equal(computeOverallHealth(services), 'operational');
  assert.equal(
    computeOverallHealth([...services.slice(1), makeService('supabase', 'down')]),
    'down',
  );
  assert.equal(
    computeOverallHealth([makeService('supabase'), makeService('steam', 'down')]),
    'degraded',
  );
  assert.equal(
    computeOverallHealth([makeService('supabase'), makeService('igdb', 'maintenance')]),
    'degraded',
  );
  assert.equal(computeOverallHealth([makeService('supabase', 'maintenance')]), 'maintenance');
  assert.equal(computeOverallHealth([]), 'maintenance');
});
function fixture(timeoutMs = 2000) {
  let clock = 1792713600000;
  const env: Record<string, string | undefined> = {
    NEXT_PUBLIC_SUPABASE_URL: 'https://private-project.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'private-anon',
    TWITCH_CLIENT_ID: 'private-client',
    TWITCH_CLIENT_SECRET: 'private-secret',
    JIRA_PORTAL_URL: 'https://portal.test',
  };
  const calls: { url: string; init?: RequestInit }[] = [];
  let active = 0,
    maximum = 0;
  let responder: (url: string, init?: RequestInit) => Promise<Response> = async (_url, init) =>
    init?.method === 'HEAD' ? new Response(null) : Response.json({});
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, init });
    active++;
    maximum = Math.max(maximum, active);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1));
      return await responder(url, init);
    } finally {
      active--;
    }
  };
  const read = createDependencyMonitor({
    fetcher,
    now: () => clock,
    env: () => env,
    twitchToken: () => 'private-bearer',
    portal: () => env.JIRA_PORTAL_URL!,
    timeoutMs,
  });
  return {
    read,
    env,
    calls,
    advance(ms: number) {
      clock += ms;
    },
    maximum: () => maximum,
    respond(fn: typeof responder) {
      responder = fn;
    },
  };
}
test('Six probes run concurrently, coalesce requests and cache isolated copies for exactly thirty seconds', async () => {
  const state = fixture();
  const reports = await Promise.all(Array.from({ length: 8 }, () => state.read()));
  assert.equal(state.calls.length, 5);
  assert.equal(state.maximum(), 5);
  assert.deepEqual(
    reports[0]!.services.map((item) => item.id),
    [...DEPENDENCY_SERVICE_IDS],
  );
  assert.equal(reports[0]!.operationalCount, 6);
  reports[0]!.services[0]!.message = 'Mutated';
  assert.notEqual((await state.read()).services[0]!.message, 'Mutated');
  state.advance(DEPENDENCY_CACHE_TTL_MS - 1);
  await state.read();
  assert.equal(state.calls.length, 5);
  state.advance(1);
  await state.read();
  assert.equal(state.calls.length, 10);
});
test('Forced probes bypass fresh cache, coalesce concurrent refreshes and react to configuration rotation', async () => {
  const state = fixture();
  await state.read();
  await Promise.all([state.read(true), state.read(true), state.read(true)]);
  assert.equal(state.calls.length, 10);
  state.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'rotated';
  await state.read();
  assert.equal(state.calls.length, 15);
});
test('Public reports exclude tokens, project origins and exception details; probes never write', async () => {
  const state = fixture();
  const report = await state.read();
  assert.doesNotMatch(JSON.stringify(report), /private-|portal.test|supabase.co/);
  for (const call of state.calls) {
    assert.ok(call.init?.signal instanceof AbortSignal);
    assert.ok(!call.init?.method || ['GET', 'HEAD'].includes(call.init.method));
    assert.equal(call.init?.cache, 'no-store');
    const headers = new Headers(call.init?.headers);
    if (!call.url.includes('supabase.co')) assert.equal(headers.get('apikey'), null);
    if (call.url.includes('oauth2/validate'))
      assert.equal(headers.get('Authorization'), 'OAuth private-bearer');
    else assert.notEqual(headers.get('Authorization'), 'OAuth private-bearer');
  }
});
test(
  'Rejected and never-settling providers become bounded down readings without crashing other probes',
  { timeout: 1000 },
  async () => {
    const state = fixture(40);
    state.respond(async (url) => {
      if (url.includes('steampowered')) return new Promise<Response>(() => {});
      if (url.includes('discord')) throw new Error('private diagnostic');
      return new Response(null);
    });
    const start = performance.now();
    const report = await state.read();
    assert.ok(performance.now() - start < 500);
    assert.equal(report.overall, 'degraded');
    assert.equal(report.services.find((item) => item.id === 'steam')?.status, 'down');
    assert.equal(report.services.find((item) => item.id === 'steam')?.latencyMs, 40);
    assert.equal(report.outageCount, 2);
    assert.doesNotMatch(JSON.stringify(report), /private diagnostic/);
  },
);
test('Database HEAD errors mark the overall system down while failed peripheral probes remain independent', async () => {
  const state = fixture();
  state.respond(
    async (url) => new Response(null, { status: url.includes('supabase.co') ? 503 : 200 }),
  );
  assert.equal((await state.read()).overall, 'down');
});
test('Unconfigured services are unmeasured, not fake successes, and monitoring never creates OAuth tokens', async () => {
  const calls: string[] = [];
  const read = createDependencyMonitor({
    env: () => ({}),
    fetcher: async (url) => {
      calls.push(String(url));
      return new Response(null);
    },
    twitchToken: () => null,
  });
  const report = await read();
  assert.equal(report.services.find((item) => item.id === 'supabase')?.status, 'maintenance');
  assert.equal(report.services.find((item) => item.id === 'igdb')?.status, 'maintenance');
  assert.ok(calls.every((url) => !url.includes('oauth2')));
});
test('Context alerts and Jira firewall identify only explicit outages; generic errors and user reports remain actionable', async () => {
  const state = fixture();
  state.respond(
    async (url) => new Response(null, { status: url.includes('steampowered') ? 503 : 200 }),
  );
  const report = await state.read();
  assert.equal(dependencyIncident(report, 'steam')?.status, 'down');
  assert.equal(dependencyIncident(report, 'discord'), null);
  assert.equal(dependencyIncident(null), null);
  assert.equal(knownDependencyFailure('Steam API unavailable 503', report), 'steam');
  assert.equal(knownDependencyFailure('Failed to fetch', report), null);
  assert.equal(knownDependencyFailure('Steam UI render exception', report), null);
  assert.equal(knownDependencyFailure('Discord unavailable', report), null);
});
test('Public diagnostics remain exempt from access lock; Guardian probes retain admin authorization', () => {
  assert.equal(gatekeeperExempt('/status'), true);
  assert.equal(gatekeeperExempt('/api/system-status'), true);
  assert.equal(gatekeeperExempt('/status/private'), false);
  const proxy = readFileSync('src/proxy.ts', 'utf8');
  assert.match(proxy, /pathname !== '\/status'/);
  assert.match(proxy, /pathname !== '\/api\/system-status'/);
  const layout = readFileSync('src/app/layout.tsx', 'utf8');
  assert.match(layout, /publicStatus \? Promise.resolve\(null\) : currentUser\(\)/);
});
test('Status API survives database failures; manual probe requires admin and same-origin and enforces cooldown', async () => {
  const fixtureUrl =
    'data:text/javascript,' +
    encodeURIComponent(`
    import {AppError} from '@/lib/http';
    export const state={admin:false,fail:true,calls:[],escalations:0};
    export async function authenticatedAdmin(){if(!state.admin)throw new AppError('Denied',403);}
    export async function getSystemSwitches(){if(state.fail)throw new Error('private db');return {double_xp:false};}
    export async function getActiveSystemBroadcast(){if(state.fail)throw new Error('private db');return null;}
    export async function getSystemHealthReport(force){state.calls.push(force);return {overall:'degraded',services:[{id:'steam',status:'down'}]};}
    export const supportStore={events:async()=>[{id:'11111111-1111-4111-8111-111111111111',message:'Steam unavailable 503'}],list:async()=>[]};
    export async function claimSupportAttempt(){}
    export function sanitizeSupportTicket(raw){return raw;}
    export function sanitizeTelemetry(raw){return raw;}
    export async function createSupportTicket(){state.escalations++;return {};}
    export async function retrySupportQueue(){return {};}
  `);
  const routeHooks = registerHooks({
    resolve(specifier, context, next) {
      if (
        [
          '@/lib/session',
          '@/services/system-state',
          '@/services/dependency-monitor-service',
          '@/services/support-store',
          '@/services/support-sanitize',
          '@/services/jira-support-service',
        ].includes(specifier)
      )
        return { url: fixtureUrl, shortCircuit: true };
      return next(specifier, context);
    },
  });
  try {
    const { state } = await import(fixtureUrl);
    const status = await import('../../src/app/api/system-status/route.ts');
    const denied = await import('../../src/app/api/guardian/dependencies/probe/route.ts');
    const request = () =>
      new Request('http://localhost:3000/api/guardian/dependencies/probe', {
        method: 'POST',
        headers: { Origin: 'http://localhost:3000' },
      });
    const publicResponse = await status.GET();
    assert.equal(publicResponse.status, 200);
    assert.match(publicResponse.headers.get('Cache-Control')!, /no-store/);
    const publicData = await publicResponse.json();
    assert.equal(publicData.switches, null);
    assert.equal(publicData.stateAvailable, false);
    assert.equal(publicData.health.overall, 'degraded');
    const before = state.calls.length;
    assert.equal((await denied.POST(request())).status, 403);
    assert.equal(state.calls.length, before);
    state.admin = true;
    assert.equal(
      (
        await denied.POST(
          new Request('http://localhost:3000/api/guardian/dependencies/probe', {
            method: 'POST',
            headers: { Origin: 'https://evil.test' },
          }),
        )
      ).status,
      403,
    );
    assert.equal((await denied.POST(request())).status, 200);
    assert.equal(state.calls.at(-1), true);
    assert.equal((await denied.POST(request())).status, 429);
    const telemetry = await import('../../src/app/api/telemetry/errors/route.ts');
    const escalation = await telemetry.POST(
      new Request('http://localhost:3000/api/telemetry/errors', {
        method: 'POST',
        headers: { Origin: 'http://localhost:3000', 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'escalate', id: '11111111-1111-4111-8111-111111111111' }),
      }),
    );
    assert.equal(escalation.status, 409);
    assert.equal(state.escalations, 0);
    const { supportStore } = await import(fixtureUrl);
    assert.equal((await supportStore.events()).length, 1);
  } finally {
    routeHooks.deregister();
  }
});

test('Cold serverless instances validate configured Twitch credentials without requiring a catalogue visit', async () => {
  let authorizations = 0;
  const read = createDependencyMonitor({
    env: () => ({ TWITCH_CLIENT_ID: 'client', TWITCH_CLIENT_SECRET: 'secret' }),
    twitchToken: () => null,
    async authorizeTwitch(signal) { assert.ok(signal instanceof AbortSignal); authorizations++; return 'private-cold-token'; },
    fetcher: async (url, init) => {
      if (String(url).includes('oauth2/validate')) assert.equal(new Headers(init?.headers).get('Authorization'), 'OAuth private-cold-token');
      return new Response(null);
    },
  });
  const report = await read();
  await read();
  assert.equal(authorizations, 1);
  assert.equal(report.services.find((item) => item.id === 'igdb')?.status, 'operational');
  assert.doesNotMatch(JSON.stringify(report), /private-cold-token|secret/);
});
test('Cold OAuth authentication shares the probe deadline and cannot hold the report open', { timeout: 1000 }, async () => {
  let aborted = false;
  const read = createDependencyMonitor({
    env: () => ({ TWITCH_CLIENT_ID: 'client', TWITCH_CLIENT_SECRET: 'secret' }), twitchToken: () => null,
    authorizeTwitch: (signal) => new Promise<string>((_, reject) => signal.addEventListener('abort', () => { aborted = true; reject(new Error('Aborted')); }, { once: true })),
    fetcher: async () => new Response(null), timeoutMs: 25,
  });
  const report = await read();
  assert.equal(aborted, true);
  assert.equal(report.services.find((item) => item.id === 'igdb')?.status, 'down');
  assert.equal(report.services.find((item) => item.id === 'igdb')?.latencyMs, 25);
});
