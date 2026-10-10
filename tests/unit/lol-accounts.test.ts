import test from 'node:test';
import assert from 'node:assert/strict';
import { lolAccount, recentLolAccounts, sameLolAccount } from '../../src/domain/lol-accounts.ts';
import { normalizeLolMasteries, dataDragonAssets } from '../../src/domain/lol-tracker.ts';

test('Rift stored accounts reject corrupted values, validate regions and cap deduplicated recents', () => {
  assert.equal(lolAccount(null), null);
  assert.equal(lolAccount({ riotId: 'name', platform: 'la2' }), null);
  assert.equal(lolAccount({ riotId: 'Name#LAS', platform: 'evil.example' }), null);
  assert.equal(lolAccount({ riotId: ['Name#LAS'], platform: 'la2' }), null);
  const a = lolAccount({ riotId: ' Name#LAS ', platform: 'LA2' });
  assert.deepEqual(a, { riotId: 'Name#LAS', platform: 'la2' });
  assert.ok(sameLolAccount(a, lolAccount({ riotId: 'name#las', platform: 'la2' })));
  const values = [
    null,
    a,
    a,
    ...Array.from({ length: 7 }, (_, i) => ({ riotId: `User${i}#LAS`, platform: 'la2' })),
  ];
  assert.equal(recentLolAccounts(values).length, 5);
  assert.equal(recentLolAccounts(values)[0]?.riotId, 'Name#LAS');
  assert.deepEqual(recentLolAccounts({}), []);
});
test('Rift masteries map official champion IDs and reject fabricated points', () => {
  const assets = dataDragonAssets(
    '16.20.1',
    { data: { Ahri: { key: '103', name: 'Ahri', image: { full: 'Ahri.png' } } } },
    { data: {} },
  );
  const rows = normalizeLolMasteries(
    [{ championId: 103, championLevel: 12, championPoints: 340000 }],
    assets,
  );
  assert.equal(rows[0]?.championName, 'Ahri');
  assert.match(rows[0]!.championIcon!, /Ahri.png$/);
  assert.equal(rows[0]?.level, 12);
  assert.deepEqual(normalizeLolMasteries([], assets), []);
  assert.throws(() =>
    normalizeLolMasteries([{ championId: 103, championLevel: 12, championPoints: -1 }], assets),
  );
  assert.throws(() => normalizeLolMasteries([{ championId: 103, championLevel: 12 }], assets));
});
