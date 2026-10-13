import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeScreenMedia,
  normalizeScreenProviders,
  screenId,
  screenRegion,
  screenEpisodeKey,
  screenProgress,
  validateScreenProgress,
  screenPercent,
  tmdbImage,
  type ScreenDetail,
} from '../../src/domain/screen.ts';
import { gameAdaptations, screenAdaptation } from '../../src/domain/game-adaptations.ts';
const detail: ScreenDetail = {
  id: 'tv:94605',
  tmdbId: 94605,
  mediaType: 'tv',
  title: 'Arcane',
  overview: '',
  posterUrl: null,
  backdropUrl: null,
  releaseYear: 2021,
  rating: 9,
  voteCount: 10,
  providers: [],
  source: 'tmdb',
  seasons: [
    { number: 1, name: 'S1', episodeCount: 2 },
    { number: 2, name: 'S2', episodeCount: 2 },
  ],
  episodes: [],
  totalEpisodes: 4,
  credits: [],
  providerLink: null,
};
test('Screen distinguishes movie and TV IDs and rejects person/adult/unsafe image data', () => {
  const row = {
    id: 10,
    title: 'Title',
    media_type: 'movie',
    poster_path: '/abc.jpg',
    release_date: '2026-01-02',
    vote_average: 8,
  };
  assert.equal(normalizeScreenMedia(row)?.id, 'movie:10');
  assert.equal(
    normalizeScreenMedia({ ...row, media_type: 'tv', title: undefined, name: 'Series' })?.id,
    'tv:10',
  );
  assert.equal(normalizeScreenMedia({ ...row, media_type: 'person' }), null);
  assert.equal(normalizeScreenMedia({ ...row, adult: true }), null);
  assert.equal(tmdbImage('https://evil.test/a.jpg'), null);
  assert.equal(tmdbImage('/../a.jpg'), null);
  assert.throws(() => screenId('-10'));
  assert.throws(() => screenRegion('XX'));
});
test('Screen providers are isolated by region and preserve subscription/rent/buy semantics', () => {
  const payload = {
    results: {
      CL: {
        link: 'https://www.themoviedb.org/tv/94605/watch?locale=CL',
        flatrate: [{ provider_id: 8, provider_name: 'Netflix', logo_path: '/n.jpg' }],
        rent: [{ provider_id: 3, provider_name: 'Rent' }],
      },
      US: { link: 'https://evil.test', flatrate: [{ provider_id: 4, provider_name: 'Fake' }] },
    },
  };
  assert.equal(normalizeScreenProviders(payload, 'CL').providers.length, 2);
  assert.equal(normalizeScreenProviders(payload, 'CL').providers[1]?.offer, 'rent');
  assert.deepEqual(normalizeScreenProviders(payload, 'US'), { providers: [], link: null });
  assert.deepEqual(normalizeScreenProviders(payload, 'MX'), { providers: [], link: null });
});
test('Screen progress keeps identical episode numbers in different seasons separate and validates authoritative counts', () => {
  const input = {
    ...screenProgress(),
    status: 'watching',
    currentSeason: 2,
    currentEpisode: 1,
    watchedEpisodes: [10001, 20001, 10001],
    notes: '  save point  ',
    totalEpisodes: 999,
  };
  const result = validateScreenProgress(input, detail);
  assert.deepEqual(result.watchedEpisodes, [10001, 20001]);
  assert.equal(result.totalEpisodes, 4);
  assert.equal(result.notes, 'save point');
  assert.equal(screenPercent(result), 50);
  assert.notEqual(screenEpisodeKey(1, 1), screenEpisodeKey(2, 1));
  for (const patch of [
    { watchedEpisodes: [10003] },
    { watchedEpisodes: [30001] },
    { rating: 11 },
    { rating: 3.3 },
    { notes: 'x'.repeat(2001) },
    { currentEpisode: 3 },
    { currentSeason: 3 },
    { status: 'playing' },
  ])
    assert.throws(() => validateScreenProgress({ ...input, ...patch }, detail));
});
test('Screen supports movies and unreleased series without invented episode progress', () => {
  const movie = { ...detail, mediaType: 'movie' as const, seasons: [], totalEpisodes: 1 };
  assert.throws(() =>
    validateScreenProgress({ ...screenProgress(), watchedEpisodes: [10001] }, movie),
  );
  assert.equal(
    screenPercent(validateScreenProgress({ ...screenProgress(), status: 'completed' }, movie)),
    100,
  );
  assert.doesNotThrow(() =>
    validateScreenProgress(screenProgress(), { ...detail, seasons: [], totalEpisodes: 0 }),
  );
});
test('Game-to-Screen links are bidirectional and media-type aware', () => {
  assert.equal(gameAdaptations('league-of-legends')[0]?.tmdbId, 94605);
  assert.equal(screenAdaptation(502356, 'movie')?.gameSlug, 'super-mario-odyssey');
  assert.equal(screenAdaptation(502356, 'tv'), undefined);
  assert.deepEqual(gameAdaptations('not-a-game'), []);
});
