export interface FreebieItem {
  id: number;
  title: string;
  worth: string;
  thumbnail: string | null;
  openGiveawayUrl: string;
  platforms: string;
  endDate: string | null;
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
export function normalizeFreebies(input: unknown): FreebieItem[] {
  if (!Array.isArray(input)) return [];
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
    if (items.length === 8) break;
  }
  return items;
}
