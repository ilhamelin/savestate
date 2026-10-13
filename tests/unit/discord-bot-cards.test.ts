import test from 'node:test';
import assert from 'node:assert/strict';
import {
  discordFreebieMessage,
  unseenDiscordFreebies,
  freebiesCommandResponse,
  valorantCommandResponse,
  lolCommandResponse,
  genshinCommandResponse,
} from '../../src/domain/discord-bot-cards.ts';
import type { FreebieItem } from '../../src/domain/freebies.ts';
import type { ValorantProfile } from '../../src/domain/competitive-tracker.ts';
import { normalizedGenshin } from '../../src/domain/competitive-tracker.ts';
import { discordCoverUrl } from '../../src/domain/discord-client.ts';
const freebies: FreebieItem[] = Array.from({ length: 5 }, (_, index) => ({
  id: index + 1,
  title: `Game ${index + 1}`,
  worth: '$19.99',
  thumbnail: 'https://www.gamerpower.com/offers/game.jpg',
  openGiveawayUrl: `https://www.gamerpower.com/open/game-${index + 1}`,
  platforms: 'PC, Steam',
  endDate: null,
}));
test('Discord freebies cards validate links and deduplicate provider IDs, titles and claim URLs', () => {
  const message = discordFreebieMessage(freebies[0]!, 'https://example.com');
  assert.equal(message.embeds![0]!.color, 0x39ff14);
  assert.equal(message.embeds![0]!.thumbnail?.url, freebies[0]!.thumbnail);
  assert.equal(message.components![0]!.components.length, 2);
  assert.deepEqual(message.allowed_mentions, { parse: [] });
  assert.match(message.embeds![0]!.description, /PC, Steam/);
  assert.match(message.embeds![0]!.description, /\$19.99/);
  assert.equal(freebiesCommandResponse(freebies, 'https://example.com').data.embeds?.length, 3);
  assert.equal(freebiesCommandResponse([], 'https://example.com').data.flags, 64);
  assert.throws(() =>
    discordFreebieMessage(
      { ...freebies[0]!, openGiveawayUrl: 'https://evil.test/open/game' },
      'https://example.com',
    ),
  );
  const history = [
    { embeds: [{ footer: { text: 'SaveState Freebie #1' } }] },
    { embeds: [{ title: '🎁 ¡JUEGO 100% GRATIS! // game 2' }] },
    { components: [{ components: [{ url: freebies[2]!.openGiveawayUrl }] }] },
    { content: `Reclama ${freebies[3]!.openGiveawayUrl}` },
  ];
  assert.deepEqual(
    unseenDiscordFreebies([...freebies, freebies[4]!], history).map((item) => item.id),
    [5],
  );
  assert.equal(
    discordCoverUrl('https://www.gamerpower.com/offers/game.jpg'),
    freebies[0]!.thumbnail,
  );
  for (const url of [
    'https://www.gamerpower.com.evil.test/offers/a.jpg',
    'http://www.gamerpower.com/offers/a.jpg',
    'https://user@www.gamerpower.com/offers/a.jpg',
    'https://www.gamerpower.com:123/offers/a.jpg',
    'https://www.gamerpower.com/private',
  ])
    assert.equal(discordCoverUrl(url), null);
});
test('Competitive Discord cards show game-specific stats and preserve unavailable results', () => {
  const valorant: ValorantProfile = {
    game: 'valorant',
    gameName: 'Player',
    tagLine: 'LAS',
    puuid: 'id',
    region: 'latam',
    activeShard: null,
    verifiedAt: 'now',
    accountLevel: null,
    cardSmallUrl: null,
    cardWideUrl: null,
    currentRank: null,
    rankIconUrl: null,
    rankingInTier: null,
    lastMmrChange: null,
    elo: null,
    peakRank: null,
    activeActName: null,
    regionalLeaderboard: [],
    riotCrossProfile: null,
    dataSource: 'riot_official',
    matches: [],
  };
  let card = valorantCommandResponse(valorant, 'https://example.com');
  assert.match(card.data.embeds![0]!.description, /No disponible/);
  assert.ok(!card.data.embeds![0]!.description.includes('0%'));
  const match = {
    matchId: 'id',
    map: 'Ascent',
    mode: 'Competitive',
    startedAt: 'now',
    agentName: 'Jett',
    agentIconUrl: null,
    kills: 10,
    deaths: 5,
    assists: 2,
    score: 100,
    headshotPercent: 20,
    won: true,
    roundsWon: 13,
    roundsLost: 8,
  };
  card = valorantCommandResponse(
    {
      ...valorant,
      accountLevel: 20,
      currentRank: 'Gold 2',
      rankingInTier: 0,
      matches: [match, { ...match, won: false }, { ...match, won: null }],
    },
    'https://example.com',
  );
  assert.match(card.data.embeds![0]!.description, /0 RR/);
  assert.match(card.data.embeds![0]!.description, /50% WR \(2 partidas/);
  const rankIconUrl = 'https://media.valorant-api.com/rank.png';
  const cardSmallUrl = 'https://cdn.henrikdev.xyz/card.png';
  const cardWideUrl = 'https://media.valorant-api.com/wide.png';
  for (const [images, expected] of [
    [{ rankIconUrl, cardSmallUrl, cardWideUrl }, rankIconUrl],
    [{ cardSmallUrl, cardWideUrl }, cardWideUrl],
    [{ cardWideUrl }, cardWideUrl],
  ] as const) {
    assert.equal(
      valorantCommandResponse({ ...valorant, ...images }, 'https://example.com').data.embeds![0]!
        .thumbnail?.url,
      expected,
    );
  }
  assert.equal(
    valorantCommandResponse(
      { ...valorant, rankIconUrl: 'https://evil.test/rank.png' },
      'https://example.com',
    ).data.embeds![0]!.thumbnail,
    undefined,
  );
  card = valorantCommandResponse(
    {
      ...valorant,
      valorantStatus: 'no_recent_matches',
      riotCrossProfile: {
        summonerLevel: 100,
        profileIconUrl: null,
        tftTier: 'GOLD II',
        tftWins: 10,
        tftLosses: 3,
      },
    },
    'https://example.com',
  );
  assert.match(
    card.data.embeds![0]!.description,
    /Cuenta Riot activa en LoL: Nivel 100 · TFT GOLD II/,
  );
  assert.match(card.data.embeds![0]!.description, /juega 1 partida en Valorant/);
  assert.ok(
    !valorantCommandResponse(
      { ...valorant, valorantStatus: 'unavailable' },
      'https://example.com',
    ).data.embeds![0]!.description.includes('no registra partidas'),
  );
  card = lolCommandResponse(
    {
      gameName: 'Player',
      tagLine: 'LAS',
      summonerLevel: 100,
      profileIconUrl: '',
      platform: 'la2',
      soloQueue: {
        tier: 'GOLD',
        rank: 'II',
        leaguePoints: 42,
        wins: 20,
        losses: 10,
        winrate: 66.7,
      },
      flexQueue: null,
      rankStatus: 'available',
      masteries: [],
      masteryStatus: 'unavailable',
      matches: [],
      warnings: [],
      lastUpdated: 'now',
      nextStart: 0,
      hasMore: false,
    },
    'https://example.com',
  );
  assert.match(card.data.embeds![0]!.description, /42 LP/);
  assert.match(card.data.embeds![0]!.description, /20 Victorias \/ 10 Derrotas/);
  const profile = normalizedGenshin(
    {
      playerInfo: {
        nickname: 'Traveler',
        level: 60,
        worldLevel: 8,
        towerFloorIndex: 12,
        towerLevelIndex: 3,
        showAvatarInfoList: [{ avatarId: 10000002, level: 90 }],
      },
    },
    '618285856',
  );
  card = genshinCommandResponse(profile, 'https://example.com');
  assert.match(card.data.embeds![0]!.title, /Traveler/);
  assert.match(card.data.embeds![0]!.description, /Adventure Rank: 60/);
  assert.match(card.data.embeds![0]!.description, /12-3/);
  assert.match(card.data.embeds![0]!.description, /Nivel 90/);
  assert.equal(card.data.flags, undefined);
});
