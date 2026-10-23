import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import {
  normalizeVercelDeployment,
  normalizeGitHubCommit,
  normalizeGitHubWorkflow,
  normalizeGitHubPullRequest,
  deduplicateCloudCommits,
  durationSeconds,
  formatCloudDuration,
  cloudCiLabel,
  CLOUD_FEED_TTL_MS,
} from '../../src/domain/cloud-observer.ts';

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
const { createCloudObserver } = await import('../../src/services/cloud-observer-service.ts');
test.after(() => hooks.deregister());
const now = 1792713600000;
const sha = 'a'.repeat(40);
const deployment = {
  uid: 'dpl_fixture',
  url: 'savestate-fixture.vercel.app',
  inspectorUrl: 'https://vercel.com/team/savestate/dpl_fixture',
  readyState: 'READY',
  target: 'production',
  createdAt: now - 60000,
  buildingAt: now - 50000,
  ready: now - 8000,
  meta: {
    githubCommitSha: sha,
    githubCommitMessage: 'Ship monitor',
    githubCommitAuthorName: 'Tester',
  },
};
const commit = {
  sha,
  commit: {
    message: 'A commit',
    author: { name: 'Tester', date: new Date(now - 1000).toISOString() },
  },
  author: { avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4' },
};
const run = {
  id: 42,
  name: 'CI Runner',
  status: 'completed',
  conclusion: 'success',
  head_sha: sha,
  head_branch: 'implementation/chatgpt',
  created_at: new Date(now - 80000).toISOString(),
  run_started_at: new Date(now - 50000).toISOString(),
  updated_at: new Date(now - 8000).toISOString(),
};
const pr = {
  number: 11,
  title: 'Feature',
  state: 'open',
  user: { login: 'Tester' },
  created_at: new Date(now).toISOString(),
  draft: false,
  head: { ref: 'feature/cloud' },
  base: { ref: 'implementation/chatgpt' },
};

test('Cloud deployment normalization computes durations, preserves environment and handles incomplete uploads safely', () => {
  const result = normalizeVercelDeployment(deployment, now)!;
  assert.equal(result.durationSec, 42);
  assert.equal(result.shortSha, sha.slice(0, 7));
  assert.equal(result.url, 'https://savestate-fixture.vercel.app/');
  assert.equal(result.target, 'production');
  assert.equal(normalizeVercelDeployment({ ...deployment, target: null })?.target, 'preview');
  assert.equal(normalizeVercelDeployment({ ...deployment, target: 'staging' })?.target, null);
  assert.equal(normalizeVercelDeployment({ ...deployment, url: null })?.url, '');
  assert.equal(
    normalizeVercelDeployment({ ...deployment, readyState: 'BUILDING' }, now)?.durationSec,
    50,
  );
  assert.equal(
    normalizeVercelDeployment({ ...deployment, readyState: 'ERROR', ready: null })?.durationSec,
    null,
  );
  assert.equal(normalizeVercelDeployment({}), null);
  assert.equal(normalizeVercelDeployment(null), null);
});
test('Cloud normalizers never treat queued, blocked or unknown provider states as READY', () => {
  for (const state of ['QUEUED', 'BLOCKED', 'FUTURE_STATE']) {
    const result = normalizeVercelDeployment({ ...deployment, readyState: state })!;
    assert.notEqual(result.state, 'READY');
    assert.ok(result.phase);
  }
  for (const url of [
    'javascript:alert(1)',
    'https://vercel.app.evil.test/a',
    'https://user:secret@safe.vercel.app',
    'https://localhost:3000',
  ]) {
    const result = normalizeVercelDeployment({ ...deployment, url, inspectorUrl: url })!;
    assert.equal(result.url, '');
    assert.equal(result.inspectorUrl, null);
  }
});
test('Cloud commits deduplicate by SHA, retain both branch badges and sort newest first', () => {
  const main = normalizeGitHubCommit(commit, 'main')!;
  const implementation = normalizeGitHubCommit(commit, 'implementation/chatgpt')!;
  const newer = normalizeGitHubCommit(
    {
      ...commit,
      sha: 'b'.repeat(40),
      commit: { ...commit.commit, author: { name: 'New', date: new Date(now).toISOString() } },
    },
    'main',
  )!;
  const list = deduplicateCloudCommits([main, implementation, newer, main]);
  assert.equal(list.length, 2);
  assert.equal(list[0]?.sha, 'b'.repeat(40));
  assert.equal(list[1]?.branch, 'main · implementation/chatgpt');
  assert.equal(main.branch, 'main');
  assert.equal(normalizeGitHubCommit({ ...commit, sha: 'a'.repeat(41) }, 'main'), null);
  assert.equal(
    normalizeGitHubCommit({ ...commit, commit: { author: { date: 'invalid' } } }, 'main'),
    null,
  );
});
test('Cloud workflow uses run start rather than queue time and never renders neutral/skipped as PASS', () => {
  const result = normalizeGitHubWorkflow(run, now)!;
  assert.equal(result.runDurationSec, 42);
  assert.equal(result.htmlUrl, 'https://github.com/ilhamelin/savestate/actions/runs/42');
  assert.equal(
    normalizeGitHubWorkflow({ ...run, status: 'in_progress', conclusion: null }, now)?.conclusion,
    'in_progress',
  );
  assert.equal(
    normalizeGitHubWorkflow({ ...run, status: 'waiting', conclusion: null }, now)?.runDurationSec,
    null,
  );
  assert.equal(
    normalizeGitHubWorkflow({ ...run, run_started_at: undefined }, now)?.runDurationSec,
    null,
  );
  for (const conclusion of ['neutral', 'skipped', 'unknown']) {
    assert.equal(normalizeGitHubWorkflow({ ...run, conclusion })?.conclusion, 'unknown');
    assert.doesNotMatch(cloudCiLabel('unknown'), /PASS/);
  }
  assert.equal(normalizeGitHubWorkflow({ id: -1 }), null);
  assert.equal(cloudCiLabel('success'), '✓ PASS (check)');
});
test('Cloud links use canonical repository and allowed hosts; arbitrary metadata and URLs are excluded', () => {
  assert.equal(
    normalizeGitHubCommit({ ...commit, html_url: 'https://evil.test' }, 'main')?.url,
    'https://github.com/ilhamelin/savestate/commit/' + sha,
  );
  const result = normalizeGitHubPullRequest({
    ...pr,
    html_url: 'javascript:alert(1)',
    token: 'sensitive',
  })!;
  assert.equal(result.htmlUrl, 'https://github.com/ilhamelin/savestate/pull/11');
  assert.equal(normalizeGitHubPullRequest({ ...pr, number: 0 }), null);
  assert.doesNotMatch(JSON.stringify(result), /sensitive|javascript/);
  assert.equal(formatCloudDuration(null), '—');
  assert.equal(formatCloudDuration(NaN), '—');
  assert.equal(formatCloudDuration(0), '0s');
  assert.equal(formatCloudDuration(125), '2m 5s');
  assert.equal(durationSeconds(2000, 1000), null);
  assert.equal(durationSeconds(null, 1000), null);
});
function fixture(token = true) {
  let clock = now;
  const env: Record<string, string | undefined> = {
    GITHUB_TOKEN: token ? 'github-private-test' : undefined,
    VERCEL_TOKEN: 'vercel-private-test',
    VERCEL_PROJECT_ID: 'project-test',
  };
  const calls: { url: URL; init: RequestInit | undefined }[] = [];
  let active = 0,
    maxActive = 0;
  let responder: (url: URL, init?: RequestInit) => Response | Promise<Response> = (url) => {
    if (url.hostname === 'api.vercel.com')
      return Response.json(
        {
          deployments: [
            {
              ...deployment,
              target: url.searchParams.get('target') === 'production' ? 'production' : null,
            },
          ],
        },
        { headers: { etag: '"v1"' } },
      );
    if (url.pathname.endsWith('/runs'))
      return Response.json({ workflow_runs: [run] }, { headers: { etag: '"ci1"' } });
    if (url.pathname.endsWith('/pulls')) return Response.json([pr], { headers: { etag: '"pr1"' } });
    return Response.json([commit], { headers: { etag: '"commit1"' } });
  };
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    calls.push({ url, init });
    active++;
    maxActive = Math.max(maxActive, active);
    try {
      await Promise.resolve();
      return await responder(url, init);
    } finally {
      active--;
    }
  };
  const fetchFeed = createCloudObserver({ fetcher, now: () => clock, env: () => env });
  return {
    fetchFeed,
    env,
    calls,
    advance: (ms: number) => {
      clock += ms;
    },
    setResponder: (next: typeof responder) => {
      responder = next;
    },
    maxActive: () => maxActive,
  };
}
test('Cloud observer reads providers concurrently, shares in-flight requests and caches copies for exactly 30 seconds', async () => {
  const state = fixture();
  const feeds = await Promise.all(Array.from({ length: 10 }, () => state.fetchFeed()));
  assert.equal(state.calls.length, 6);
  assert.equal(state.maxActive(), 6);
  assert.equal(feeds[0]?.github.recentCommits.length, 1);
  assert.equal(feeds[0]?.vercel.latestProduction?.target, 'production');
  feeds[0]!.github.recentCommits.length = 0;
  assert.equal((await state.fetchFeed()).github.recentCommits.length, 1);
  state.advance(CLOUD_FEED_TTL_MS - 1);
  await state.fetchFeed();
  assert.equal(state.calls.length, 6);
  state.advance(1);
  await state.fetchFeed();
  assert.equal(state.calls.length, 12);
  assert.ok(
    state.calls.some(
      (call) =>
        call.url.searchParams.get('target') === 'production' &&
        call.url.searchParams.get('limit') === '1',
    ),
  );
  assert.ok(
    state.calls.some((call) => call.url.pathname.endsWith('/actions/workflows/ci.yml/runs')),
  );
});
test('Cloud tokens remain on the correct provider, never appear in the normalized response and reset cached data on rotation', async () => {
  const state = fixture();
  const first = await state.fetchFeed();
  assert.doesNotMatch(
    JSON.stringify(first),
    /github-private-test|vercel-private-test|project-test/,
  );
  for (const call of state.calls) {
    const header = call.init?.headers as Record<string, string>;
    assert.equal(
      header.Authorization,
      'Bearer ' +
        (call.url.hostname === 'api.github.com' ? 'github-private-test' : 'vercel-private-test'),
    );
    assert.equal(call.init?.redirect, 'error');
    assert.equal(call.init?.cache, 'no-store');
    assert.equal(call.init?.method, 'GET');
  }
  delete state.env.VERCEL_TOKEN;
  delete state.env.GITHUB_TOKEN;
  const next = await state.fetchFeed();
  assert.equal(next.vercel.latestProduction, null);
  assert.equal(next.vercel.configured, false);
  assert.match(next.vercel.notice!, /VERCEL_TOKEN/);
  assert.equal(state.calls.length, 10);
});
test('Cloud public GitHub mode works without credentials and avoids spending four requests every 30 seconds', async () => {
  const state = fixture(false);
  delete state.env.VERCEL_TOKEN;
  const feed = await state.fetchFeed();
  assert.equal(state.calls.length, 4);
  assert.equal(feed.github.configured, true);
  assert.match(feed.github.notice!, /5 min/);
  assert.ok(
    state.calls.every((call) => !(call.init?.headers as Record<string, string>).Authorization),
  );
  for (let i = 0; i < 9; i++) {
    state.advance(30000);
    await state.fetchFeed();
  }
  assert.equal(state.calls.length, 4);
  state.advance(30000);
  await state.fetchFeed();
  assert.equal(state.calls.length, 8);
});
test('Cloud handles 401, 404 and 500 with safe empty fallbacks and caches failures', async () => {
  for (const status of [401, 404, 500]) {
    const state = fixture();
    state.setResponder(() => new Response('secret provider error', { status }));
    const feed = await state.fetchFeed();
    assert.equal(feed.vercel.configured, false);
    assert.equal(feed.github.configured, false);
    assert.deepEqual(feed.github.recentCommits, []);
    assert.equal(feed.vercel.latestProduction, null);
    assert.doesNotMatch(JSON.stringify(feed), /secret provider error/);
    await state.fetchFeed();
    assert.equal(state.calls.length, 6);
  }
});
test('Cloud isolates partial failures and labels retained snapshots as stale, then expires them after 30 minutes', async () => {
  const state = fixture();
  await state.fetchFeed();
  state.advance(30000);
  state.setResponder((url) =>
    url.pathname.endsWith('/pulls')
      ? new Response('Forbidden', { status: 403 })
      : url.hostname === 'api.vercel.com'
        ? new Response('Down', { status: 500 })
        : url.pathname.endsWith('/runs')
          ? Response.json({ workflow_runs: [run] })
          : Response.json([commit]),
  );
  const partial = await state.fetchFeed();
  assert.equal(partial.github.configured, true);
  assert.equal(partial.vercel.configured, false);
  assert.equal(partial.vercel.stale, true);
  assert.ok(partial.vercel.latestProduction);
  assert.equal(partial.github.openPullRequests.length, 1);
  assert.match(partial.github.notice!, /parciales/);
  state.advance(31 * 60000);
  const expired = await state.fetchFeed();
  assert.equal(expired.vercel.latestProduction, null);
});
test('Cloud respects Retry-After and conditional ETags instead of retrying a rate-limited provider every 30 seconds', async () => {
  const state = fixture();
  await state.fetchFeed();
  state.advance(30000);
  state.setResponder((url) =>
    url.hostname === 'api.github.com'
      ? new Response('', { status: 429, headers: { 'retry-after': '120' } })
      : new Response(null, { status: 304 }),
  );
  const limited = await state.fetchFeed();
  assert.equal(limited.github.stale, true);
  assert.equal(limited.vercel.configured, true);
  assert.ok(
    state.calls
      .slice(6)
      .every((call) => (call.init?.headers as Record<string, string>)['If-None-Match']),
  );
  const githubCalls = () =>
    state.calls.filter((call) => call.url.hostname === 'api.github.com').length;
  const count = githubCalls();
  state.advance(30000);
  await state.fetchFeed();
  assert.equal(githubCalls(), count);
  state.advance(90000);
  await state.fetchFeed();
  assert.ok(githubCalls() > count);
});
test('Cloud tolerates malformed JSON, invalid shapes, oversize payloads and rejected network promises', async () => {
  for (const responder of [
    () => new Response('{bad'),
    () => Response.json({ unexpected: true }),
    () => new Response('x'.repeat(512001)),
    () => {
      throw new Error('private-token-never-echo');
    },
  ]) {
    const state = fixture();
    state.setResponder(responder);
    const result = await state.fetchFeed();
    assert.equal(result.github.configured, false);
    assert.equal(result.vercel.configured, false);
    assert.doesNotMatch(JSON.stringify(result), /private-token-never-echo/);
  }
});

test(
  'Cloud request deadlines abort all hung provider calls without rejecting the aggregate feed',
  { timeout: 8000 },
  async () => {
    const state = fixture();
    state.setResponder(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init!.signal!.addEventListener(
            'abort',
            () => reject(new DOMException('Aborted', 'AbortError')),
            { once: true },
          );
        }),
    );
    const started = performance.now();
    const result = await state.fetchFeed();
    assert.equal(result.github.configured, false);
    assert.equal(result.vercel.configured, false);
    assert.ok(performance.now() - started >= 4500);
    assert.ok(performance.now() - started < 7500);
  },
);
test('Cloud route authenticates before touching the service and sends private no-store responses', async () => {
  const fixtureUrl =
    'data:text/javascript,' +
    encodeURIComponent(
      "import {AppError} from '@/lib/http';export const state={admin:false,reads:0};" +
        "export async function authenticatedAdmin(){if(!state.admin)throw new AppError('Forbidden',403);}" +
        "export async function fetchCloudObserverFeed(){state.reads++;return{measuredAt:'fixture'};}",
    );
  const routeHooks = registerHooks({
    resolve(specifier, context, next) {
      if (
        context.parentURL?.includes('/cloud-feed/route.ts') &&
        ['@/lib/session', '@/services/cloud-observer-service'].includes(specifier)
      )
        return { url: fixtureUrl, shortCircuit: true };
      return next(specifier, context);
    },
  });
  try {
    const { state } = await import(fixtureUrl);
    const route = await import('../../src/app/api/guardian/cloud-feed/route.ts');
    assert.equal((await route.GET()).status, 403);
    assert.equal(state.reads, 0);
    state.admin = true;
    const response = await route.GET();
    assert.equal(response.status, 200);
    assert.equal(state.reads, 1);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
  } finally {
    routeHooks.deregister();
  }
});
