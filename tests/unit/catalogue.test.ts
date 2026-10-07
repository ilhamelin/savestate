import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFilters, igdbQuery, mapIgdbGame } from '../../src/integrations/igdb/query.ts';
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
