import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getCountdownTo,
  getTga2026Countdown,
  shouldAnnounceTga2026Countdown,
  TGA_2026_EVENT_DATE,
  getZeldaOotCountdown,
  shouldAnnounceZeldaOotCountdown,
  shouldAnnounceGta6Countdown,
  ZELDA_OOT_RELEASE_DATE,
  GTA6_RELEASE_DATE,
  GTA6_ANNOUNCEMENT_INTERVAL,
  RELEASE_COUNTDOWNS,
} from './gta6-countdown.ts';
import {
  discordZeldaOotCountdownMessage,
  discordTga2026CountdownMessage,
} from './discord-bot-cards.ts';
const release = Date.parse(ZELDA_OOT_RELEASE_DATE);
test('Zelda countdown uses November 5 at midnight EST, exact time parts and release cutoff', () => {
  assert.equal(new Date(release).toISOString(), '2026-11-05T05:00:00.000Z');
  const now = release - (2 * 86400 + 3 * 3600 + 4 * 60 + 5) * 1000;
  assert.deepEqual(getZeldaOotCountdown(now), {
    released: false,
    totalMs: 183845000,
    days: 2,
    hours: 3,
    minutes: 4,
    seconds: 5,
  });
  assert.deepEqual(getZeldaOotCountdown(now), getCountdownTo(ZELDA_OOT_RELEASE_DATE, now));
  assert.equal(getZeldaOotCountdown(release).released, true);
  assert.equal(getZeldaOotCountdown(release + 1).totalMs, 0);
  assert.throws(() => getCountdownTo('invalid', now), RangeError);
});
test('Zelda and GTA five-day decisions are independent and block duplicate windows', () => {
  const now = Date.parse('2026-10-20T05:00:00.000Z');
  const entry = (id: string, ago: number, bucket: number) => ({
    timestamp: new Date(now - ago).toISOString(),
    embeds: [
      { footer: { text: `savestate-${id}-countdown:${bucket} · Aviso automático cada 5 días` } },
    ],
  });
  const zelda = shouldAnnounceZeldaOotCountdown([], now),
    gta = shouldAnnounceGta6Countdown([], now);
  assert.equal(zelda.shouldAnnounce, true);
  assert.equal(zelda.nonce, `zelda-oot:${zelda.bucket}`);
  assert.equal(
    shouldAnnounceZeldaOotCountdown([entry('gta6', 0, gta.bucket)], now).shouldAnnounce,
    true,
  );
  assert.equal(
    shouldAnnounceGta6Countdown([entry('zelda-oot', 0, zelda.bucket)], now).shouldAnnounce,
    true,
  );
  assert.equal(
    shouldAnnounceZeldaOotCountdown([entry('zelda-oot', GTA6_ANNOUNCEMENT_INTERVAL - 1, 99)], now)
      .shouldAnnounce,
    false,
  );
  assert.equal(
    shouldAnnounceZeldaOotCountdown([entry('zelda-oot', GTA6_ANNOUNCEMENT_INTERVAL, 99)], now)
      .shouldAnnounce,
    true,
  );
  assert.equal(
    shouldAnnounceZeldaOotCountdown(
      [entry('zelda-oot', GTA6_ANNOUNCEMENT_INTERVAL, zelda.bucket)],
      now,
    ).shouldAnnounce,
    false,
  );
  assert.equal(shouldAnnounceZeldaOotCountdown([], release).shouldAnnounce, false);
});
test('Countdown catalog and Zelda Discord card keep assets, platform, reference time and safe links', () => {
  assert.deepEqual(
    RELEASE_COUNTDOWNS.map((c) => c.id),
    ['gta6', 'zelda-oot', 'tga-2026'],
  );
  assert.equal(RELEASE_COUNTDOWNS[0]?.releaseDate, GTA6_RELEASE_DATE);
  assert.equal(RELEASE_COUNTDOWNS[1]?.releaseDate, ZELDA_OOT_RELEASE_DATE);
  assert.equal(RELEASE_COUNTDOWNS[1]?.platforms[0]?.icon, '/platforms/nintendo.png');
  const message = discordZeldaOotCountdownMessage(
    release - 86400000,
    'https://savestate-eight.vercel.app/',
  );
  assert.match(message.embeds[0]!.title, /Faltan 1 días/);
  assert.match(message.embeds[0]!.description, /Nintendo Switch 2/);
  assert.equal(message.embeds[0]!.color, 0xd4af37);
  assert.equal(message.embeds[0]!.image.url, 'https://savestate-eight.vercel.app/zelda/hero.jpg');
  assert.match(message.embeds[0]!.footer.text, /^savestate-zelda-oot-countdown:0/);
  assert.deepEqual(message.allowed_mentions.parse, []);
});

test('The Game Awards countdown uses the published gala time and clamps after it', () => {
  const event = Date.parse(TGA_2026_EVENT_DATE);
  assert.equal(TGA_2026_EVENT_DATE, '2026-12-11T00:30:00.000Z');
  const now = event - (2 * 86400 + 3 * 3600 + 4 * 60 + 5) * 1000;
  assert.deepEqual(getTga2026Countdown(now), {
    released: false,
    totalMs: 183845000,
    days: 2,
    hours: 3,
    minutes: 4,
    seconds: 5,
  });
  assert.equal(getTga2026Countdown(event).released, true);
  assert.equal(getTga2026Countdown(event + 1000).totalMs, 0);
  assert.equal(RELEASE_COUNTDOWNS[2]?.releaseDate, TGA_2026_EVENT_DATE);
  assert.equal(RELEASE_COUNTDOWNS[2]?.themeClass, 'countdown-theme-tga');
});
test('TGA five-day announcements remain independent from both game announcements', () => {
  const now = Date.parse('2026-10-20T00:00:00Z'),
    decision = shouldAnnounceTga2026Countdown([], now);
  const entry = (id: string, ago: number, bucket: number) => ({
    timestamp: new Date(now - ago).toISOString(),
    embeds: [
      {
        footer: {
          text: 'savestate-' + id + '-countdown:' + bucket + ' · Aviso automático cada 5 días',
        },
      },
    ],
  });
  assert.equal(decision.nonce, 'tga-2026:' + decision.bucket);
  for (const [id, check] of [
    ['gta6', shouldAnnounceGta6Countdown],
    ['zelda-oot', shouldAnnounceZeldaOotCountdown],
  ] as const) {
    assert.equal(
      shouldAnnounceTga2026Countdown([entry(id, 0, check([], now).bucket)], now).shouldAnnounce,
      true,
    );
    assert.equal(check([entry('tga-2026', 0, decision.bucket)], now).shouldAnnounce, true);
  }
  assert.equal(
    shouldAnnounceTga2026Countdown([entry('tga-2026', GTA6_ANNOUNCEMENT_INTERVAL - 1, 99)], now)
      .shouldAnnounce,
    false,
  );
  assert.equal(
    shouldAnnounceTga2026Countdown([entry('tga-2026', GTA6_ANNOUNCEMENT_INTERVAL, 99)], now)
      .shouldAnnounce,
    true,
  );
  assert.equal(
    shouldAnnounceTga2026Countdown(
      [entry('tga-2026', GTA6_ANNOUNCEMENT_INTERVAL, decision.bucket)],
      now,
    ).shouldAnnounce,
    false,
  );
  assert.equal(
    shouldAnnounceTga2026Countdown([], Date.parse(TGA_2026_EVENT_DATE)).shouldAnnounce,
    false,
  );
});
test('TGA Discord card includes the gala artwork, reference time and independent marker', () => {
  const message = discordTga2026CountdownMessage(
    Date.parse(TGA_2026_EVENT_DATE) - 86400000,
    'https://savestate-eight.vercel.app/',
  );
  assert.match(message.embeds[0]!.title, /THE GAME AWARDS 2026/);
  assert.match(message.embeds[0]!.description, /Peacock Theater/);
  assert.match(message.embeds[0]!.description, /11\/12 · 00:30 UTC/);
  assert.equal(message.embeds[0]!.color, 0xff9900);
  assert.equal(message.embeds[0]!.image.url, 'https://savestate-eight.vercel.app/tga/hero.jpg');
  assert.equal(
    message.embeds[0]!.thumbnail.url,
    'https://savestate-eight.vercel.app/tga/icon-512.png',
  );
  assert.match(message.embeds[0]!.footer.text, /^savestate-tga-2026-countdown:0/);
  assert.deepEqual(message.allowed_mentions.parse, []);
});
