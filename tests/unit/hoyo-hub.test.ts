import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HOYO_GAMES,
  hoyoGame,
  buildHoyoRedeemUrl,
  buildHoyoFrameUrl,
  parseHoyoNews,
  hoyoCodeExpired,
  hoyoVersionInNews,
  calculateHoyoCountdown,
  HOYO_VERSION_SCHEDULES,
  HOYO_QUICK_TOOLS,
  hoyoCycleProgress,
  parseHoyoClaimedCodes,
  hoyoClaimedCodeKey,
  filterHoyoNews,
} from '../../src/domain/hoyo-hub.ts';

test('HoYo Hub config uses official channels and real reference codes without fictional special codes', () => {
  assert.equal(HOYO_GAMES.genshin.twitchChannel, 'genshinimpactofficial');
  assert.equal(HOYO_GAMES.hsr.twitchChannel, 'honkaistarrail');
  for (const config of Object.values(HOYO_GAMES)) {
    assert.match(config.youtubeChannelId, /^UC[\w-]{22}$/);
    assert.ok(config.featuredCodes.length >= 1);
    assert.ok(config.featuredCodes.every((code) => !code.code.includes('SPECIAL')));
    assert.equal(config.version.current, null);
  }
  assert.equal(hoyoGame('hsr'), 'hsr');
  assert.equal(hoyoGame('unknown'), 'genshin');
  assert.equal(
    buildHoyoRedeemUrl('genshin', 'GENSHINGIFT'),
    'https://genshin.hoyoverse.com/es/gift?code=GENSHINGIFT',
  );
  assert.equal(
    buildHoyoRedeemUrl('hsr', 'STARRAILGIFT'),
    'https://hsr.hoyoverse.com/gift?code=STARRAILGIFT',
  );
  assert.ok(buildHoyoRedeemUrl('hsr', ' A&B# ').endsWith('A%26B%23'));
});

test('HoYo countdown handles exact seconds, past dates, invalid values and UTC boundaries', () => {
  const now = Date.parse('2026-10-16T12:00:00Z');
  assert.deepEqual(calculateHoyoCountdown('2026-10-17T13:02:03Z', now), {
    days: 1,
    hours: 1,
    minutes: 2,
    seconds: 3,
    totalSeconds: 90123,
    isPast: false,
    formatted: '1d 01h 02m 03s',
  });
  for (const target of ['2026-10-16T12:00:00Z', '2026-10-15T12:00:00Z', 'invalid']) {
    const result = calculateHoyoCountdown(target, now);
    assert.equal(result.totalSeconds, 0);
    assert.equal(result.isPast, true);
  }
  assert.equal(calculateHoyoCountdown('2026-10-17T12:00:00Z', NaN).totalSeconds, 0);
  assert.equal(calculateHoyoCountdown('2026-10-16T12:00:01Z', now).seconds, 1);
});
test('HoYo reference schedules retain requested targets but compute live bounded cycle progress', () => {
  assert.equal(HOYO_VERSION_SCHEDULES.genshin.currentVersion, '7.1');
  assert.equal(HOYO_VERSION_SCHEDULES.genshin.nextVersion, '7.2');
  assert.equal(HOYO_VERSION_SCHEDULES.hsr.currentVersion, '4.6');
  assert.equal(HOYO_VERSION_SCHEDULES.hsr.nextVersion, '4.7');
  assert.equal(HOYO_VERSION_SCHEDULES.genshin.nextReleaseDate, '2026-11-04T03:00:00Z');
  assert.equal(HOYO_VERSION_SCHEDULES.hsr.nextReleaseDate, '2026-11-10T03:00:00Z');
  for (const schedule of Object.values(HOYO_VERSION_SCHEDULES)) {
    for (const date of [
      schedule.nextReleaseDate,
      schedule.phaseEndDate,
      schedule.specialProgramDate,
    ])
      assert.ok(Number.isFinite(Date.parse(date)));
    const end = Date.parse(schedule.nextReleaseDate),
      span = 42 * 86400000;
    assert.deepEqual(hoyoCycleProgress(schedule, end - span - 1000), {
      daysIntoCycle: 0,
      progressPercent: 0,
    });
    assert.deepEqual(hoyoCycleProgress(schedule, end - span / 2), {
      daysIntoCycle: 21,
      progressPercent: 50,
    });
    assert.deepEqual(hoyoCycleProgress(schedule, end + 1000), {
      daysIntoCycle: 42,
      progressPercent: 100,
    });
  }
});
test('HoYo daily tools link to official calendars/maps and the matching SaveState tracker', () => {
  for (const game of ['genshin', 'hsr'] as const) {
    const tools = HOYO_QUICK_TOOLS[game];
    assert.equal(tools.length, 3);
    for (const id of ['checkin', 'map'])
      assert.equal(
        new URL(tools.find((tool) => tool.id === id)!.url).origin,
        'https://act.hoyolab.com',
      );
    assert.equal(tools.find((tool) => tool.id === 'showcase')!.url, `/rift?game=${game}`);
    assert.ok(new URL(tools[0]!.url).searchParams.get('act_id'));
  }
});
test('HoYo claimed-code preferences survive serialization, reject malformed storage and separate games', () => {
  const key = hoyoClaimedCodeKey('genshin', 'GENSHINGIFT');
  assert.deepEqual([...parseHoyoClaimedCodes(JSON.stringify([key, key]))], [key]);
  assert.notEqual(hoyoClaimedCodeKey('genshin', 'SHARED'), hoyoClaimedCodeKey('hsr', 'SHARED'));
  assert.ok(parseHoyoClaimedCodes('["GENSHINGIFT"]').has(key));
  for (const raw of [null, 'invalid', '{}', '[null,123,"bad:<script>"]'])
    assert.equal(parseHoyoClaimedCodes(raw).size, 0);
});
test('HoYo news filters preserve all items or select one category immediately', () => {
  const news = parseHoyoNews({
    data: {
      list: [
        { post: { post_id: '1', subject: 'Nueva versión 7.1' } },
        { post: { post_id: '2', subject: 'Evento de temporada' } },
        { post: { post_id: '3', subject: 'Comunicado' } },
      ],
    },
  });
  assert.equal(filterHoyoNews(news, 'todas').length, 3);
  for (const category of ['actualizacion', 'evento', 'aviso'] as const)
    assert.equal(filterHoyoNews(news, category).length, 1);
  assert.equal(
    filterHoyoNews(
      news.filter((item) => item.category === 'evento'),
      'aviso',
    ).length,
    0,
  );
});
test('HoYo streams use the actual current Twitch parent and canonical YouTube channel IDs', () => {
  const frame = new URL(buildHoyoFrameUrl('genshin', 'twitch', 'savestate-eight.vercel.app')!);
  assert.equal(frame.searchParams.get('parent'), 'savestate-eight.vercel.app');
  assert.equal(frame.searchParams.get('autoplay'), 'false');
  assert.equal(buildHoyoFrameUrl('genshin', 'twitch', ''), null);
  assert.equal(buildHoyoFrameUrl('genshin', 'twitch', 'evil/path'), null);
  const youtube = new URL(buildHoyoFrameUrl('hsr', 'youtube', '')!);
  assert.equal(youtube.searchParams.get('channel'), HOYO_GAMES.hsr.youtubeChannelId);
  assert.equal(youtube.origin, 'https://www.youtube.com');
});
test('HoYo news safely handles errors, malformed entries, official images, dates and deduplication', () => {
  for (const input of [null, {}, [], { data: {} }, { retcode: 1, data: { list: [] } }])
    assert.deepEqual(parseHoyoNews(input), []);
  const item = {
    post: {
      post_id: '12345',
      subject: 'Actualización de versión 7.1',
      content: '<script>bad()</script><b>Notas &amp; mejoras</b>',
      created_at: 1790000000,
      lang: 'es-es',
    },
    image_list: [{ url: 'https://upload-os-bbs.hoyolab.com/upload/cover.png' }],
  };
  const parsed = parseHoyoNews({
    retcode: 0,
    data: {
      list: [
        null,
        42,
        {},
        item,
        item,
        { post: { ...item.post, post_id: '1/../../evil' } },
        { post: { ...item.post, post_id: '5', lang: 'en-us' } },
      ],
    },
  });
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0]!.category, 'actualizacion');
  assert.equal(parsed[0]!.summary, 'Notas & mejoras');
  assert.equal(parsed[0]!.postUrl, 'https://www.hoyolab.com/article/12345');
  assert.equal(parsed[0]!.coverUrl, 'https://upload-os-bbs.hoyolab.com/upload/cover.png');
  assert.equal(parsed[0]!.publishedAt, new Date(1790000000000).toISOString());
  assert.equal(hoyoVersionInNews(parsed), '7.1');
  assert.equal(hoyoVersionInNews([]), null);
  const invalid = parseHoyoNews({
    data: {
      list: [
        {
          post: { post_id: '6', subject: 'Evento de salto', created_at: 1e99 },
          cover: { url: 'https://upload-os-bbs.hoyolab.com.evil.example/x.png' },
        },
      ],
    },
  })[0]!;
  assert.equal(invalid.coverUrl, null);
  assert.equal(invalid.publishedAt, '');
  assert.equal(invalid.category, 'evento');
});
test('HoYo code expiry preserves unknown validity and disables explicitly expired codes', () => {
  const code = { code: 'TEST', rewards: 'Recompensa' };
  assert.equal(hoyoCodeExpired(code), false);
  assert.equal(hoyoCodeExpired({ ...code, isExpired: true }), true);
  assert.equal(
    hoyoCodeExpired(
      { ...code, expiresAt: '2026-10-16T10:00:00Z' },
      Date.parse('2026-10-16T10:00:00Z'),
    ),
    true,
  );
});
