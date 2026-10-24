import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const fixture =
  'data:text/javascript,' +
  encodeURIComponent(
    "import {AppError} from '@/lib/http';" +
      'export const state={admin:false,limited:false,writes:0,reads:0,input:null,event:null};' +
      "export async function authenticatedAdmin(){if(!state.admin)throw new AppError('Forbidden',403);return{id:'admin'};}" +
      "export async function currentViewerProfile(){return{username:'verified_player'};}" +
      "export async function claimSupportAttempt(){if(state.limited)throw new AppError('Limited',429);}" +
      'export const supportStore={record:async e=>{state.event=e;state.writes++;},events:async()=>{state.reads++;return[];},list:async()=>[]};' +
      "export async function createSupportTicket(input){state.input=input;state.writes++;return{ticketId:'LOCAL-test',status:'queued'};}" +
      'export async function getSystemHealthReport(){return {overall:"operational",services:[]};}' +
      'export async function supportDashboard(){state.reads++;return{tickets:[]};}' +
      'export async function retrySupportQueue(){state.writes++;return{processed:0};}',
  );
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'server-only')
      return { url: 'data:text/javascript,export {};', shortCircuit: true };
    if (
      specifier === '@/lib/session' ||
      (context.parentURL?.includes('/route.ts') &&
        [
          '@/services/support-store',
          '@/services/jira-support-service',
          '@/services/dependency-monitor-service',
        ].includes(specifier))
    )
      return { url: fixture, shortCircuit: true };
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
const { state } = await import(fixture);
const tickets = await import('../../src/app/api/support/tickets/route.ts');
const telemetry = await import('../../src/app/api/telemetry/errors/route.ts');
const cron = await import('../../src/app/api/cron/jira-support/route.ts');
test.after(() => hooks.deregister());
function request(path: string, data: unknown, origin = 'https://savestate.test') {
  return new Request('https://savestate.test' + path, {
    method: 'POST',
    headers: { origin, host: 'savestate.test', 'content-type': 'application/json' },
    body: JSON.stringify(data),
  });
}
const valid = {
  type: 'bug',
  title: 'Error al guardar',
  description: 'El progreso no se guarda.',
  pageUrl: '/library',
};
test('Support and telemetry GETs require the verified operator and never read storage before authorization', async () => {
  state.admin = false;
  const reads = state.reads;
  for (const route of [tickets, telemetry]) {
    const response = await route.GET();
    assert.equal(response.status, 403);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
  assert.equal(state.reads, reads);
  state.admin = true;
  assert.equal((await tickets.GET()).status, 200);
  const response = await telemetry.GET();
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
});
test('Support endpoint rejects cross-origin, malformed, oversized and rate-limited reports without writes', async () => {
  const before = state.writes;
  assert.equal(
    (await tickets.POST(request('/api/support/tickets', valid, 'https://evil.test'))).status,
    403,
  );
  assert.equal(
    (await tickets.POST(request('/api/support/tickets', { ...valid, title: 'no' }))).status,
    400,
  );
  const oversized = request('/api/support/tickets', { ...valid, description: 'x'.repeat(25000) });
  assert.equal((await tickets.POST(oversized)).status, 413);
  const nonJson = new Request('https://savestate.test/api/support/tickets', {
    method: 'POST',
    headers: { origin: 'https://savestate.test', host: 'savestate.test' },
    body: '{}',
  });
  assert.equal((await tickets.POST(nonJson)).status, 415);
  state.limited = true;
  assert.equal((await tickets.POST(request('/api/support/tickets', valid))).status, 429);
  state.limited = false;
  assert.equal(state.writes, before);
});
test('Support endpoint sanitizes HTML and uses the verified username instead of a forged body value', async () => {
  const response = await tickets.POST(
    request('/api/support/tickets', {
      ...valid,
      title: '<img src=x onerror=alert(1)>Error al guardar',
      username: 'supreme_admin',
    }),
  );
  assert.equal(response.status, 202);
  assert.equal(state.input.username, 'verified_player');
  assert.equal(state.input.title, 'Error al guardar');
  assert.equal((await response.json()).data.status, 'queued');
});
test('Telemetry ingestion ignores forged user identity and escalation flags; all operator actions are protected', async () => {
  const response = await telemetry.POST(
    request('/api/telemetry/errors', {
      message: 'Failure user@example.com',
      pathname: '/library?token=secret',
      userAgent: 'Browser',
      userId: 'admin',
      escalatedToJira: true,
    }),
  );
  assert.equal(response.status, 204);
  assert.equal(state.event.userId, null);
  assert.equal(state.event.escalatedToJira, false);
  assert.equal(state.event.pathname, '/library');
  const before = state.writes;
  state.admin = false;
  for (const action of ['retry', 'escalate'])
    assert.equal(
      (await telemetry.POST(request('/api/telemetry/errors', { action, id: crypto.randomUUID() })))
        .status,
      403,
    );
  assert.equal(state.writes, before);
  state.admin = true;
  assert.equal(
    (await telemetry.POST(request('/api/telemetry/errors', { action: 'retry' }))).status,
    200,
  );
  assert.equal(
    (await telemetry.POST(request('/api/telemetry/errors', { action: 'escalate', id: 'invalid' })))
      .status,
    400,
  );
  assert.equal(
    (await telemetry.POST(request('/api/telemetry/errors', { action: 'override' }))).status,
    400,
  );
});
test('The queue cron fails closed without the configured bearer secret', async () => {
  const previous = process.env.CRON_SECRET;
  try {
    delete process.env.CRON_SECRET;
    assert.equal(
      (await cron.GET(new Request('https://savestate.test/api/cron/jira-support'))).status,
      503,
    );
    process.env.CRON_SECRET = 'x'.repeat(32);
    assert.equal(
      (await cron.GET(new Request('https://savestate.test/api/cron/jira-support'))).status,
      401,
    );
    assert.equal(
      (
        await cron.GET(
          new Request('https://savestate.test/api/cron/jira-support', {
            headers: { authorization: 'Bearer ' + process.env.CRON_SECRET },
          }),
        )
      ).status,
      200,
    );
  } finally {
    if (previous === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
  }
});
