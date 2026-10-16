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
