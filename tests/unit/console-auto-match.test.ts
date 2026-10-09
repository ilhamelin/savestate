import test from 'node:test';
import assert from 'node:assert/strict';
import { matchConsoleRows } from '../../src/lib/console-auto-match.ts';

test('auto-match prefers exact titles, falls back, reports missing games and continues after failures', async () => {
  const results: string[] = [],
    progress: number[] = [];
  const summary = await matchConsoleRows(
    ['Halo', 'Fallback', 'Missing', 'Failure', 'Last'].map((title, index) => ({ title, index })),
    {
      signal: new AbortController().signal,
      search: async (title) => {
        if (title === 'Failure') throw new Error('Provider failed');
        if (title === 'Missing') return [];
        return [
          { id: 'first', title: 'Other' },
          { id: 'exact', title: ' HALO ' },
        ];
      },
      result: (index, games, chosen, error) =>
        results.push(`${index}:${chosen?.id ?? error ?? 'missing'}:${games.length}`),
      progress: (value) => progress.push(value),
    },
  );
  assert.deepEqual(results, [
    '0:exact:2',
    '1:first:2',
    '2:missing:0',
    '3:Provider failed:0',
    '4:first:2',
  ]);
  assert.deepEqual(progress, [1, 2, 3, 4, 5]);
  assert.deepEqual(summary, { processed: 5, matched: 3, failures: 1, stopped: false });
});

test('auto-match cancellation stops requests and retains already matched rows for resuming', async () => {
  const controller = new AbortController();
  const calls: string[] = [],
    saved: number[] = [];
  const summary = await matchConsoleRows(
    ['First', 'Second', 'Third'].map((title, index) => ({ title, index })),
    {
      signal: controller.signal,
      search: async (title) => {
        calls.push(title);
        if (title === 'Second') controller.abort();
        return [{ id: title, title }];
      },
      result: (index) => saved.push(index),
      progress: () => {},
    },
  );
  assert.deepEqual(calls, ['First', 'Second']);
  assert.deepEqual(saved, [0]);
  assert.deepEqual(summary, { processed: 1, matched: 1, failures: 0, stopped: true });
});
