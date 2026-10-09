import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanSteamSearchTitle,
  searchSteamCandidates,
  isSteamReady,
} from '../../src/domain/steam-matching.ts';

test('Steam search removes trademark/edition noise and falls back sequentially without broad queries', async () => {
  assert.equal(cleanSteamSearchTitle('  Stellar Blade™ [Edition] (Demo) '), 'Stellar Blade');
  assert.equal(
    cleanSteamSearchTitle('The Witcher® 3: Wild Hunt - Game of the Year Edition'),
    'The Witcher 3: Wild Hunt - Game of the Year Edition',
  );
  const calls: unknown[] = [];
  const result = await searchSteamCandidates(
    'The Witcher® 3: Wild Hunt [GOTY]',
    async (query, platform) => {
      calls.push([query, platform]);
      return query === 'The Witcher 3' ? ['candidate'] : [];
    },
  );
  assert.deepEqual(result, ['candidate']);
  assert.deepEqual(calls, [
    ['The Witcher 3: Wild Hunt', 'PC (Microsoft Windows)'],
    ['The Witcher 3: Wild Hunt', undefined],
    ['The Witcher 3', undefined],
  ]);
  let count = 0;
  assert.deepEqual(
    await searchSteamCandidates('Stellar Blade™', async () => {
      count++;
      return count === 2 ? ['universal'] : [];
    }),
    ['universal'],
  );
  assert.equal(count, 2);
  count = 0;
  assert.deepEqual(
    await searchSteamCandidates('GTA V', async () => {
      count++;
      return ['manual'];
    }),
    ['manual'],
  );
  assert.equal(count, 1);
  await assert.rejects(
    searchSteamCandidates('™ [Edition]', async () => {
      throw new Error('Must not search empty terms');
    }),
  );
  await assert.rejects(
    searchSteamCandidates('Halo', async () => {
      throw new Error('Network');
    }),
    /Network/,
  );
});

test('Steam match filters distinguish chosen, finished and unresolved titles', () => {
  const choices = { 10: 'game-id', 20: '' };
  const finished = new Set([30]);
  assert.equal(isSteamReady(10, choices, finished), true);
  assert.equal(isSteamReady(20, choices, finished), false);
  assert.equal(isSteamReady(30, choices, finished), true);
  assert.equal(isSteamReady(40, choices, finished), false);
});
