export type WorldsViewMode = 'normal' | 'cinema' | 'theater';
export function worldsViewModeForKey(mode: WorldsViewMode, key: string): WorldsViewMode {
  if (key === 'Escape') return 'normal';
  const target =
    key.toLowerCase() === 'c' ? 'cinema' : key.toLowerCase() === 't' ? 'theater' : null;
  return target ? (mode === target ? 'normal' : target) : mode;
}
// Official League of Legends uploads verified through YouTube oEmbed, 2026-10-14.
export const WORLDS_ANTHEMS = [
  { year: 2026, title: 'Know My Name', artist: 'True Damage', id: 'mlFxxNsExJc' },
  { year: 2025, title: 'Sacrifice', artist: 'G.E.M.', id: 'pzt6SmvGpXk' },
  { year: 2024, title: 'Heavy Is The Crown', artist: 'Linkin Park', id: '5FrhtahQiRc' },
  { year: 2023, title: 'GODS', artist: 'NewJeans', id: 'C3GouGa0noM' },
  { year: 2022, title: "STAR WALKIN'", artist: 'Lil Nas X', id: 'HYsz1hP0BFo' },
  { year: 2021, title: 'Burn It All Down', artist: 'PVRIS', id: '1Z6CHioIn3s' },
  { year: 2020, title: 'Take Over', artist: 'Jeremy McKinnon, MAX, Henry', id: 'KbNL9ZyB49c' },
  { year: 2019, title: 'Phoenix', artist: 'Cailin Russo & Chrissy Costanza', id: 'i1IKnWDecwA' },
  { year: 2018, title: 'RISE', artist: 'The Glitch Mob, Mako, The Word Alive', id: 'fB8TyLTD7EE' },
  { year: 2017, title: 'Legends Never Die', artist: 'Against The Current', id: '4Q46xYqUwZQ' },
  { year: 2014, title: 'Warriors', artist: 'Imagine Dragons', id: 'fmI_Ndrxy14' },
] as const;
export const KDA_TRACKS = [
  {
    year: 2018,
    title: 'POP/STARS',
    artist: 'K/DA ft. Madison Beer, (G)I-DLE, Jaira Burns',
    id: 'UOxkGD8qRB4',
  },
  {
    year: 2020,
    title: 'MORE',
    artist: 'K/DA ft. Madison Beer, (G)I-DLE, Lexie Liu, Jaira Burns, Seraphine',
    id: '3VTkBuxU4yk',
  },
  {
    year: 2020,
    title: 'THE BADDEST',
    artist: 'K/DA ft. (G)I-DLE, Bea Miller, Wolftyla',
    id: 'RkID8_gnTxw',
  },
  { year: 2020, title: 'VILLAIN', artist: 'K/DA ft. Madison Beer, Kim Petras', id: 'xoWxv2yZXLQ' },
  {
    year: 2020,
    title: 'DRUM GO DUM',
    artist: 'K/DA ft. Aluna, Wolftyla, Bekuh BOOM',
    id: 'E_PbH5y70Tc',
  },
  {
    year: 2020,
    title: "I'LL SHOW YOU",
    artist: 'K/DA ft. TWICE, Bekuh BOOM, Annika Wells',
    id: 'WW1BpABbzHs',
  },
] as const;
export const ALL_WORLDS_TRACKS = [...WORLDS_ANTHEMS, ...KDA_TRACKS];
export function worldsMusicUrl(id: string, origin: string): string {
  if (!ALL_WORLDS_TRACKS.some((track) => track.id === id)) throw new Error('Pista no válida');
  const params = new URLSearchParams({
    autoplay: '1',
    enablejsapi: '1',
    playsinline: '1',
    rel: '0',
    origin,
  });
  return `https://www.youtube.com/embed/${id}?${params}`;
}

export function trackThumbnailUrl(id: string): string {
  if (!ALL_WORLDS_TRACKS.some((track) => track.id === id)) throw new Error('Pista no válida');
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}
export function nextTrackIndex(current: number, total: number): number {
  return total > 0 ? (current + 1) % total : 0;
}
export function prevTrackIndex(current: number, total: number): number {
  return total > 0 ? (current - 1 + total) % total : 0;
}
