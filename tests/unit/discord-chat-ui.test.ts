import test from 'node:test';
import assert from 'node:assert/strict';
import { discordSharedGame, discordNearBottom, sameDiscordMessages } from '../../src/domain/discord-client.ts';

test('shared game cards accept local catalogue links and preserve the title', () => {
 assert.deepEqual(discordSharedGame('🎮 God of War (https://savestate-eight.vercel.app/games/god-of-war--1)', 'https://savestate-eight.vercel.app'), { title: 'God of War', href: '/games/god-of-war--1' });
 assert.deepEqual(discordSharedGame('🎮 Portal (http://localhost:3000/games/portal)', 'http://localhost:3000'), {title: 'Portal', href: '/games/portal'});
});
test('shared game cards cannot promote foreign hosts, credentials or unrelated routes', () => {
 for (const url of ['https://evil.example/games/portal', 'https://savestate-eight.vercel.app.evil.example/games/portal', 'https://user@savestate-eight.vercel.app/games/portal', 'https://savestate-eight.vercel.app/settings', 'https://savestate-eight.vercel.app/games/portal?redirect=evil', 'https://savestate-eight.vercel.app/games/portal#bad']) {
  assert.equal(discordSharedGame('🎮 Portal (' + url + ')', 'https://savestate-eight.vercel.app'), null);
 }
 assert.equal(discordSharedGame('plain text', 'https://savestate-eight.vercel.app'), null);
 assert.equal(discordSharedGame('🎮 Portal (https://example.com/games/portal)', 'invalid'), null);
});
test('history anchoring retains the near-bottom threshold and stable empty batches', () => {
 assert.equal(discordNearBottom(420, 500, 1000), true);
 assert.equal(discordNearBottom(419, 500, 1000), false);
 assert.equal(sameDiscordMessages([], []), true);
});
