import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getCountdownTo,
  getZeldaOotCountdown,
  shouldAnnounceZeldaOotCountdown,
  shouldAnnounceGta6Countdown,
  ZELDA_OOT_RELEASE_DATE,
  GTA6_RELEASE_DATE,
  GTA6_ANNOUNCEMENT_INTERVAL,
  RELEASE_COUNTDOWNS,
} from './gta6-countdown.ts';
import { discordZeldaOotCountdownMessage } from './discord-bot-cards.ts';
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
    ['gta6', 'zelda-oot'],
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
