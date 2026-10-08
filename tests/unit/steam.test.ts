import test from 'node:test';
import assert from 'node:assert/strict';
import {
  steamProfile,
  steamGames,
  steamStatus,
  suggestedSteamStatus,
  matchingTitle,
} from '../../src/domain/steam.ts';
test('Steam: conserva ID 64 como texto y rechaza URLs que podrían causar SSRF', () => {
  const id = '76561198000000001';
  assert.deepEqual(steamProfile(id), { steamid: id });
  assert.deepEqual(steamProfile(`https://steamcommunity.com/profiles/${id}/`), { steamid: id });
  assert.deepEqual(steamProfile('https://steamcommunity.com/id/player_test'), {
    vanity: 'player_test',
  });
  for (const value of [
    'https://steamcommunity.com.evil.test/id/player',
    'https://evil.test',
    'http://steamcommunity.com/id/player',
    'https://user@steamcommunity.com/id/player',
    'https://steamcommunity.com:8443/id/player',
    'https://steamcommunity.com/id/player?redirect=evil',
    '123',
    'https://steamcommunity.com/games/test',
  ])
    assert.throws(() => steamProfile(value));
});
test('Steam: biblioteca privada, minutos inválidos, duplicados y estados sin completismo inferido', () => {
  assert.throws(() => steamGames({ response: {} }), /privacidad/);
  assert.deepEqual(steamGames({ response: { game_count: 0 } }), []);
  const game = { appid: 10, name: 'Counter-Strike', playtime_forever: 120 };
  assert.deepEqual(steamGames({ response: { games: [game] } }), [
    { appid: 10, name: 'Counter-Strike', minutes: 120 },
  ]);
  assert.throws(() => steamGames({ response: { games: [game, game] } }));
  for (const minutes of [-1, Infinity, 1.5, 6000001])
    assert.throws(() =>
      steamGames({ response: { games: [{ ...game, playtime_forever: minutes }] } }),
    );
  assert.equal(suggestedSteamStatus(0), 'backlog');
  assert.equal(suggestedSteamStatus(999999), 'playing');
  assert.equal(steamStatus('cleared'), 'cleared');
  assert.throws(() => steamStatus('completed'));
  assert.throws(() => steamStatus('platinum'));
  assert.equal(matchingTitle('Pokémon™: RPG'), matchingTitle('Pokemon RPG'));
  assert.notEqual(matchingTitle('Halo'), matchingTitle('Halo 2'));
  assert.notEqual(matchingTitle('Game Remastered'), matchingTitle('Game'));
});
