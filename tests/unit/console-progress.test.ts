import test from 'node:test';
import assert from 'node:assert/strict';
import { consoleProgress, consoleProgressLabel } from '../../src/domain/console-progress.ts';
import { xboxTitleRows, psnTitleRows } from '../../src/domain/console-sync.ts';
test('console progress preserves real achievement totals and never invents missing scores', () => {
  const rows = xboxTitleRows([
    {
      name: 'Halo',
      devices: ['XboxOne'],
      achievement: { currentGamerscore: 850, totalGamerscore: 1000 },
    },
    { name: 'Legacy', devices: ['Xbox360'], currentGamerscore: 20, maxGamerscore: 100 },
    { name: 'Unknown', devices: ['XboxOne'] },
  ]);
  assert.equal(consoleProgressLabel(rows[0]!.progress!), '[Xbox Live] 850 / 1000 G');
  assert.deepEqual(rows[1]!.progress, { kind: 'gamerscore', current: 20, total: 100 });
  assert.equal(rows[2]!.progress, undefined);
  assert.ok(rows.every((row) => row.hours === 0));
  const psn = psnTitleRows([
    {
      trophyTitleName: 'PSN',
      trophyTitlePlatform: 'PS5',
      earnedTrophies: { bronze: 8, silver: 2, gold: 1, platinum: 0 },
      definedTrophies: { bronze: 10, silver: 5, gold: 2, platinum: 1 },
    },
  ]);
  assert.equal(consoleProgressLabel(psn[0]!.progress!), '[PlayStation Network] 11 / 18 trofeos');
  for (const value of [
    { kind: 'gamerscore', current: -1, total: 100 },
    { kind: 'gamerscore', current: 1.5, total: 100 },
    { kind: 'gamerscore', current: 10, total: 0 },
    { kind: 'trophies', current: 1, total: 10 },
    {},
  ])
    assert.throws(() => consoleProgress(value, 'Xbox'));
});
