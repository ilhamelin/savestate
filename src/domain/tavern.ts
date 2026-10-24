export const TAVERN_TABS = ['debates', 'momentos', 'arcade'] as const;
export type TavernTab = (typeof TAVERN_TABS)[number];
export type TavernSearchParams = Record<string, string | string[] | undefined>;
export interface TavernPageProps {
  searchParams: Promise<TavernSearchParams>;
}
export function tavernTab(value: unknown): TavernTab {
  return value === 'momentos' || value === 'arcade' ? value : 'debates';
}
/** Preserve repeated query values and drafts; a legacy section can enforce its canonical tab. */
export function legacyTavernHref(search: TavernSearchParams, forcedTab?: TavernTab): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (forcedTab && key === 'tab') continue;
    if (Array.isArray(value)) value.forEach((item) => query.append(key, item));
    else if (value !== undefined) query.append(key, value);
  }
  if (forcedTab && forcedTab !== 'debates') query.set('tab', forcedTab);
  return '/tavern' + (query.size ? '?' + query : '');
}
