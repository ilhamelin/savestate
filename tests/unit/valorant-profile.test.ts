import test from 'node:test';
import assert from 'node:assert/strict';
import {
  henrikMatches,
  normalizedHenrik,
  normalizedLeaderboard,
  valorantImage,
} from '../../src/domain/valorant-profile.ts';
test('Valorant maps signed RR changes, cards, peak season and unavailable fields', () => {
  const profile = normalizedHenrik(
    {
      data: {
        account_level: 90,
        card: {
          small: 'https://media.valorant-api.com/card.png',
          wide: 'https://evil.example/banner.png',
        },
      },
    },
    {
      data: {
        current_data: {
          currenttierpatched: 'Platinum 2',
          ranking_in_tier: 45,
          mmr_change_to_last_game: -14,
          elo: 1234,
          images: { large: 'https://media.valorant-api.com/rank.png' },
        },
        highest_rank: { patched_tier: 'Diamond 1', season: 'e9a2' },
      },
    },
    null,
    { puuid: 'target', gameName: 'Player', tagLine: 'TAG' },
  );
  assert.equal(profile.accountLevel, 90);
  assert.equal(profile.lastMmrChange, -14);
  assert.equal(profile.peakRank, 'Diamond 1 (e9a2)');
  assert.equal(profile.cardWideUrl, null);
  assert.equal(profile.matches.length, 0);
  assert.equal(
    normalizedHenrik(null, null, null, { puuid: 'target', gameName: 'Player', tagLine: 'TAG' })
      .currentRank,
    null,
  );
  for (const url of [
    'https://evil.example/x',
    'http://media.valorant-api.com/x',
    'https://user:secret@media.valorant-api.com/x',
    'https://media.valorant-api.com:444/x',
  ])
    assert.equal(valorantImage(url), null);
});
test('Valorant matches select exact PUUID or name and tag, preserving unknown results', () => {
  const player = {
    puuid: 'target',
    name: 'Player',
    tag: 'TAG',
    team: 'Red',
    character: 'Jett',
    stats: {
      kills: 20,
      deaths: 10,
      assists: 5,
      headshots: 4,
      bodyshots: 5,
      legshots: 1,
      score: 6000,
    },
    assets: { agent: { small: 'https://media.valorant-api.com/jett.png' } },
  };
  const match = {
    metadata: { matchid: 'match', map: 'Ascent', mode: 'Competitive', game_start: 1700000000 },
    players: { all_players: [{ ...player, puuid: 'other' }, player] },
    teams: { red: { has_won: true, rounds_won: 13, rounds_lost: 7 } },
  };
  const result = henrikMatches({ data: [match] }, 'target', 'Player', 'TAG')[0]!;
  assert.equal(result.headshotPercent, 40);
  assert.equal(result.won, true);
  assert.equal(result.roundsWon, 13);
  assert.equal(result.startedAt, '2023-11-14T22:13:20.000Z');
  const renamedId = {
    ...match,
    players: {
      all_players: [{ ...player, puuid: 'different-provider-id', name: 'pLaYeR', tag: 'tag' }],
    },
  };
  assert.equal(
    henrikMatches({ data: [renamedId] }, 'target', 'Player', 'TAG')[0]?.agentName,
    'Jett',
  );
  assert.equal(
    henrikMatches(
      {
        data: [
          { ...renamedId, players: { all_players: [{ ...player, puuid: 'other', tag: 'OTHER' }] } },
        ],
      },
      'target',
      'Player',
      'TAG',
    ).length,
    0,
  );
  assert.equal(
    henrikMatches(
      {
        data: [
          { ...match, players: { all_players: [{ ...player, puuid: undefined, tag: 'OTHER' }] } },
        ],
      },
      'target',
      'Player',
      'TAG',
    ).length,
    0,
  );
  assert.equal(
    henrikMatches({ data: [{ ...match, teams: {} }] }, 'target', 'Player', 'TAG')[0]?.won,
    null,
  );
});
test('Regional leaderboard validates entries, sorts rank and limits the public top five', () => {
  const players = Array.from({ length: 8 }, (_, index) => ({
    leaderboardRank: 8 - index,
    gameName: 'Player',
    tagLine: String(index),
    rankedRating: 500,
    numberOfWins: 40,
  }));
  const board = normalizedLeaderboard({
    players: [...players, { leaderboardRank: 1, gameName: '', tagLine: 'hidden' }],
  });
  assert.equal(board.length, 5);
  assert.deepEqual(
    board.map((player) => player.rank),
    [1, 2, 3, 4, 5],
  );
  assert.deepEqual(normalizedLeaderboard(null), []);
});
