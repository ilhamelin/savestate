export interface GameDuration {
  mainStoryHours: number | null;
  mainExtraHours: number | null;
  completionistHours: number | null;
}
export const PROTON_TIERS = ['platinum', 'gold', 'silver', 'bronze', 'borked', 'pending'] as const;
export type ProtonDbTier = (typeof PROTON_TIERS)[number];
export interface ProtonDbReport {
  tier: ProtonDbTier;
  score: number;
  confidence: string;
  totalReports: number;
  /** Community Proton tier heuristic, NOT Valve's official Deck certification. */
  steamDeckVerified: boolean;
  protonUrl: string;
}
export interface SpeedrunRecord {
  categoryName: string;
  timeFormatted: string;
  runnerName: string;
  videoUrl: string | null;
  dateIso: string | null;
  speedrunUrl: string;
}
export interface GameMetaReport {
  duration: GameDuration | null;
  proton: ProtonDbReport | null;
  speedrun: SpeedrunRecord | null;
}
export function metaRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
export function normalizedMetaTitle(title: string): string {
  return title
    .replace(/[™®©]/g, '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f™®©]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}
const positive = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;
const rounded = (value: number) => Math.round(value * 10) / 10;
export function formatGameHours(seconds: number | null): string {
  if (!positive(seconds)) return '—';
  return seconds < 3600 ? `${rounded(seconds / 60)} min` : `${rounded(seconds / 3600)} h`;
}
export function formatSpeedrunTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0 || seconds > Number.MAX_SAFE_INTEGER / 100)
    return '—';
  const hundredths = Math.round(seconds * 100);
  const whole = Math.floor(hundredths / 100);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor(whole / 60) % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  const time = hours
    ? `${hours}:${pad(minutes)}:${pad(whole % 60)}`
    : `${pad(minutes)}:${pad(whole % 60)}`;
  return time + (hundredths % 100 ? '.' + pad(hundredths % 100) : '');
}
export function hasUnsafeUrlCharacters(value: string): boolean {
  return Array.from(value).some(
    (character) => character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127,
  );
}
export function sanitizeVideoUrl(value: string | null | undefined): string | null {
  if (!value || hasUnsafeUrlCharacters(value)) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    const host = url.hostname;
    const videoId = /^[A-Za-z0-9_-]{11}$/;
    const youtube =
      ['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(host) &&
      ((url.pathname === '/watch' && videoId.test(url.searchParams.get('v') ?? '')) ||
        /^\/(?:embed|shorts)\/[A-Za-z0-9_-]{11}\/?$/.test(url.pathname));
    const short = host === 'youtu.be' && /^\/[A-Za-z0-9_-]{11}\/?$/.test(url.pathname);
    const twitch =
      ['twitch.tv', 'www.twitch.tv'].includes(host) &&
      (/^\/videos\/\d+\/?$/.test(url.pathname) ||
        /^\/[a-zA-Z0-9_]+\/clip\/[a-zA-Z0-9_-]+\/?$/.test(url.pathname));
    const clip = host === 'clips.twitch.tv' && /^\/[a-zA-Z0-9_-]+\/?$/.test(url.pathname);
    return youtube || short || twitch || clip ? url.href : null;
  } catch {
    return null;
  }
}
export function mapIgdbDuration(value: unknown): GameDuration | null {
  const raw = metaRecord(value);
  const hours = (v: unknown) => (positive(v) ? v / 3600 : null);
  const result = {
    mainStoryHours: hours(raw.hastily),
    mainExtraHours: hours(raw.normally),
    completionistHours: hours(raw.completely),
  };
  return Object.values(result).some((v) => v !== null) ? result : null;
}
export function normalizeProtonTier(value: unknown): ProtonDbTier {
  return typeof value === 'string' && PROTON_TIERS.some((tier) => tier === value)
    ? (value as ProtonDbTier)
    : 'pending';
}
export function mapProtonDbReport(value: unknown, appId: number): ProtonDbReport | null {
  const raw = metaRecord(value);
  if (!Number.isSafeInteger(appId) || appId <= 0 || !PROTON_TIERS.some((tier) => tier === raw.tier))
    return null;
  const tier = normalizeProtonTier(raw.tier);
  return {
    tier,
    score:
      typeof raw.score === 'number' && Number.isFinite(raw.score)
        ? Math.max(0, Math.min(1, raw.score))
        : 0,
    confidence: typeof raw.confidence === 'string' ? raw.confidence.slice(0, 40) : 'Sin datos',
    totalReports:
      typeof raw.total === 'number' && Number.isSafeInteger(raw.total) && raw.total >= 0
        ? raw.total
        : 0,
    steamDeckVerified: tier === 'platinum' || tier === 'gold',
    protonUrl: `https://www.protondb.com/app/${appId}`,
  };
}
export function mapSpeedrunRecord(
  value: unknown,
  categoryName: string,
  gameId: string,
  categoryId: string,
): SpeedrunRecord | null {
  if (!/^[a-zA-Z0-9]+$/.test(gameId) || !/^[a-zA-Z0-9]+$/.test(categoryId)) return null;
  const board = metaRecord(metaRecord(value).data);
  const first = Array.isArray(board.runs)
    ? board.runs.find((item) => metaRecord(item).place === 1)
    : null;
  const run = metaRecord(metaRecord(first).run);
  const time = metaRecord(run.times).primary_t;
  if (
    !positive(time) ||
    formatSpeedrunTime(time) === '—' ||
    metaRecord(run.status).status !== 'verified'
  )
    return null;
  const embedded = metaRecord(board.players).data;
  const players = Array.isArray(embedded) ? embedded.map(metaRecord) : [];
  const runners = (Array.isArray(run.players) ? run.players : []).flatMap((item: unknown) => {
    const reference = metaRecord(item);
    const player =
      players.find((p) => reference.id && p.id === reference.id) ?? metaRecord(reference.data);
    const name =
      reference.rel === 'guest'
        ? reference.name
        : (metaRecord(player.names).international ?? player.name);
    return typeof name === 'string' && name.trim() ? [name.trim().slice(0, 80)] : [];
  });
  const links = metaRecord(run.videos).links;
  const video =
    (Array.isArray(links) ? links : [])
      .map((link) => {
        const uri = metaRecord(link).uri;
        return sanitizeVideoUrl(typeof uri === 'string' ? uri : null);
      })
      .find(Boolean) ?? null;
  const date =
    typeof run.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(run.date) ? run.date : null;
  const parsedDate = date ? new Date(date + 'T00:00:00.000Z') : null;
  return {
    categoryName: categoryName.slice(0, 100),
    timeFormatted: formatSpeedrunTime(time),
    runnerName: runners.join(' & ') || 'Corredor no disponible',
    videoUrl: video,
    dateIso:
      parsedDate &&
      Number.isFinite(parsedDate.getTime()) &&
      parsedDate.toISOString().startsWith(date!)
        ? parsedDate.toISOString()
        : null,
    speedrunUrl: `https://www.speedrun.com/api/v1/leaderboards/${gameId}/category/${categoryId}`,
  };
}
