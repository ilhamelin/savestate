import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseFilters,
  resolveCanonicalPlatform,
  igdbQuery,
  mapIgdbGame,
  daysUntilRelease,
} from '../../src/integrations/igdb/query.ts';
test('IGDB: query strings escape quotes and reject invalid numeric filters', () => {
  const query = igdbQuery(parseFilters(new URLSearchParams({ q: 'Halo"; limit 500;' })));
  assert.ok(query.includes('Halo\\"; limit 500;'));
  assert.throws(() => parseFilters(new URLSearchParams({ year: 'NaN' })));
  assert.throws(() => parseFilters(new URLSearchParams({ rating: '-1' })));
  assert.throws(() => parseFilters(new URLSearchParams({ offset: '-24' })));
  assert.throws(() => parseFilters(new URLSearchParams({ offset: '1' })));
  assert.throws(() => parseFilters(new URLSearchParams({ offset: '984' })));
  assert.throws(() => parseFilters(new URLSearchParams({ sort: 'name; limit 500' })));
});
test('IGDB: páginas independientes, recientes sin fechas futuras y clásicos antes de 2010', () => {
  const next = igdbQuery(parseFilters(new URLSearchParams({ offset: '24' })));
  assert.ok(next.includes('offset 24;'));
  assert.ok(next.includes('sort total_rating_count desc;'));
  const recent = igdbQuery(parseFilters(new URLSearchParams({ sort: 'recent' })));
  assert.ok(recent.includes('first_release_date <= '));
  assert.ok(recent.includes('sort first_release_date desc;'));
  const classics = igdbQuery(parseFilters(new URLSearchParams({ sort: 'classics' })));
  assert.ok(classics.includes('first_release_date < 1262304000'));
});
test('IGDB: maps metadata without trusting arbitrary cover hosts', () => {
  const game = mapIgdbGame({
    id: 1,
    name: 'Chrono Trigger',
    slug: 'chrono-trigger',
    cover: { image_id: 'https://evil.test' },
  });
  assert.equal(game.cover_url, null);
  assert.deepEqual(game.platforms, []);
  assert.throws(() => mapIgdbGame({ id: -1, name: 'Bad', slug: 'bad' }));
});
test('IGDB: upcoming requires a future release and cover, preserving pagination', () => {
  const filters = parseFilters(new URLSearchParams({ sort: 'upcoming', offset: '24' }));
  assert.equal(filters.sort, 'upcoming');
  const query = igdbQuery(filters);
  assert.match(query, /first_release_date > \d+/);
  assert.ok(query.includes('cover.image_id != null'));
  assert.ok(query.includes('sort first_release_date asc; limit 24; offset 24;'));
});
test('IGDB: countdown rounds future partial days up and excludes past or unknown dates', () => {
  const now = Date.UTC(2026, 9, 10, 12);
  assert.equal(daysUntilRelease((now + 1000) / 1000, now), 1);
  assert.equal(daysUntilRelease((now + 86400000) / 1000, now), 1);
  assert.equal(daysUntilRelease((now + 86401000) / 1000, now), 2);
  for (const timestamp of [null, undefined, 0, NaN, Infinity, now / 1000, (now - 1000) / 1000]) {
    assert.equal(daysUntilRelease(timestamp, now), null);
  }
  assert.equal(
    'first_release_date' in
      mapIgdbGame({
        id: 1,
        name: 'Upcoming',
        slug: 'upcoming',
        first_release_date: (now + 86400000) / 1000,
      }),
    false,
  );
});

test('IGDB: platform aliases use canonical names and unknown platforms keep safe partial matching', () => {
  for (const [input, canonical] of [
    ['pc', 'PC (Microsoft Windows)'],
    [' PS5 ', 'PlayStation 5'],
    ['switch', 'Nintendo Switch'],
    ['SNES', 'Super Nintendo Entertainment System'],
    ['Xbox Series S', 'Xbox Series X|S'],
  ] as const) {
    assert.deepEqual(resolveCanonicalPlatform(input), { canonical, raw: canonical });
    assert.ok(
      igdbQuery(parseFilters(new URLSearchParams({ platform: input }))).includes(
        'platforms.name = ' + JSON.stringify(canonical),
      ),
    );
  }
  assert.deepEqual(resolveCanonicalPlatform(''), { canonical: null, raw: '' });
  assert.deepEqual(resolveCanonicalPlatform('Dreamcast'), { canonical: null, raw: 'Dreamcast' });
  assert.equal(resolveCanonicalPlatform('constructor').canonical, null);
  assert.ok(
    igdbQuery(parseFilters(new URLSearchParams({ platform: 'Dreamcast' }))).includes(
      'platforms.name ~ *"Dreamcast"*',
    ),
  );
});
test('IGDB: numeric rating is filtered upstream without changing persisted game columns', () => {
  const query = igdbQuery(parseFilters(new URLSearchParams({ rating: '8' })));
  assert.ok(query.includes('total_rating >= 80'));
  assert.ok(query.includes('first_release_date,total_rating,platforms.name'));
  assert.equal(
    'total_rating' in mapIgdbGame({ id: 1, name: 'Game', slug: 'game', total_rating: 85 }),
    false,
  );
  assert.equal(
    'igdb_rating' in mapIgdbGame({ id: 1, name: 'Game', slug: 'game', total_rating: 85 }),
    false,
  );
});
test('IGDB: explicit years override conflicting catalogue modes while keeping year ranges', () => {
  const classics = igdbQuery(parseFilters(new URLSearchParams({ sort: 'classics', year: '2024' })));
  assert.equal(classics.includes('first_release_date < 1262304000'), false);
  assert.ok(classics.includes('first_release_date >= ' + Date.UTC(2024, 0, 1) / 1000));
  const currentYear = new Date().getUTCFullYear();
  const past = igdbQuery(
    parseFilters(new URLSearchParams({ sort: 'upcoming', year: String(currentYear - 1) })),
  );
  assert.equal(past.includes('first_release_date > '), false);
  assert.ok(past.includes('cover.image_id != null'));
  const future = igdbQuery(
    parseFilters(new URLSearchParams({ sort: 'recent', year: String(currentYear + 1) })),
  );
  assert.equal(future.includes('first_release_date <= '), false);
});
