import 'server-only';
import { createHash } from 'node:crypto';
import {
  CLOUD_FEED_TTL_MS,
  CLOUD_PUBLIC_GITHUB_TTL_MS,
  cloudObject,
  normalizeVercelDeployment,
  normalizeGitHubCommit,
  normalizeGitHubWorkflow,
  normalizeGitHubPullRequest,
  deduplicateCloudCommits,
  type CloudObserverFeed,
} from '@/domain/cloud-observer';

type CloudEnv = Partial<
  Record<'VERCEL_TOKEN' | 'VERCEL_PROJECT_ID' | 'VERCEL_TEAM_ID' | 'GITHUB_TOKEN', string>
>;
interface Resource {
  value: unknown;
  ok: boolean;
  updatedAt: number | null;
  expiresAt: number;
  etag: string | null;
}
interface ObserverOptions {
  fetcher?: typeof fetch;
  now?: () => number;
  env?: () => CloudEnv;
}
const TIMEOUT_MS = 5000;
const MAX_STALE_MS = 30 * 60_000;

// Instance-local cache. It is not a distributed quota guarantee across cold starts/regions.
export function createCloudObserver(options: ObserverOptions = {}) {
  const fetcher = options.fetcher ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const now = options.now ?? Date.now;
  const env =
    options.env ??
    (() => ({
      VERCEL_TOKEN: process.env.VERCEL_TOKEN,
      VERCEL_PROJECT_ID: process.env.VERCEL_PROJECT_ID,
      VERCEL_TEAM_ID: process.env.VERCEL_TEAM_ID,
      GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    }));
  let configurationKey = '';
  let resources = new Map<string, Resource>();
  let blocked = { github: 0, vercel: 0 };
  let cachedFeed: { data: CloudObserverFeed; expiresAt: number } | null = null;
  let pending: Promise<CloudObserverFeed> | null = null;
  function snapshot() {
    const config = env();
    return {
      vercel: config.VERCEL_TOKEN?.trim() || '',
      github: config.GITHUB_TOKEN?.trim() || '',
      project: config.VERCEL_PROJECT_ID?.trim() || 'savestate',
      team: config.VERCEL_TEAM_ID?.trim() || '',
    };
  }
  return async function fetchFeed(): Promise<CloudObserverFeed> {
    const config = snapshot();
    const key = createHash('sha256').update(JSON.stringify(config)).digest('hex');
    if (key !== configurationKey) {
      configurationKey = key;
      resources = new Map();
      blocked = { github: 0, vercel: 0 };
      cachedFeed = null;
      pending = null;
    }
    if (cachedFeed && now() < cachedFeed.expiresAt) return structuredClone(cachedFeed.data);
    if (pending) return structuredClone(await pending);
    const local = resources,
      cooldown = blocked;
    const task = (async () => {
      async function read(provider: 'github' | 'vercel', url: URL, ttl: number): Promise<Resource> {
        const cacheKey = url.href;
        const prior = local.get(cacheKey);
        const time = now();
        if (prior && time < prior.expiresAt) return prior;
        const fallback = (): Resource => ({
          value:
            prior?.updatedAt !== null &&
            prior?.updatedAt !== undefined &&
            time - prior.updatedAt <= MAX_STALE_MS
              ? prior.value
              : null,
          updatedAt: prior?.updatedAt ?? null,
          ok: false,
          expiresAt: Math.max(time + ttl, cooldown[provider]),
          etag: prior?.etag ?? null,
        });
        if (time < cooldown[provider]) {
          const result = fallback();
          local.set(cacheKey, result);
          return result;
        }
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
        try {
          const headers: Record<string, string> =
            provider === 'github'
              ? {
                  Accept: 'application/vnd.github+json',
                  'User-Agent': 'SaveState-Guardian',
                  'X-GitHub-Api-Version': '2022-11-28',
                }
              : { Accept: 'application/json' };
          const token = provider === 'github' ? config.github : config.vercel;
          if (token) headers.Authorization = 'Bearer ' + token;
          if (prior?.etag && prior.value !== null) headers['If-None-Match'] = prior.etag;
          const response = await fetcher(url, {
            method: 'GET',
            headers,
            cache: 'no-store',
            redirect: 'error',
            signal: controller.signal,
          });
          if (response.status === 304 && prior?.value !== null && prior?.value !== undefined) {
            const result = { ...prior, ok: true, updatedAt: now(), expiresAt: now() + ttl };
            local.set(cacheKey, result);
            return result;
          }
          if (
            response.status === 429 ||
            response.status === 403 ||
            response.headers.get('x-ratelimit-remaining') === '0'
          ) {
            const retry = response.headers.get('retry-after');
            const retryMs =
              retry && /^\d+$/.test(retry) ? now() + Number(retry) * 1000 : Date.parse(retry ?? '');
            const reset = Number(response.headers.get('x-ratelimit-reset')) * 1000;
            cooldown[provider] = Math.max(
              cooldown[provider],
              now() + 60_000,
              Number.isFinite(retryMs) ? retryMs : 0,
              Number.isFinite(reset) ? reset : 0,
            );
          }
          if (!response.ok) throw new Error('Provider unavailable');
          const reader = response.body?.getReader();
          let raw = '',
            bytes = 0;
          const decoder = new TextDecoder();
          if (reader)
            try {
              while (true) {
                const part = await reader.read();
                if (part.done) break;
                bytes += part.value.byteLength;
                if (bytes > 512_000) {
                  await reader.cancel();
                  throw new Error('Payload too large');
                }
                raw += decoder.decode(part.value, { stream: true });
              }
              raw += decoder.decode();
            } finally {
              reader.releaseLock();
            }
          const value: unknown = JSON.parse(raw);
          const valid =
            provider === 'vercel'
              ? Array.isArray(cloudObject(value).deployments)
              : url.pathname.endsWith('/runs')
                ? Array.isArray(cloudObject(value).workflow_runs)
                : Array.isArray(value);
          if (!valid) throw new Error('Invalid provider payload');
          const result: Resource = {
            value,
            ok: true,
            updatedAt: now(),
            expiresAt: now() + ttl,
            etag: response.headers.get('etag'),
          };
          local.set(cacheKey, result);
          return result;
        } catch {
          const result = fallback();
          local.set(cacheKey, result);
          return result;
        } finally {
          clearTimeout(timer);
        }
      }
      function vercelUrl(production = false) {
        const url = new URL('https://api.vercel.com/v6/deployments');
        url.searchParams.set('projectId', config.project);
        url.searchParams.set('limit', production ? '1' : '6');
        if (production) url.searchParams.set('target', 'production');
        if (config.team) url.searchParams.set('teamId', config.team);
        return url;
      }
      const githubBase = 'https://api.github.com/repos/ilhamelin/savestate';
      const githubTtl = config.github ? CLOUD_FEED_TTL_MS : CLOUD_PUBLIC_GITHUB_TTL_MS;
      const unavailable: Resource = {
        value: null,
        ok: false,
        updatedAt: null,
        expiresAt: now() + CLOUD_FEED_TTL_MS,
        etag: null,
      };
      const calls = await Promise.allSettled([
        config.vercel
          ? read('vercel', vercelUrl(), CLOUD_FEED_TTL_MS)
          : Promise.resolve(unavailable),
        config.vercel
          ? read('vercel', vercelUrl(true), CLOUD_FEED_TTL_MS)
          : Promise.resolve(unavailable),
        read('github', new URL(githubBase + '/commits?sha=main&per_page=4'), githubTtl),
        read(
          'github',
          new URL(githubBase + '/commits?sha=implementation%2Fchatgpt&per_page=3'),
          githubTtl,
        ),
        // Observe the actual check workflow, not whichever unrelated workflow ran most recently.
        read(
          'github',
          new URL(githubBase + '/actions/workflows/ci.yml/runs?per_page=3'),
          githubTtl,
        ),
        read('github', new URL(githubBase + '/pulls?state=open&per_page=5'), githubTtl),
      ]);
      const values = calls.map((result) =>
        result.status === 'fulfilled' ? result.value : unavailable,
      );
      const [recent, production, main, implementation, workflows, pullRequests] = values as [
        Resource,
        Resource,
        Resource,
        Resource,
        Resource,
        Resource,
      ];
      const list = (value: unknown) => (Array.isArray(value) ? value : []);
      const deployments = list(cloudObject(recent.value).deployments)
        .slice(0, 6)
        .map((item) => normalizeVercelDeployment(item, now()))
        .filter((item) => item !== null)
        .sort((a, b) => b.createdAt - a.createdAt);
      const latestProduction =
        list(cloudObject(production.value).deployments)
          .slice(0, 1)
          .map((item) => normalizeVercelDeployment(item, now()))
          .find((item) => item?.target === 'production') ?? null;
      const commits = deduplicateCloudCommits(
        [
          ...list(main.value)
            .slice(0, 4)
            .map((item) => normalizeGitHubCommit(item, 'main')),
          ...list(implementation.value)
            .slice(0, 3)
            .map((item) => normalizeGitHubCommit(item, 'implementation/chatgpt')),
        ].filter((item) => item !== null),
      );
      const runs = list(cloudObject(workflows.value).workflow_runs)
        .slice(0, 3)
        .map((item) => normalizeGitHubWorkflow(item, now()))
        .filter((item) => item !== null)
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
      const prs = list(pullRequests.value)
        .slice(0, 5)
        .map(normalizeGitHubPullRequest)
        .filter((item) => item !== null && item.state === 'open');
      const githubResources = [main, implementation, workflows, pullRequests];
      const vercelResources = [recent, production];
      const sampledAt = (items: Resource[]) => {
        const dates = items.map((item) => item.updatedAt).filter((item) => item !== null);
        return dates.length ? new Date(Math.min(...dates)).toISOString() : null;
      };
      const partial = githubResources.some((item) => !item.ok);
      const data: CloudObserverFeed = {
        vercel: {
          configured: Boolean(config.vercel) && vercelResources.some((item) => item.ok),
          latestProduction,
          recentDeployments: deployments,
          updatedAt: sampledAt(vercelResources),
          stale: vercelResources.some((item) => !item.ok && item.value !== null),
          ...(!config.vercel
            ? {
                notice:
                  'Configura VERCEL_TOKEN para activar Vercel. VERCEL_PROJECT_ID es opcional.',
              }
            : vercelResources.some((item) => !item.ok)
              ? {
                  notice:
                    'Vercel no se pudo actualizar por permisos, cuota o conectividad. Revisa el acceso del token al proyecto y al equipo.',
                }
              : {}),
        },
        github: {
          configured: githubResources.some((item) => item.ok),
          recentCommits: commits,
          latestWorkflowRun: runs[0] ?? null,
          openPullRequests: prs,
          updatedAt: sampledAt(githubResources),
          stale: githubResources.some((item) => !item.ok && item.value !== null),
          notice: [
            !config.github
              ? 'Lectura pública: consultas cada 5 min. Configura GITHUB_TOKEN para refrescar cada 30 s.'
              : '',
            partial
              ? 'Datos parciales: GitHub no respondió o limitó las consultas; se respeta su pausa de reintento.'
              : '',
          ]
            .filter(Boolean)
            .join(' '),
        },
        measuredAt: new Date(now()).toISOString(),
      };
      if (configurationKey === key) cachedFeed = { data, expiresAt: now() + CLOUD_FEED_TTL_MS };
      return data;
    })();
    pending = task;
    try {
      return structuredClone(await task);
    } finally {
      if (pending === task) pending = null;
    }
  };
}
export const fetchCloudObserverFeed = createCloudObserver();
