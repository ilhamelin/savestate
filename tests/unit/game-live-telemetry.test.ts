import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mapDeals,
  mapStreams,
  mapHistoricalLow,
  nonnegative,
} from '../../src/domain/game-live-telemetry.ts';
test('Live deals encode redirect IDs and validate amounts and discount bounds', () => {
  const deals = mapDeals([
    { dealID: 'a&b', storeID: '1', salePrice: '0.00', normalPrice: '29.99', savings: '100.1' },
    { dealID: 'x', salePrice: '<script>', normalPrice: '2' },
  ]);
  assert.equal(deals.length, 1);
  assert.equal(deals[0]?.storeName, 'Steam');
  assert.equal(deals[0]?.savingsPercent, 100);
  assert.equal(deals[0]?.dealUrl, 'https://www.cheapshark.com/redirect?dealID=a%26b');
  assert.deepEqual(mapDeals(null), []);
  assert.equal(
    mapDeals([{ dealID: 'a%2Bb%3D', salePrice: '1.00', normalPrice: '2.00' }])[0]?.dealUrl,
    'https://www.cheapshark.com/redirect?dealID=a%2Bb%3D',
  );
});
test('Twitch stream thumbnails and links use trusted hosts and usernames', () => {
  const streams = mapStreams([
    {
      id: '1',
      user_login: 'channel',
      viewer_count: 0,
      thumbnail_url: 'https://static-cdn.jtvnw.net/a-{width}x{height}.jpg',
    },
    { id: '2', user_login: '../bad' },
    { id: '3', user_login: 'safe', thumbnail_url: 'https://evil.example/a.png' },
  ]);
  assert.equal(streams.length, 2);
  assert.match(streams[0]!.thumbnailUrl, /320x180/);
  assert.equal(streams[1]!.thumbnailUrl, '');
  assert.equal(streams[0]!.streamUrl, 'https://www.twitch.tv/channel');
  assert.equal(nonnegative(0), 0);
  assert.equal(nonnegative(-1), null);
  assert.equal(nonnegative(Infinity), null);
});
test('Historical lows handle absent and invalid timestamps without throwing', () => {
  assert.deepEqual(mapHistoricalLow({ cheapestPriceEver: { price: '2.50', date: 1700000000 } }), {
    price: '2.50',
    dateIso: '2023-11-14T22:13:20.000Z',
  });
  assert.equal(
    mapHistoricalLow({ cheapestPriceEver: { price: '2', date: Number.MAX_VALUE } })?.dateIso,
    null,
  );
  assert.equal(mapHistoricalLow(null), null);
});
