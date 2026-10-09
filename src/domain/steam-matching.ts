import { text } from './validation.ts';

export function cleanSteamSearchTitle(title: string): string {
  return title
    .replace(/[™®©]/g, '')
    .replace(/\[[^\]]*\]|\([^)]*\)/g, '')
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function searchSteamCandidates<T>(
  title: string,
  search: (query: string, platform?: string) => Promise<T[]>,
): Promise<T[]> {
  const cleaned = cleanSteamSearchTitle(text(title, 'Título', 200));
  const query = text(cleaned.slice(0, 80), 'Título de búsqueda', 80);
  const pc = await search(query, 'PC (Microsoft Windows)');
  if (pc.length) return pc;
  const universal = await search(query);
  if (universal.length) return universal;
  const root = cleaned.split(/[:-]/)[0]?.trim().slice(0, 80);
  return root && root !== query ? search(root) : [];
}

export type SteamMatchFilter = 'all' | 'matched' | 'unmatched';
export function isSteamReady(
  appid: number,
  choices: Record<number, string>,
  finished: Set<number>,
): boolean {
  return Boolean(choices[appid]) || finished.has(appid);
}
