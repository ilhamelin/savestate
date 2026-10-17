export interface GameAdaptationLink {
  tmdbId: number;
  mediaType: 'tv' | 'movie';
  title: string;
  gameSlug: string;
  gameTitle: string;
  developerOrPublisher: string;
  featuredOrder?: number;
  subtitle?: string;
  rankBadge?: string;
  statusBadge?: string;
  certification?: string;
  shortTitle?: string;
  streamingBadges?: string[];
}
export const GAME_ADAPTATIONS_MATRIX: GameAdaptationLink[] = [
  {
    tmdbId: 94605,
    mediaType: 'tv',
    title: 'Arcane: League of Legends',
    gameSlug: 'league-of-legends',
    gameTitle: 'League of Legends',
    developerOrPublisher: 'Riot Games / Fortiche',
    featuredOrder: 1,
    shortTitle: '01 Arcane T2',
    subtitle: 'Temporada 2 · El Clímax de Piltover y Zaun',
    rankBadge: '[ADAPTACIÓN GAMER // VALORADA #1]',
    statusBadge: 'TEMPORADA FINAL AL AIRE',
    certification: 'TV-16',
    streamingBadges: ['NETFLIX 4K', 'MAX'],
  },
  {
    tmdbId: 100088,
    mediaType: 'tv',
    title: 'The Last of Us',
    gameSlug: 'the-last-of-us-part-i',
    gameTitle: 'The Last of Us',
    developerOrPublisher: 'Naughty Dog / HBO',
    featuredOrder: 2,
    shortTitle: '02 The Last of Us T2',
    subtitle: 'Temporada 2 · El Precio de la Venganza',
    rankBadge: '[ADAPTACIÓN GAMER // DESTACADA #2]',
    statusBadge: 'PRÓXIMAMENTE EN STREAMING',
    certification: 'TV-MA',
    streamingBadges: ['MAX 4K'],
  },
  {
    tmdbId: 105248,
    mediaType: 'tv',
    title: 'Cyberpunk: Edgerunners',
    gameSlug: 'cyberpunk-2077',
    gameTitle: 'Cyberpunk 2077',
    developerOrPublisher: 'CD Projekt Red / Studio Trigger',
  },
  {
    tmdbId: 106379,
    mediaType: 'tv',
    title: 'Fallout',
    gameSlug: 'fallout-4',
    gameTitle: 'Fallout',
    developerOrPublisher: 'Bethesda / Kilter Films',
    featuredOrder: 3,
    shortTitle: '03 Fallout',
    subtitle: 'Temporada 1 · Bienvenidos al Yermo',
    rankBadge: '[ADAPTACIÓN GAMER // DESTACADA #3]',
    statusBadge: 'TEMPORADA 2 EN PRODUCCIÓN',
    certification: 'TV-MA',
    streamingBadges: ['PRIME VIDEO'],
  },
  {
    tmdbId: 502356,
    mediaType: 'movie',
    title: 'Super Mario Bros. La película',
    gameSlug: 'super-mario-odyssey',
    gameTitle: 'Super Mario',
    developerOrPublisher: 'Nintendo / Illumination',
    featuredOrder: 5,
    shortTitle: '05 Super Mario',
    subtitle: 'Película Oficial · Reino Champiñón',
    rankBadge: '[ADAPTACIÓN GAMER // TAQUILLA #1]',
    statusBadge: 'DISPONIBLE EN STREAMING',
    certification: 'PG',
    streamingBadges: ['MAX', 'PRIME VIDEO'],
  },
  {
    tmdbId: 939243,
    mediaType: 'movie',
    title: 'Sonic 3: La Película',
    gameSlug: 'sonic-frontiers',
    gameTitle: 'Sonic The Hedgehog',
    developerOrPublisher: 'SEGA / Paramount',
  },
  {
    tmdbId: 123548,
    mediaType: 'tv',
    title: 'Castlevania: Nocturne',
    gameSlug: 'castlevania-symphony-of-the-night',
    gameTitle: 'Castlevania',
    developerOrPublisher: 'Konami / Project 51',
    featuredOrder: 4,
    shortTitle: '04 Castlevania: Nocturne',
    subtitle: 'Temporada 2 · La Revolución de Richter',
    rankBadge: '[ADAPTACIÓN GAMER // DESTACADA #4]',
    statusBadge: 'EN EMISIÓN',
    certification: 'TV-MA',
    streamingBadges: ['NETFLIX'],
  },
  {
    tmdbId: 52814,
    mediaType: 'tv',
    title: 'Halo: La Serie',
    gameSlug: 'halo-infinite',
    gameTitle: 'Halo',
    developerOrPublisher: '343 Industries / Paramount+',
  },
];
export function screenAdaptation(tmdbId: number, mediaType: 'tv' | 'movie') {
  return GAME_ADAPTATIONS_MATRIX.find(
    (item) => item.tmdbId === tmdbId && item.mediaType === mediaType,
  );
}
export function gameAdaptations(slug: string) {
  return GAME_ADAPTATIONS_MATRIX.filter((item) => item.gameSlug === slug);
}
