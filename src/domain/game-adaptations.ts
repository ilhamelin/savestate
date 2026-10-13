export interface GameAdaptationLink {
  tmdbId: number;
  mediaType: 'tv' | 'movie';
  title: string;
  gameSlug: string;
  gameTitle: string;
  developerOrPublisher: string;
  featuredOrder?: number;
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
  },
  {
    tmdbId: 100088,
    mediaType: 'tv',
    title: 'The Last of Us',
    gameSlug: 'the-last-of-us-part-i',
    gameTitle: 'The Last of Us',
    developerOrPublisher: 'Naughty Dog / HBO',
    featuredOrder: 2,
  },
  {
    tmdbId: 105248,
    mediaType: 'tv',
    title: 'Cyberpunk: Edgerunners',
    gameSlug: 'cyberpunk-2077',
    gameTitle: 'Cyberpunk 2077',
    developerOrPublisher: 'CD Projekt Red / Studio Trigger',
    featuredOrder: 3,
  },
  {
    tmdbId: 106379,
    mediaType: 'tv',
    title: 'Fallout',
    gameSlug: 'fallout-4',
    gameTitle: 'Fallout',
    developerOrPublisher: 'Bethesda / Kilter Films',
    featuredOrder: 4,
  },
  {
    tmdbId: 502356,
    mediaType: 'movie',
    title: 'Super Mario Bros. La película',
    gameSlug: 'super-mario-odyssey',
    gameTitle: 'Super Mario',
    developerOrPublisher: 'Nintendo / Illumination',
    featuredOrder: 5,
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
    tmdbId: 100883,
    mediaType: 'tv',
    title: 'Castlevania: Nocturne',
    gameSlug: 'castlevania-symphony-of-the-night',
    gameTitle: 'Castlevania',
    developerOrPublisher: 'Konami / Project 51',
  },
  {
    tmdbId: 87108,
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
