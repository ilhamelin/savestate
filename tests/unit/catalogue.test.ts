import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFilters, igdbQuery, mapIgdbGame } from '../../src/integrations/igdb/query.ts';
test('IGDB: query strings escape quotes and reject invalid numeric filters', () => {
  const query = igdbQuery(parseFilters(new URLSearchParams({ q: 'Halo"; limit 500;' })));
  assert.ok(query.includes('Halo\\"; limit 500;'));
  assert.throws(() => parseFilters(new URLSearchParams({ year: 'NaN' })));
  assert.throws(() => parseFilters(new URLSearchParams({ rating: '-1' })));
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
