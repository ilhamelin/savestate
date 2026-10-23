export type VercelDeploymentState = 'BUILDING' | 'READY' | 'ERROR' | 'CANCELED' | 'INITIALIZING';
export type CiRunConclusion =
  'success' | 'failure' | 'cancelled' | 'timed_out' | 'in_progress' | 'queued' | 'unknown';
export interface VercelDeploymentSummary {
  id: string;
  url: string;
  inspectorUrl: string | null;
  state: VercelDeploymentState;
  target: 'production' | 'preview' | null;
  commitSha: string | null;
  shortSha: string | null;
  commitMessage: string | null;
  commitAuthor: string | null;
  createdAt: number;
  buildingAt: number | null;
  readyAt: number | null;
  durationSec: number | null;
  phase?: 'QUEUED' | 'BLOCKED' | 'UNKNOWN';
}
export interface GitHubCommitSummary {
  sha: string;
  shortSha: string;
  message: string;
  author: string;
  avatarUrl: string | null;
  date: string;
  url: string;
  branch: string;
}
export interface GitHubWorkflowRunSummary {
  id: number;
  name: string;
  status: 'completed' | 'in_progress' | 'queued';
  conclusion: CiRunConclusion;
  htmlUrl: string;
  event: string;
  headBranch: string;
  headSha: string;
  shortSha: string;
  createdAt: string;
  updatedAt: string;
  runDurationSec: number | null;
}
export interface GitHubPullRequestSummary {
  number: number;
  title: string;
  state: 'open' | 'closed';
  htmlUrl: string;
  author: string;
  avatarUrl: string | null;
  createdAt: string;
  draft: boolean;
  headBranch: string;
  baseBranch: string;
}
interface ProviderDetails {
  notice?: string;
  updatedAt?: string | null;
  stale?: boolean;
}
export interface CloudObserverFeed {
  vercel: ProviderDetails & {
    configured: boolean;
    latestProduction: VercelDeploymentSummary | null;
    recentDeployments: VercelDeploymentSummary[];
  };
  github: ProviderDetails & {
    configured: boolean;
    recentCommits: GitHubCommitSummary[];
    latestWorkflowRun: GitHubWorkflowRunSummary | null;
    openPullRequests: GitHubPullRequestSummary[];
  };
  measuredAt: string;
}
export const CLOUD_FEED_TTL_MS = 30_000;
export const CLOUD_PUBLIC_GITHUB_TTL_MS = 300_000;
export const CLOUD_REPO_URL = 'https://github.com/ilhamelin/savestate';
export function cloudObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function label(value: unknown, max = 200): string {
  return typeof value === 'string'
    ? value
        .replace(/[\u0000-\u001f\u007f]/g, ' ')
        .trim()
        .slice(0, max)
    : '';
}
function stamp(value: unknown): number | null {
  return typeof value === 'number' &&
    Number.isFinite(value) &&
    value > 0 &&
    value <= 8640000000000000
    ? value
    : null;
}
function iso(value: unknown): string | null {
  const ms = typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}
function hash(value: unknown): string | null {
  return typeof value === 'string' && /^(?:[a-f\d]{40}|[a-f\d]{64})$/i.test(value)
    ? value.toLowerCase()
    : null;
}
function positiveInt(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null;
}
function link(value: unknown, host: string, subdomains = false): string | null {
  if (typeof value !== 'string' || value.length > 1000) return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.port ||
      !(url.hostname === host || (subdomains && url.hostname.endsWith('.' + host)))
    )
      return null;
    url.search = '';
    url.hash = '';
    return url.href;
  } catch {
    return null;
  }
}
export function durationSeconds(start: number | null, end: number | null): number | null {
  if (
    start === null ||
    end === null ||
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < 0 ||
    end < start
  )
    return null;
  return Math.floor((end - start) / 1000);
}
export function formatCloudDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return '—';
  const total = Math.floor(seconds);
  return total < 60 ? total + 's' : Math.floor(total / 60) + 'm ' + (total % 60) + 's';
}
export function normalizeVercelDeployment(
  raw: unknown,
  nowMs = Date.now(),
): VercelDeploymentSummary | null {
  const data = cloudObject(raw),
    meta = cloudObject(data.meta);
  const id = label(data.uid ?? data.id, 100),
    createdAt = stamp(data.createdAt) ?? stamp(data.created);
  if (!id || !createdAt) return null;
  const stateRaw = data.readyState ?? data.state;
  const known = ['BUILDING', 'READY', 'ERROR', 'CANCELED', 'INITIALIZING'];
  const phase =
    stateRaw === 'QUEUED'
      ? 'QUEUED'
      : stateRaw === 'BLOCKED'
        ? 'BLOCKED'
        : known.includes(String(stateRaw))
          ? undefined
          : 'UNKNOWN';
  const state: VercelDeploymentState = known.includes(String(stateRaw))
    ? (stateRaw as VercelDeploymentState)
    : phase === 'BLOCKED'
      ? 'ERROR'
      : 'INITIALIZING';
  const buildingAt = stamp(data.buildingAt),
    readyAt = stamp(data.ready) ?? stamp(data.readyAt);
  const completed = ['READY', 'ERROR', 'CANCELED'].includes(state) && !phase;
  const end = completed ? readyAt : state === 'BUILDING' ? nowMs : null;
  const commitSha = hash(meta.githubCommitSha);
  const urlRaw =
    typeof data.url === 'string' && !data.url.includes('://') ? 'https://' + data.url : data.url;
  return {
    id,
    url: link(urlRaw, 'vercel.app', true) ?? '',
    inspectorUrl: link(data.inspectorUrl, 'vercel.com'),
    state,
    ...(phase ? { phase } : {}),
    target:
      data.target === 'production'
        ? 'production'
        : data.target === null || data.target === 'preview'
          ? 'preview'
          : null,
    commitSha,
    shortSha: commitSha?.slice(0, 7) ?? null,
    commitMessage: label(meta.githubCommitMessage) || null,
    commitAuthor: label(meta.githubCommitAuthorName ?? meta.githubCommitAuthorLogin, 80) || null,
    createdAt,
    buildingAt,
    readyAt,
    durationSec: durationSeconds(buildingAt, end),
  };
}
export function normalizeGitHubCommit(raw: unknown, branch: string): GitHubCommitSummary | null {
  const data = cloudObject(raw),
    commit = cloudObject(data.commit),
    author = cloudObject(commit.author);
  const account = cloudObject(data.author);
  const sha = hash(data.sha),
    date = iso(author.date ?? cloudObject(commit.committer).date);
  if (!sha || !date) return null;
  return {
    sha,
    shortSha: sha.slice(0, 7),
    message: label(commit.message) || 'Sin mensaje',
    author: label(author.name ?? account.login, 80) || 'Autor no disponible',
    avatarUrl: link(account.avatar_url, 'avatars.githubusercontent.com'),
    date,
    url: CLOUD_REPO_URL + '/commit/' + sha,
    branch,
  };
}
export function deduplicateCloudCommits(commits: GitHubCommitSummary[]): GitHubCommitSummary[] {
  const merged = new Map<string, GitHubCommitSummary>();
  for (const commit of commits) {
    const prior = merged.get(commit.sha);
    merged.set(commit.sha, {
      ...commit,
      branch: prior
        ? [...new Set([...prior.branch.split(' · '), commit.branch])].join(' · ')
        : commit.branch,
    });
  }
  return [...merged.values()].sort((a, b) => Date.parse(b.date) - Date.parse(a.date)).slice(0, 5);
}
export function normalizeGitHubWorkflow(
  raw: unknown,
  nowMs = Date.now(),
): GitHubWorkflowRunSummary | null {
  const data = cloudObject(raw),
    id = positiveInt(data.id);
  const createdAt = iso(data.created_at),
    updatedAt = iso(data.updated_at),
    headSha = hash(data.head_sha);
  if (!id || !createdAt || !updatedAt || !headSha) return null;
  const status =
    data.status === 'completed'
      ? 'completed'
      : data.status === 'in_progress'
        ? 'in_progress'
        : 'queued';
  const conclusions = ['success', 'failure', 'cancelled', 'timed_out'];
  const conclusion: CiRunConclusion =
    status !== 'completed'
      ? status
      : conclusions.includes(String(data.conclusion))
        ? (data.conclusion as CiRunConclusion)
        : 'unknown';
  const start = iso(data.run_started_at);
  return {
    id,
    name: label(data.name, 100) || 'CI Runner',
    status,
    conclusion,
    htmlUrl: CLOUD_REPO_URL + '/actions/runs/' + id,
    event: label(data.event, 40),
    headBranch: label(data.head_branch, 150),
    headSha,
    shortSha: headSha.slice(0, 7),
    createdAt,
    updatedAt,
    // Queue time is not build/run time. Never manufacture elapsed time without a start timestamp.
    runDurationSec:
      start && status !== 'queued'
        ? durationSeconds(Date.parse(start), status === 'completed' ? Date.parse(updatedAt) : nowMs)
        : null,
  };
}
export function normalizeGitHubPullRequest(raw: unknown): GitHubPullRequestSummary | null {
  const data = cloudObject(raw),
    user = cloudObject(data.user);
  const number = positiveInt(data.number),
    createdAt = iso(data.created_at);
  if (!number || !createdAt || !['open', 'closed'].includes(String(data.state))) return null;
  return {
    number,
    title: label(data.title) || 'Pull request',
    state: data.state as 'open' | 'closed',
    htmlUrl: CLOUD_REPO_URL + '/pull/' + number,
    author: label(user.login, 80) || 'Autor no disponible',
    avatarUrl: link(user.avatar_url, 'avatars.githubusercontent.com'),
    createdAt,
    draft: data.draft === true,
    headBranch: label(cloudObject(data.head).ref, 150),
    baseBranch: label(cloudObject(data.base).ref, 150),
  };
}
export function cloudCiLabel(value: CiRunConclusion): string {
  return {
    success: '✓ PASS (check)',
    failure: '✕ FAIL',
    cancelled: 'Cancelado',
    timed_out: 'Tiempo agotado',
    in_progress: 'En ejecución',
    queued: 'En cola',
    unknown: 'Sin conclusión',
  }[value];
}
