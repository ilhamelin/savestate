import test from 'node:test';
import assert from 'node:assert/strict';
import { lolPage, mergeLolMatches } from '../../src/domain/lol-pages.ts';
import { lolAnalytics } from '../../src/domain/lol-analytics.ts';
import type { LolMatchSummary } from '../../src/domain/lol-tracker.ts';

test('Rift pagination validates integer bounds and default batch size', () => {
  assert.deepEqual(lolPage(), { start: 0, count: 10 });
  assert.deepEqual(lolPage(20, 10), { start: 20, count: 10 });
  for (const start of [-1, 0.5, '10', null, NaN, Infinity, 10001])
    assert.throws(() => lolPage(start, 10));
  for (const count of [0, 11, 0.5, '10', null, NaN]) assert.throws(() => lolPage(0, count));
});
test('Rift accumulated pages deduplicate overlapping IDs and expand analytics without mutation', () => {
  const rows = Array.from(
    { length: 30 },
    (_, i) =>
      ({
        matchId: `LA2_${i}`,
        gameEndTimestamp: 30 - i,
        player: {
          championName: 'Ahri',
          championIcon: null,
          role: 'MIDDLE',
          kills: 4,
          deaths: 2,
          assists: 6,
          win: i % 2 === 0,
        },
      }) as LolMatchSummary,
  );
  const first = rows.slice(0, 10);
  const second = mergeLolMatches(first, rows.slice(8, 20));
  const third = mergeLolMatches(second, rows.slice(18));
  assert.equal(first.length, 10);
  assert.equal(second.length, 20);
  assert.equal(third.length, 30);
  assert.equal(new Set(third.map((row) => row.matchId)).size, 30);
  assert.equal(lolAnalytics(third).champions[0]?.games, 30);
  assert.equal(lolAnalytics(third).roles[0]?.winrate, 50);
  assert.deepEqual(mergeLolMatches(first, []), first);
});
