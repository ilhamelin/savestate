import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import {
  validateSupportTicket,
  validateTelemetry,
  redactTelemetry,
  supportPath,
  TelemetryRingBuffer,
  DEFAULT_JIRA_CONFIG,
  SUPPORT_TIMEOUT_MS,
  type SupportTicketRow,
  type SupportTicketInput,
} from '../../src/domain/support-ticket.ts';
import type { SupportStore } from '../../src/services/support-store.ts';

const valid = {
  type: 'bug',
  title: 'No carga la biblioteca',
  description: 'La biblioteca no termina de cargar.',
  pageUrl: 'https://savestate-eight.vercel.app/library?token=private#secret',
};
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'server-only')
      return { url: 'data:text/javascript,export {};', shortCircuit: true };
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
const { sanitizeSupportTicket, sanitizeTelemetry } =
  await import('../../src/services/support-sanitize.ts');
const {
  createSupportTicket,
  dispatchSupportTicket,
  portalTicketPayload,
  portalTicketResult,
  jiraConfig,
} = await import('../../src/services/jira-support-service.ts');
test.after(() => hooks.deregister());

function memoryStore(): SupportStore & { rows: SupportTicketRow[]; failSave: boolean } {
  return {
    rows: [],
    failSave: false,
    async save(input: SupportTicketInput, telemetryId?: string) {
      if (this.failSave) throw new Error('DB unavailable');
      const previous = this.rows.find((row) => telemetryId && row.telemetry_id === telemetryId);
      if (previous) return { ...previous };
      const row: SupportTicketRow = {
        id: crypto.randomUUID(),
        input,
        telemetry_id: telemetryId ?? null,
        status: 'queued',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        remote_id: null,
        jira_issue_key: null,
        attempts: 0,
        lease_token: null,
        locked_until: null,
        next_attempt_at: new Date().toISOString(),
      };
      this.rows.push(row);
      return { ...row };
    },
    async claim(id) {
      const row = this.rows.find((item) => item.id === id);
      if (!row || row.status === 'synced_jira' || row.locked_until) return null;
      if (row.status === 'sending') row.status = 'needs_review';
      Object.assign(row, {
        lease_token: crypto.randomUUID(),
        locked_until: 'locked',
        attempts: row.attempts + 1,
      });
      return { ...row };
    },
    async markSending(row) {
      const saved = this.rows.find((item) => item.id === row.id)!;
      assert.equal(saved.lease_token, row.lease_token);
      saved.status = 'sending';
      return { ...saved };
    },
    async finish(row, patch) {
      const saved = this.rows.find((item) => item.id === row.id)!;
      assert.equal(saved.lease_token, row.lease_token);
      Object.assign(saved, patch, { lease_token: null, locked_until: null });
      return { ...saved };
    },
    async list() {
      return this.rows.map((row) => ({ ...row }));
    },
    async pending() {
      return this.rows.filter((row) => row.status !== 'synced_jira').slice(0, 3);
    },
    async record(event) {
      return event.id;
    },
    async events() {
      return [];
    },
  };
}
function mockPortal(run: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const original = globalThis.fetch;
  const prior = process.env.JIRA_PORTAL_TOKEN;
  process.env.JIRA_PORTAL_TOKEN = 'test-only-token';
  globalThis.fetch = async (url, init) => run(String(url), init);
  return () => {
    globalThis.fetch = original;
    if (prior === undefined) delete process.env.JIRA_PORTAL_TOKEN;
    else process.env.JIRA_PORTAL_TOKEN = prior;
  };
}
const portalId = '18bd2704-89d0-42f8-9b60-9d553a457254';
const received = { id: portalId, jira_integracion: { jira_issue_key: 'SOL-149' } };

test('Support contracts validate categories, bounds and email; URL queries never enter tickets', () => {
  const input = validateSupportTicket(valid);
  assert.equal(input.pageUrl, '/library');
  assert.equal(SUPPORT_TIMEOUT_MS, 8000);
  for (const type of ['bug', 'game_suggestion', 'feature_request'])
    assert.equal(validateSupportTicket({ ...valid, type }).type, type);
  for (const patch of [
    { type: 'admin' },
    { title: 'four' },
    { title: 'a'.repeat(201) },
    { description: 'tiny' },
    { description: 'a'.repeat(8001) },
    { contactEmail: 'not an email' },
    { contactEmail: 'a@b.com\nBcc:other' },
    { systemContext: [] },
    { pageUrl: undefined },
  ])
    assert.throws(() => validateSupportTicket({ ...valid, ...patch }));
  assert.equal(supportPath('//evil.example/x?secret=1'), '/x');
  assert.equal(supportPath('https://x.test/library?a=1#b'), '/library');
});
test('Support sanitization strips real scripts, handlers, SVG and spoofed usernames before length validation', () => {
  const input = sanitizeSupportTicket({
    ...valid,
    title: '<img src=x onerror=alert(1)>Error al guardar',
    description:
      '<script>alert(1)</script><svg onload=alert(1)></svg><p>No funciona guardar mi partida.</p>',
    username: 'operator',
    systemContext: { userAgent: '<b>Browser</b>' },
  });
  assert.equal(input.title, 'Error al guardar');
  assert.equal(input.description, 'No funciona guardar mi partida.');
  assert.equal(input.username, null);
  assert.equal(input.systemContext?.userAgent, 'Browser');
  assert.throws(() => sanitizeSupportTicket({ ...valid, title: '<script>long enough</script>' }));
});
test('Telemetry scrubs credentials, URL queries, emails and supplied identity/timestamps', () => {
  const value = sanitizeTelemetry({
    message:
      'Failure <img src=x onerror=alert(1)> https://x.test/path?token=secret#key user@example.com',
    stack: 'Bearer secret password=123 cookie=abc 127.0.0.1',
    pathname: '/library?private=value',
    timestamp: '1900-01-01',
    userAgent: '<b>Browser</b>',
    userId: 'admin',
    escalatedToJira: true,
    jiraIssueKey: 'SOL-1',
  });
  assert.equal(value.pathname, '/library');
  assert.equal(value.userId, null);
  assert.equal(value.escalatedToJira, false);
  assert.equal(value.jiraIssueKey, null);
  assert.doesNotMatch(
    JSON.stringify(value),
    /secret|private=value|user@example|127\.0|password=123|cookie=abc/,
  );
  assert.match(value.stack!, /redacted/);
  assert.match(value.timestamp, /^20/);
  assert.throws(() => validateTelemetry({ message: '', pathname: '/' }));
  assert.equal(redactTelemetry('https://x.test/?token=a'), '/');
});
test('Telemetry ring bounds at 50, deduplicates for five minutes and never leaks mutable state', () => {
  const buffer = new TelemetryRingBuffer();
  const first = validateTelemetry({ message: 'Failure', pathname: '/', userAgent: '' }, 100000);
  buffer.add(first);
  assert.equal(buffer.add({ ...first, id: crypto.randomUUID() }).id, first.id);
  assert.notEqual(
    buffer.add({ ...first, id: 'new', timestamp: new Date(400001).toISOString() }).id,
    first.id,
  );
  for (let i = 0; i < 55; i++) buffer.add({ ...first, id: String(i), message: 'Failure ' + i });
  assert.equal(buffer.list().length, 50);
  assert.equal(buffer.list()[0]?.id, '54');
  const list = buffer.list();
  list[0]!.message = 'changed';
  assert.notEqual(buffer.list()[0]?.message, 'changed');
});
test('Portal mapping uses its actual Spanish schema and nested Jira integration; local UUID is not a Jira issue', () => {
  const input = validateSupportTicket(valid);
  const payload = portalTicketPayload(input, portalId);
  assert.equal(payload.tipo, 'incidente');
  assert.equal(payload.prioridad_solicitada, 'alta');
  assert.ok(payload.titulo.endsWith('[SS-' + portalId + ']'));
  assert.ok(payload.titulo.length <= 200);
  assert.equal(portalTicketPayload({ ...input, type: 'game_suggestion' }, portalId).tipo, 'mejora');
  assert.deepEqual(portalTicketResult(received), {
    remote_id: portalId,
    jira_issue_key: 'SOL-149',
    status: 'synced_jira',
  });
  assert.equal(portalTicketResult({ id: portalId })?.status, 'stored_local');
  assert.equal(portalTicketResult({ jira_issue_key: '<script>' }), null);
  assert.equal(portalTicketResult(null), null);
});
test('Support creates the durable row before networking and authenticates without exposing token to the result', async () => {
  const store = memoryStore();
  let writes = 0;
  const restore = mockPortal((_url, init) => {
    assert.equal(store.rows.length, 1);
    assert.equal((init?.headers as Record<string, string>).Authorization, 'Bearer test-only-token');
    assert.equal(init?.redirect, 'error');
    if (init?.method === 'POST') {
      writes++;
      return Response.json(received, { status: 201 });
    }
    return Response.json([]);
  });
  try {
    const result = await createSupportTicket(validateSupportTicket(valid), undefined, store);
    assert.equal(result.status, 'synced_jira');
    assert.equal(result.ticketId, 'SOL-149');
    assert.equal(writes, 1);
    assert.doesNotMatch(JSON.stringify(result), /test-only-token/);
  } finally {
    restore();
  }
});
test('Missing credential queues durably without calling the Portal', async () => {
  const store = memoryStore();
  const restore = mockPortal(() => {
    throw new Error('must not fetch');
  });
  delete process.env.JIRA_PORTAL_TOKEN;
  try {
    const result = await createSupportTicket(validateSupportTicket(valid), undefined, store);
    assert.equal(result.status, 'queued');
    assert.match(result.ticketId, /^LOCAL-/);
    assert.equal(store.rows.length, 1);
  } finally {
    restore();
  }
});
test('A cold or unreachable Portal queues and retries successfully after recovery', async () => {
  const store = memoryStore();
  let offline = true;
  const restore = mockPortal((_url, init) => {
    if (offline) throw new Error('connection failed');
    return Response.json(init?.method === 'POST' ? received : []);
  });
  try {
    const queued = await createSupportTicket(validateSupportTicket(valid), undefined, store);
    assert.equal(queued.status, 'queued');
    offline = false;
    const row = await dispatchSupportTicket(store.rows[0]!.id, store);
    assert.equal(row?.jira_issue_key, 'SOL-149');
  } finally {
    restore();
  }
});
test('Ambiguous POST timeouts enter reconciliation and never create duplicate remote requests', async () => {
  const store = memoryStore();
  let writes = 0;
  let remote = false;
  const restore = mockPortal((_url, init) => {
    if (init?.method === 'POST') {
      writes++;
      throw new DOMException('timeout', 'TimeoutError');
    }
    return Response.json(
      remote
        ? [
            {
              ...received,
              titulo: portalTicketPayload(store.rows[0]!.input, store.rows[0]!.id).titulo,
            },
          ]
        : [],
    );
  });
  try {
    await createSupportTicket(validateSupportTicket(valid), undefined, store);
    assert.equal(store.rows[0]?.status, 'needs_review');
    await dispatchSupportTicket(store.rows[0]!.id, store);
    assert.equal(writes, 1);
    remote = true;
    await dispatchSupportTicket(store.rows[0]!.id, store);
    assert.equal(store.rows[0]?.status, 'synced_jira');
    assert.equal(writes, 1);
  } finally {
    restore();
  }
});
test('Accepted Portal UUID is retained and polled without repeating POST while Jira sync is pending', async () => {
  const store = memoryStore();
  let writes = 0;
  const restore = mockPortal((url, init) => {
    if (init?.method === 'POST') {
      writes++;
      return Response.json({ id: portalId });
    }
    return Response.json(url.endsWith('/' + portalId) ? received : []);
  });
  try {
    const result = await createSupportTicket(validateSupportTicket(valid), undefined, store);
    assert.equal(result.status, 'stored_local');
    await dispatchSupportTicket(store.rows[0]!.id, store);
    assert.equal(store.rows[0]?.status, 'synced_jira');
    assert.equal(writes, 1);
  } finally {
    restore();
  }
});
test('Failed local storage never reports fictitious acceptance and never submits to Jira', async () => {
  const store = memoryStore();
  store.failSave = true;
  let called = false;
  const restore = mockPortal(() => {
    called = true;
    return Response.json(received);
  });
  try {
    await assert.rejects(
      createSupportTicket(validateSupportTicket(valid), undefined, store),
      /DB unavailable/,
    );
    assert.equal(called, false);
  } finally {
    restore();
  }
});
test('Concurrent escalation creates one local record and at most one remote ticket', async () => {
  const store = memoryStore();
  let writes = 0;
  const restore = mockPortal(async (_url, init) => {
    await new Promise((resolve) => setTimeout(resolve, 2));
    if (init?.method === 'POST') writes++;
    return Response.json(init?.method === 'POST' ? received : []);
  });
  try {
    const input = validateSupportTicket(valid);
    await Promise.all([
      createSupportTicket(input, portalId, store),
      createSupportTicket(input, portalId, store),
    ]);
    assert.equal(store.rows.length, 1);
    assert.equal(writes, 1);
  } finally {
    restore();
  }
});
test('Server configuration accepts only secure URLs and no public credentials are configured', () => {
  assert.equal(jiraConfig().apiUrl, DEFAULT_JIRA_CONFIG.apiUrl);
  const saved = process.env.JIRA_API_URL;
  try {
    for (const value of [
      'http://localhost',
      'https://user:password@example.com',
      'https://x.test?token=secret',
    ]) {
      process.env.JIRA_API_URL = value;
      assert.throws(jiraConfig);
    }
  } finally {
    if (saved === undefined) delete process.env.JIRA_API_URL;
    else process.env.JIRA_API_URL = saved;
  }
});

test('The eight-second transport deadline aborts a hanging Portal request and leaves a durable record', { timeout: 12000 }, async () => {
  const store = memoryStore();
  const restore = mockPortal((_url, init) => {
    if (init?.method !== 'POST') return Response.json([]);
    return new Promise<Response>((_resolve, reject) => {
      const signal = init.signal!;
      if (signal.aborted) reject(new DOMException('Aborted', 'AbortError'));
      else signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    });
  });
  try {
    const start = performance.now();
    const result = await createSupportTicket(validateSupportTicket(valid), undefined, store);
    assert.equal(result.status, 'queued');
    assert.equal(store.rows[0]?.status, 'needs_review');
    assert.ok(performance.now() - start >= 7500);
    assert.ok(performance.now() - start < 11000);
  } finally { restore(); }
});
