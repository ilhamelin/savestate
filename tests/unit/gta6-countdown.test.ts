import test from 'node:test';
import assert from 'node:assert/strict';
import {
  METRO_2039_RELEASE_DATE,
  getMetro2039Countdown,
  shouldAnnounceMetro2039Countdown,
  RELEASE_COUNTDOWNS,
  pinnedReleaseCountdown,
  GTA6_RELEASE_DATE,
  GTA6_ANNOUNCEMENT_INTERVAL,
  getGta6Countdown,
  shouldAnnounceGta6Countdown,
} from '../../src/domain/gta6-countdown.ts';
import {
  discordGta6CountdownMessage,
  discordMetro2039CountdownMessage,
} from '../../src/domain/discord-bot-cards.ts';
const release = Date.parse(GTA6_RELEASE_DATE);
test('GTA VI countdown splits time exactly and clamps after release', () => {
  assert.deepEqual(getGta6Countdown(release - (2 * 86400 + 3 * 3600 + 4 * 60 + 5) * 1000), {
    released: false,
    totalMs: 183845000,
    days: 2,
    hours: 3,
    minutes: 4,
    seconds: 5,
  });
  for (const now of [release, release + 1000])
    assert.deepEqual(getGta6Countdown(now), {
      released: true,
      totalMs: 0,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
    });
  assert.equal(getGta6Countdown(release - 1).released, false);
});
test('GTA VI announcements respect five full days, buckets and release cutoff', () => {
  const now = release - 30 * 86400000;
  const entry = (ago: number, bucket = 99) => ({
    timestamp: new Date(now - ago).toISOString(),
    embeds: [
      { footer: { text: `savestate-gta6-countdown:${bucket} · Aviso automático cada 5 días` } },
    ],
  });
  assert.equal(shouldAnnounceGta6Countdown([], now).shouldAnnounce, true);
  assert.equal(
    shouldAnnounceGta6Countdown([entry(GTA6_ANNOUNCEMENT_INTERVAL - 1)], now).shouldAnnounce,
    false,
  );
  assert.equal(
    shouldAnnounceGta6Countdown([entry(GTA6_ANNOUNCEMENT_INTERVAL)], now).shouldAnnounce,
    true,
  );
  assert.equal(
    shouldAnnounceGta6Countdown([entry(GTA6_ANNOUNCEMENT_INTERVAL, 6)], now).shouldAnnounce,
    false,
  );
  assert.equal(shouldAnnounceGta6Countdown([entry(-1000)], now).shouldAnnounce, false);
  assert.equal(
    shouldAnnounceGta6Countdown([null, {}, { embeds: [null] }], now).shouldAnnounce,
    true,
  );
  assert.equal(shouldAnnounceGta6Countdown([], release).shouldAnnounce, false);
  assert.equal(shouldAnnounceGta6Countdown([], now).nonce, 'gta6:6');
});
test('GTA VI Discord card includes assets, safe link and deduplication marker', () => {
  const message = discordGta6CountdownMessage(
    release - 30 * 86400000,
    'https://savestate-eight.vercel.app/',
  );
  assert.match(message.embeds[0]!.title, /30 días/);
  assert.equal(message.embeds[0]!.color, 0xff4fd8);
  assert.equal(message.embeds[0]!.image.url, 'https://savestate-eight.vercel.app/gta6/hero.png');
  assert.equal(
    message.embeds[0]!.thumbnail.url,
    'https://savestate-eight.vercel.app/gta6/icon-512.png',
  );
  assert.match(message.embeds[0]!.footer.text, /^savestate-gta6-countdown:6/);
  assert.equal(message.components[0]!.components[0]!.style, 5);
  assert.deepEqual(message.allowed_mentions.parse, []);
});

test('Metro countdown uses February 4 UTC, splits time and stops after release', () => {
  const metroRelease = Date.parse(METRO_2039_RELEASE_DATE);
  assert.equal(METRO_2039_RELEASE_DATE, '2027-02-04T00:00:00.000Z');
  assert.deepEqual(getMetro2039Countdown(metroRelease - 183845000), {
    released: false,
    totalMs: 183845000,
    days: 2,
    hours: 3,
    minutes: 4,
    seconds: 5,
  });
  for (const now of [metroRelease, metroRelease + 1]) {
    assert.equal(getMetro2039Countdown(now).totalMs, 0);
    assert.equal(shouldAnnounceMetro2039Countdown([], now).shouldAnnounce, false);
  }
  assert.equal(RELEASE_COUNTDOWNS.length, 5);
  assert.equal(RELEASE_COUNTDOWNS[4]?.id, 'metro-2039');
  assert.equal(RELEASE_COUNTDOWNS[4]?.releaseDate, METRO_2039_RELEASE_DATE);
});
test('Metro announcements have their own marker, five-day cooldown and safe embed assets', () => {
  const now = Date.parse(METRO_2039_RELEASE_DATE) - 30 * 86400000;
  const entry = (id: string, ago: number, bucket = 99) => ({
    timestamp: new Date(now - ago).toISOString(),
    embeds: [
      { footer: { text: `savestate-${id}-countdown:${bucket} · Aviso automático cada 5 días` } },
    ],
  });
  for (const id of ['gta6', 'zelda-oot', 'tga-2026', 'avengers-doomsday'])
    assert.equal(shouldAnnounceMetro2039Countdown([entry(id, 0)], now).shouldAnnounce, true);
  assert.equal(
    shouldAnnounceMetro2039Countdown([entry('metro-2039', GTA6_ANNOUNCEMENT_INTERVAL - 1)], now)
      .shouldAnnounce,
    false,
  );
  assert.equal(
    shouldAnnounceMetro2039Countdown([entry('metro-2039', GTA6_ANNOUNCEMENT_INTERVAL)], now)
      .shouldAnnounce,
    true,
  );
  assert.equal(
    shouldAnnounceMetro2039Countdown([entry('metro-2039', GTA6_ANNOUNCEMENT_INTERVAL, 6)], now)
      .shouldAnnounce,
    false,
  );
  assert.equal(shouldAnnounceMetro2039Countdown([], now).nonce, 'metro-2039:6');
  const card = discordMetro2039CountdownMessage(now, 'https://savestate.example/path');
  assert.match(card.embeds[0]!.title, /METRO 2039.*30 días/);
  assert.equal(card.embeds[0]!.color, 0xff8c00);
  assert.equal(card.embeds[0]!.thumbnail.url, 'https://savestate.example/metro/icon-512.png');
  assert.equal(card.embeds[0]!.image.url, 'https://savestate.example/metro/hero.jpg');
  assert.match(card.embeds[0]!.footer.text, /^savestate-metro-2039-countdown:6/);
  assert.equal(card.components[0]!.components[0]!.url, 'https://savestate.example');
  assert.deepEqual(card.allowed_mentions.parse, []);
});
test('Pinned countdown preferences accept exactly the five known IDs and reject stale storage', () => {
  for (const item of RELEASE_COUNTDOWNS) assert.equal(pinnedReleaseCountdown(item.id), item.id);
  for (const invalid of [null, undefined, '', 'unknown', 'METRO-2039', {}, ['gta6']])
    assert.equal(pinnedReleaseCountdown(invalid), null);
});
