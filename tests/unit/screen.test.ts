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
  extractTmdbTrailerId,
  screenFollowedMedia,
  screenAirDate,
  screenCountdown,
  screenRuntimeMinutes,
  screenSeasonProgress,
  type ScreenDetail,
} from '../../src/domain/screen.ts';
import {
  gameAdaptations,
  screenAdaptation,
  GAME_ADAPTATIONS_MATRIX,
} from '../../src/domain/game-adaptations.ts';
import { screenChatCheckpoint } from '../../src/domain/screen-chat.ts';
import { discordComposerPayload, discordInlineMedia } from '../../src/domain/discord-client.ts';
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
  trailerVideoId: null,
};
test('Screen radar uses the official next episode across seasons and retains unknown/ended dates', () => {
  const next = screenFollowedMedia(
    {
      ...detail,
      releaseStatus: 'Returning Series',
      nextEpisodeToAir: { season: 3, episode: 1, title: 'Premiere', airDate: '2026-12-10' },
    },
    { ...screenProgress(), followed: true, currentSeason: 2, watchedEpisodes: [10002, 20001] },
  );
  assert.equal(next.currentEpisodeWatched, 1);
  assert.equal(next.nextSeasonNumber, 3);
  assert.equal(next.nextEpisodeNumber, 1);
  assert.equal(next.nextAirDate, '2026-12-10');
  assert.equal(next.followed, true);
  const pending = screenFollowedMedia(
    {
      ...detail,
      episodes: [
        {
          seasonNumber: 1,
          episodeNumber: 1,
          title: 'First',
          overview: '',
          airDate: '2026-01-01',
          watched: false,
        },
      ],
    },
    screenProgress(),
  );
  assert.equal(pending.nextEpisodeNumber, 1);
  assert.equal(
    screenFollowedMedia({ ...detail, releaseStatus: 'Ended' }, screenProgress()).statusText,
    'Serie finalizada',
  );
  assert.equal(screenFollowedMedia(detail, screenProgress()).nextAirDate, null);
  assert.equal(
    screenFollowedMedia(
      { ...detail, mediaType: 'movie', releaseDate: '2026-12-17' },
      screenProgress(),
    ).nextAirDate,
    '2026-12-17',
  );
  assert.equal(screenProgress().followed, false);
  assert.equal(
    validateScreenProgress({ ...screenProgress(), followed: true }, detail).followed,
    true,
  );
  assert.throws(() => validateScreenProgress({ ...screenProgress(), followed: 'true' }, detail));
});
test('Screen countdown handles UTC premiere days, past dates, unknowns and exact seconds', () => {
  assert.equal(screenAirDate('2026-02-30'), null);
  assert.equal(screenCountdown(null, Date.now()), 'POR ANUNCIAR');
  assert.equal(
    screenCountdown('2026-12-10', Date.parse('2026-12-09T11:24:42Z')),
    '00d : 12h : 35m : 18s',
  );
  assert.equal(screenCountdown('2026-12-10', Date.parse('2026-12-10T23:59:00Z')), '¡ESTRENO HOY!');
  assert.equal(screenCountdown('2026-12-10', Date.parse('2026-12-11T00:00:00Z')), 'DISPONIBLE');
});
test('Screen telemetry counts only the selected season and deduplicates watched episode keys', () => {
  const progress = {
    ...screenProgress(),
    currentSeason: 2,
    watchedEpisodes: [10001, 20001, 20002, 20002, 20003, 40001],
  };
  assert.deepEqual(screenSeasonProgress(detail, progress), { watched: 2, total: 2, percent: 100 });
  assert.deepEqual(screenSeasonProgress(detail, { ...progress, watchedEpisodes: [10001, 20001] }), {
    watched: 1,
    total: 2,
    percent: 50,
  });
  assert.deepEqual(screenSeasonProgress({ ...detail, seasons: [], episodes: [] }, progress), {
    watched: 0,
    total: 0,
    percent: 0,
  });
});
test('Screen durations use actual finite runtime values without fabricated movie or episode defaults', () => {
  assert.equal(screenRuntimeMinutes({ runtime: 112 }, 'movie'), 112);
  assert.equal(screenRuntimeMinutes({ episode_run_time: [24, 26, 0, null, '30'] }, 'tv'), 25);
  for (const value of [
    null,
    {},
    { runtime: -1 },
    { runtime: NaN },
    { runtime: 1441 },
    { runtime: '90' },
  ])
    assert.equal(screenRuntimeMinutes(value, 'movie'), null);
  assert.equal(screenRuntimeMinutes({ episode_run_time: [] }, 'tv'), null);
});
test('Screen trailers prefer valid YouTube trailers, official Spanish/English versions and safe teaser fallbacks', () => {
  const video = (key: string, type = 'Trailer', extra: Record<string, unknown> = {}) => ({
    key,
    type,
    site: 'YouTube',
    official: true,
    iso_639_1: 'en',
    ...extra,
  });
  assert.equal(
    extractTmdbTrailerId({ results: [video('aaaaaaaaaaa', 'Teaser'), video('bbbbbbbbbbb')] }),
    'bbbbbbbbbbb',
  );
  assert.equal(
    extractTmdbTrailerId({
      results: [video('aaaaaaaaaaa'), video('bbbbbbbbbbb', 'Trailer', { iso_639_1: 'es' })],
    }),
    'bbbbbbbbbbb',
  );
  assert.equal(
    extractTmdbTrailerId({
      results: [
        video('aaaaaaaaaaa', 'Trailer', { official: false, iso_639_1: 'es' }),
        video('bbbbbbbbbbb'),
      ],
    }),
    'bbbbbbbbbbb',
  );
  assert.equal(extractTmdbTrailerId({ results: [video('0kAAqslOS64', 'Teaser')] }), '0kAAqslOS64');
  for (const key of ['https://evil.test/a', 'too-short', '../badvideo!', 'aaaaaaaaaaa?autoplay=1'])
    assert.equal(extractTmdbTrailerId({ results: [video(key)] }), null);
  assert.equal(
    extractTmdbTrailerId({
      results: [video('aaaaaaaaaaa', 'Clip'), video('bbbbbbbbbbb', 'Trailer', { site: 'Vimeo' })],
    }),
    null,
  );
  for (const input of [null, [], { results: null }, { results: [null, 7, {}] }])
    assert.equal(extractTmdbTrailerId(input), null);
});
test('Screen trailers prioritize Latin American countries and Spanish Latino titles', () => {
  const video = (key: string, language: string, country?: string, name = '') => ({
    key,
    site: 'YouTube',
    type: 'Trailer',
    official: true,
    iso_639_1: language,
    iso_3166_1: country,
    name,
  });
  const english = video('aaaaaaaaaaa', 'en');
  const spain = video('bbbbbbbbbbb', 'es', 'ES');
  for (const country of ['MX', 'AR', 'CL', 'CO', 'PE', 'LA']) {
    assert.equal(
      extractTmdbTrailerId({ results: [english, spain, video('ccccccccccc', 'es', country)] }),
      'ccccccccccc',
    );
  }
  for (const name of ['Tráiler Oficial Latino', 'Hispanoamérica', 'Doblado']) {
    assert.equal(
      extractTmdbTrailerId({ results: [spain, video('ccccccccccc', 'es', undefined, name)] }),
      'ccccccccccc',
    );
  }
  assert.equal(
    extractTmdbTrailerId({ results: [english, spain, video('ccccccccccc', 'es')] }),
    'ccccccccccc',
  );
  assert.equal(extractTmdbTrailerId({ results: [english, spain] }), 'bbbbbbbbbbb');
  assert.equal(
    extractTmdbTrailerId({ results: [english, video('ccccccccccc', 'en', 'US', 'Latino')] }),
    'aaaaaaaaaaa',
  );
  assert.equal(
    extractTmdbTrailerId({
      results: [english, { ...video('ccccccccccc', 'es', 'MX'), official: false }],
    }),
    'aaaaaaaaaaa',
  );
  assert.equal(
    extractTmdbTrailerId({
      results: [english, { ...video('ccccccccccc', 'es', 'MX'), type: 'Teaser' }],
    }),
    'aaaaaaaaaaa',
  );
});

test('Screen checkpoints share progress and official media through the unified chat without private notes', () => {
  const progress = {
    ...screenProgress(),
    status: 'watching' as const,
    rating: 9,
    currentSeason: 2,
    watchedEpisodes: [10001, 20001],
    notes: 'PRIVATE',
  };
  const mediaUrl = 'https://image.tmdb.org/t/p/w780/poster.jpg';
  const shared = screenChatCheckpoint({ ...detail, backdropUrl: mediaUrl }, progress);
  assert.match(shared.content, /📺 CHECKPOINT \/\/ Screen\n🍿 Arcane/);
  assert.match(shared.content, /Estado: Viendo/);
  assert.match(shared.content, /9\/10/);
  assert.match(shared.content, /S2 · 2 \/ 4 episodios vistos \(50%\)/);
  assert.match(shared.content, /\/screen\?select=94605&type=tv$/);
  assert.ok(!shared.content.includes('PRIVATE'));
  assert.deepEqual(discordComposerPayload(shared.content, shared.mediaUrl), shared);
  assert.deepEqual(discordInlineMedia(mediaUrl).urls, [mediaUrl]);
  const movie = screenChatCheckpoint(
    { ...detail, mediaType: 'movie', backdropUrl: '/demo.jpg', posterUrl: mediaUrl },
    { ...progress, status: 'completed', rating: null },
  );
  assert.match(movie.content, /🎬 CHECKPOINT/);
  assert.match(movie.content, /Sin calificación/);
  assert.match(movie.content, /Película · Vista \(100%\)/);
  assert.equal(movie.mediaUrl, mediaUrl);
  assert.equal(
    screenChatCheckpoint(
      { ...detail, backdropUrl: 'https://image.tmdb.org.evil.test/a.jpg' },
      progress,
    ).mediaUrl,
    null,
  );
  const long = screenChatCheckpoint(
    {
      ...detail,
      title: '🎬'.repeat(300),
      seasons: [{ number: 2, name: 'S'.repeat(300), episodeCount: 2 }],
    },
    progress,
  );
  assert.ok(long.content.length <= 500);
  assert.doesNotThrow(() => discordComposerPayload(long.content, long.mediaUrl));
});

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
test('Screen hero has five ordered prototype slots with complete editorial metadata', () => {
  const slots = GAME_ADAPTATIONS_MATRIX.filter((item) => item.featuredOrder).sort(
    (a, b) => a.featuredOrder! - b.featuredOrder!,
  );
  assert.deepEqual(
    slots.map((item) => item.tmdbId),
    [94605, 100088, 106379, 123548, 502356],
  );
  slots.forEach((item, index) => {
    assert.ok(item.shortTitle?.startsWith(String(index + 1).padStart(2, '0')));
    for (const field of [
      'subtitle',
      'rankBadge',
      'statusBadge',
      'certification',
      'shortTitle',
    ] as const)
      assert.ok(item[field]);
    assert.ok(item.streamingBadges?.length);
  });
  assert.equal(screenAdaptation(105248, 'tv')?.featuredOrder, undefined);
  assert.equal(
    screenAdaptation(94605, 'tv')?.subtitle,
    'Temporada 2 · El Clímax de Piltover y Zaun',
  );
});
