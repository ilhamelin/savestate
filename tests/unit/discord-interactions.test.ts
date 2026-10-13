import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import {
  verifyDiscordInteractionSignature,
  DISCORD_ROLE_METADATA,
  roleConnectionPayload,
} from '../../src/domain/discord.ts';
import {
  gameCommandResponse,
  profileCommandResponse,
  discordCommandMessage,
  DISCORD_SLASH_COMMANDS,
} from '../../src/domain/discord-commands.ts';
import {
  sealDiscordCookie,
  openDiscordCookie,
  discordOAuthStateMatches,
} from '../../src/domain/discord-oauth-cookie.ts';
test('Discord Ed25519 verifies exact raw body and fails closed for malformed signatures and keys', () => {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const key = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('hex');
  const raw = ' {"type":1,"text":"🎮 ñ"}\n',
    timestamp = '1700000000';
  const signature = sign(null, Buffer.from(timestamp + raw), privateKey).toString('hex');
  assert.equal(verifyDiscordInteractionSignature(raw, signature, timestamp, key), true);
  for (const time of ['synthetic-timestamp', 'x'.repeat(64)]) {
    const signed = sign(null, Buffer.from(time + raw), privateKey).toString('hex');
    assert.equal(verifyDiscordInteractionSignature(raw, signed, time, key), true);
    assert.equal(verifyDiscordInteractionSignature(raw + ' ', signed, time, key), false);
  }
  const oversized = 'x'.repeat(65);
  assert.equal(
    verifyDiscordInteractionSignature(
      raw,
      sign(null, Buffer.from(oversized + raw), privateKey).toString('hex'),
      oversized,
      key,
    ),
    false,
  );
  for (const [body, sig, time, pub] of [
    [raw.trim(), signature, timestamp, key],
    [raw, '0'.repeat(128), timestamp, key],
    [raw, signature, '1700000001', key],
    [raw, signature, timestamp, '0'.repeat(64)],
    [raw, 'not-hex', timestamp, key],
    [raw, signature, '', key],
    [raw, signature, timestamp, ''],
  ])
    assert.equal(verifyDiscordInteractionSignature(body!, sig!, time!, pub!), false);
});
test('Discord embeds keep private library counts hidden and link to existing profile and game slugs', () => {
  const profile = {
    username: 'player',
    level: 14,
    equipped_title: 'Insert Coin',
    library_private: true,
  };
  const response = profileCommandResponse('https://example.com', profile, 12345);
  assert.equal(response.type, 4);
  assert.ok(!response.data.embeds?.[0]?.description.includes('12345'));
  const privateWithDetails = profileCommandResponse('https://example.com', profile, 12345, {
    cleared: 4321,
    platinum: 999,
    favorites: ['Secret Favorite'],
  });
  assert.ok(!/4321|999|Secret Favorite/.test(privateWithDetails.data.embeds![0]!.description));
  const enriched = profileCommandResponse(
    'https://example.com',
    { ...profile, library_private: false, terminal_status: 'Playing Halo' },
    12,
    {
      cleared: 3,
      platinum: 2,
      favorites: ['Halo', 'Chrono Trigger'],
    },
  );
  assert.match(
    enriched.data.embeds![0]!.description,
    /📚 12 Juegos · 🏁 3 Terminados · 🏆 2 Platinos/,
  );
  assert.match(enriched.data.embeds![0]!.description, /Top 4: Halo · Chrono Trigger/);
  assert.match(enriched.data.embeds![0]!.description, /> _Playing Halo_/);
  for (const name of ['perfil', 'juego']) {
    const command = DISCORD_SLASH_COMMANDS.find((item) => item.name === name);
    assert.equal(command?.options?.[0]?.autocomplete, true);
  }
  assert.match(response.data.embeds![0]!.description, /privada/);
  assert.equal(
    response.data.components![0]!.components[0]!.url,
    'https://example.com/players/player',
  );
  const game = gameCommandResponse('https://example.com', {
    title: 'Game',
    slug: 'game-slug',
    cover_url: 'https://evil.example/image.png',
    release_year: 2026,
  });
  assert.equal(game.data.components![0]!.components[0]!.url, 'https://example.com/games/game-slug');
  assert.equal(game.data.embeds![0]!.thumbnail, undefined);
  assert.deepEqual(
    discordCommandMessage('web', 'description', 'https://example.com').data.allowed_mentions,
    { parse: [] },
  );
});
test('Linked Roles metadata uses Discord integer comparisons and rejects client-shaped invalid counters', () => {
  assert.deepEqual(
    DISCORD_ROLE_METADATA.map((item) => [item.key, item.type]),
    [
      ['level', 2],
      ['completed_games', 2],
      ['platinum_games', 2],
    ],
  );
  assert.deepEqual(
    roleConnectionPayload('player', { level: 14, completed_games: 10, platinum_games: 3 }),
    {
      platform_name: 'SaveState',
      platform_username: '@player',
      metadata: { level: '14', completed_games: '10', platinum_games: '3' },
    },
  );
  assert.throws(() =>
    roleConnectionPayload('player', { level: 1, completed_games: -1, platinum_games: 0 }),
  );
  assert.throws(() =>
    roleConnectionPayload('../bad', { level: 1, completed_games: 0, platinum_games: 0 }),
  );
});
test('Discord OAuth cookies are encrypted, authenticated, expiring and bound to the SaveState user', () => {
  const secret = 'test-only-secret-for-oauth',
    value = {
      userId: 'owner',
      expiresAt: 5000,
      state: 'a'.repeat(64),
      accessToken: 'never-plaintext',
    };
  const encoded = sealDiscordCookie(value, secret);
  assert.ok(!encoded.includes('never-plaintext'));
  assert.deepEqual(openDiscordCookie(encoded, secret, 'owner', 1000), value);
  assert.equal(openDiscordCookie(encoded, secret, 'other', 1000), null);
  assert.equal(openDiscordCookie(encoded, secret, 'owner', 5000), null);
  assert.equal(openDiscordCookie(encoded, 'wrong-key', 'owner', 1000), null);
  assert.equal(openDiscordCookie(encoded.slice(0, -5) + 'abcde', secret, 'owner', 1000), null);
  assert.equal(discordOAuthStateMatches(value.state, value.state), true);
  assert.equal(discordOAuthStateMatches(value.state, 'b'.repeat(64)), false);
  assert.equal(discordOAuthStateMatches('', ''), false);
});
