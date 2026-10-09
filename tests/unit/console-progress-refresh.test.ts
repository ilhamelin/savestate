import test from 'node:test';
import assert from 'node:assert/strict';
import { consoleProgressUpdates } from '../../src/domain/console-progress-refresh.ts';
import type { ConsoleRow } from '../../src/domain/console-import.ts';
const rows: ConsoleRow[] = [
  {
    title: 'Halo',
    platform: 'Xbox One',
    hours: 0,
    status: 'playing',
    progress: { kind: 'gamerscore', current: 850, total: 1000 },
  },
];
test('progress refresh identifies legacy imports and remembered source titles, preserving manual sessions', () => {
  const changes = consoleProgressUpdates(
    [
      {
        id: 'old',
        title: ' HALO ',
        platform: 'Xbox One',
        note: '[Xbox] Partida importada a la biblioteca.',
      },
      { id: 'manual', title: 'Halo', platform: 'Xbox One', note: 'Partida manual' },
      {
        id: 'linked',
        title: 'Localized catalogue title',
        platform: 'Xbox One',
        note: 'My custom note',
        progress: { kind: 'gamerscore', current: 1, total: 1000, source_title: 'Halo' },
      },
      {
        id: 'psn',
        title: 'Halo',
        platform: 'PlayStation 5',
        note: '[PlayStation] Partida importada a la biblioteca.',
      },
    ],
    rows,
    'Xbox',
  );
  assert.deepEqual(
    changes.map((item) => item.id),
    ['old', 'linked'],
  );
  assert.deepEqual(changes[0]!.progress, {
    kind: 'gamerscore',
    current: 850,
    total: 1000,
    source_title: 'Halo',
  });
});
test('progress refresh avoids fuzzy/ambiguous editions and never invents missing totals', () => {
  const log = {
    id: 'one',
    title: 'Halo',
    platform: 'Xbox 360',
    note: '[Xbox] Partida importada a la biblioteca.',
  };
  const variants = [...rows, { ...rows[0]!, platform: 'Xbox Series X|S' }];
  assert.deepEqual(consoleProgressUpdates([log], variants, 'Xbox'), []);
  assert.equal(
    consoleProgressUpdates([{ ...log, platform: 'Xbox One' }], variants, 'Xbox').length,
    1,
  );
  assert.deepEqual(consoleProgressUpdates([{ ...log, title: 'Halo 2' }], rows, 'Xbox'), []);
  assert.deepEqual(
    consoleProgressUpdates([log], [{ ...rows[0]!, progress: undefined }], 'Xbox'),
    [],
  );
});
