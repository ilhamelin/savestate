export interface FreebieItem {
  id: number;
  title: string;
  worth: string;
  thumbnail: string | null;
  openGiveawayUrl: string;
  platforms: string;
  endDate: string | null;
}
export type FreebiePlatformCategory = 'all' | 'steam' | 'epic' | 'gog' | 'consoles' | 'pc';
export function matchesPlatformFilter(platforms: string, filter: FreebiePlatformCategory): boolean {
  const value = platforms.toLowerCase();
  switch (filter) {
    case 'steam':
      return value.includes('steam');
    case 'epic':
      return value.includes('epic');
    case 'gog':
      return value.includes('gog');
    case 'consoles':
      return value.includes('playstation') || value.includes('xbox') || value.includes('switch');
    case 'pc':
      return value.includes('pc') || value.includes('drm-free');
    default:
      return true;
  }
}
export interface FreebieCountdown {
  label: string;
  isUrgent: boolean;
}
export function formatFreebieTimeRemaining(
  endDate: string | null,
  nowMs = Date.now(),
): FreebieCountdown | null {
  if (!endDate || !Number.isFinite(nowMs)) return null;
  const date = endDate.trim().replace(' ', 'T');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})?$/i.test(date))
    return null;
  const target = Date.parse(/(?:Z|[+-]\d{2}:\d{2})$/i.test(date) ? date : `${date}Z`);
  const diffMs = target - nowMs;
  if (!Number.isFinite(diffMs) || diffMs <= 0) return null;
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(hours / 24);
  if (hours < 1)
    return { label: `Últimos ${Math.max(1, Math.floor(diffMs / 60000))}m`, isUrgent: true };
  if (hours < 24) return { label: `Quedan ${hours}h`, isUrgent: true };
  return { label: days === 1 ? 'Queda 1 día' : `Quedan ${days} días`, isUrgent: false };
}
function providerUrl(value: unknown) {
  if (typeof value !== 'string' || value.length > 2000) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      url.hostname === 'www.gamerpower.com' &&
      !url.username &&
      !url.password &&
      !url.port
      ? url
      : null;
  } catch {
    return null;
  }
}
export function normalizeFreebies(input: unknown, limit = 8): FreebieItem[] {
  if (!Array.isArray(input) || !Number.isSafeInteger(limit) || limit <= 0) return [];
  const items: FreebieItem[] = [];
  const seen = new Set<number>();
  for (const value of input.slice(0, 200)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const row = value as Record<string, unknown>;
    const link = providerUrl(row.open_giveaway_url);
    if (
      typeof row.id !== 'number' ||
      !Number.isSafeInteger(row.id) ||
      row.id <= 0 ||
      seen.has(row.id) ||
      typeof row.title !== 'string' ||
      !row.title.trim() ||
      row.type !== 'Game' ||
      row.status !== 'Active' ||
      !link?.pathname.startsWith('/open/')
    )
      continue;
    const image = providerUrl(row.thumbnail);
    seen.add(row.id);
    items.push({
      id: row.id,
      title: row.title.trim().slice(0, 200),
      worth:
        typeof row.worth === 'string' && /^\$\d+(?:\.\d{2})?$/.test(row.worth)
          ? row.worth
          : 'no indicado',
      thumbnail: image?.pathname.startsWith('/offers/') ? image.href : null,
      openGiveawayUrl: link.href,
      platforms:
        typeof row.platforms === 'string' && row.platforms.trim()
          ? row.platforms.slice(0, 150)
          : 'Plataforma no indicada',
      endDate:
        typeof row.end_date === 'string' &&
        /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(row.end_date)
          ? row.end_date
          : null,
    });
    if (items.length === limit) break;
  }
  return items;
}
