export type ProfileTab = 'library' | 'stats' | 'showcase';
export const PROFILE_TAB_ANCHORS: Record<ProfileTab, string> = {
  library: 'player-library',
  stats: 'player-dossier',
  showcase: 'player-showcase',
};
export function profileTabForHash(hash: string): ProfileTab | null {
  if (hash === '#player-library') return 'library';
  if (hash === '#player-stats' || hash === '#player-dossier') return 'stats';
  if (hash === '#player-showcase' || hash === '#achievements-showcase-heading') return 'showcase';
  return null;
}
