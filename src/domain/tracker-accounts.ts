import { trackerUid } from './validation.ts';
import { steamProfile } from './steam.ts';
import { competitiveInput } from './competitive-tracker.ts';
export type TrackerTab = 'lol' | 'valorant' | 'genshin' | 'hsr' | 'rust';
export function recentTrackerUids(value: unknown, latest?: string): string[] {
  const rows = Array.isArray(value) ? value : [];
  return [
    ...new Set(
      [...(latest ? [latest] : []), ...rows].filter(
        (uid): uid is string => typeof uid === 'string' && /^\d{9,10}$/.test(uid),
      ),
    ),
  ].slice(0, 5);
}
export function trackerLink(params: Record<string, string | string[] | undefined>) {
  const tab: TrackerTab =
    typeof params.game === 'string' && ['genshin', 'hsr', 'valorant', 'rust'].includes(params.game)
      ? (params.game as TrackerTab)
      : 'lol';
  let identity: string | undefined;
  let error: string | null = null;
  if (tab !== 'lol' && params.uid !== undefined) {
    try {
      if (typeof params.uid !== 'string') throw new Error('Identificador ambiguo.');
      if (tab === 'genshin' || tab === 'hsr') identity = trackerUid(params.uid, 'UID') ?? undefined;
      else if (tab === 'rust') {
        steamProfile(params.uid);
        identity = params.uid.trim();
      } else {
        competitiveInput({ game: 'valorant', riotId: params.uid, region: 'latam' });
        identity = params.uid.trim();
      }
    } catch {
      error = 'El enlace del tracker contiene un identificador inválido.';
    }
  }
  const query = new URLSearchParams();
  if (tab !== 'lol') {
    query.set('game', tab);
    if (identity) query.set('uid', identity);
  }
  return { tab, identity, error, next: query.size ? `/rift?${query}` : '/rift' };
}
