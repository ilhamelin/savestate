import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bannerExtension,
  MAX_BANNER_BYTES,
  isAnimatedBannerBytes,
  isValidBannerStoragePath,
  isVideoBannerSource,
} from './banner-media.ts';
const ascii = (value: string) => new TextEncoder().encode(value);
function webp(chunk: string, flag = 0) {
  const bytes = new Uint8Array(64);
  bytes.set(ascii('RIFF'));
  bytes.set(ascii('WEBP'), 8);
  bytes.set(ascii(chunk), 12);
  bytes[20] = flag;
  return bytes;
}
function png(...types: string[]) {
  const bytes = new Uint8Array(8 + types.length * 12);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  types.forEach((type, i) => bytes.set(ascii(type), 12 + i * 12));
  return bytes;
}
test('banner detects animated WebP flags/chunks without flattening static or malformed input', () => {
  assert.equal(isAnimatedBannerBytes(webp('VP8X', 2), 'image/webp'), true);
  assert.equal(isAnimatedBannerBytes(webp('ANIM'), 'image/webp'), true);
  assert.equal(isAnimatedBannerBytes(webp('ANMF'), 'image/webp'), true);
  assert.equal(isAnimatedBannerBytes(webp('VP8X', 0), 'image/webp'), false);
  assert.equal(isAnimatedBannerBytes(webp('VP8 '), 'image/webp'), false);
  assert.equal(isAnimatedBannerBytes(ascii('ANIM'), 'image/webp'), false);
});
test('banner APNG parsing stops at image data and bounds truncated chunks; AVIF detects sequence brands', () => {
  assert.equal(isAnimatedBannerBytes(png('IHDR', 'acTL', 'IDAT'), 'image/png'), true);
  assert.equal(isAnimatedBannerBytes(png('IHDR', 'IDAT', 'acTL'), 'image/png'), false);
  const broken = png('IHDR', 'acTL');
  new DataView(broken.buffer).setUint32(8, 4294967295);
  assert.equal(isAnimatedBannerBytes(broken, 'image/png'), false);
  assert.equal(isAnimatedBannerBytes(new Uint8Array(7), 'image/png'), false);
  const avif = new Uint8Array(24);
  new DataView(avif.buffer).setUint32(0, 24);
  avif.set(ascii('ftypavif'), 4);
  avif.set(ascii('avis'), 16);
  assert.equal(isAnimatedBannerBytes(avif, 'image/avif'), true);
  avif.set(ascii('mif1'), 16);
  assert.equal(isAnimatedBannerBytes(avif, 'image/avif'), false);
  for (const mime of ['image/gif', 'image/apng', 'video/webm', 'video/mp4'])
    assert.equal(isAnimatedBannerBytes(new Uint8Array(), mime), true);
});
test('banner storage paths allow only canonical files owned by the exact user', () => {
  const prefix = '/storage/v1/object/public/profiles/owner/';
  for (const ext of ['webp', 'gif', 'png', 'apng', 'avif', 'jpg', 'webm', 'mp4'])
    assert.equal(isValidBannerStoragePath(prefix + 'banner.' + ext, 'owner'), true);
  for (const path of [
    prefix + 'avatar.gif',
    prefix + 'sub/banner.mp4',
    prefix + 'banner.svg',
    prefix + 'banner.webp/extra',
    prefix + 'banner.mp4?x=1',
    prefix + 'banner.MP4',
    prefix.replace('/owner/', '/other/') + 'banner.webp',
  ])
    assert.equal(isValidBannerStoragePath(path, 'owner'), false);
  assert.equal(isValidBannerStoragePath(prefix + 'banner.webp', '../owner'), false);
});
test('banner media recognizes video previews and cache-busted URLs; MIME and 8 MB boundary are strict', () => {
  for (const url of ['https://safe.test/banner.mp4?v=1', '/banner.webm#preview', '/banner.MP4'])
    assert.equal(isVideoBannerSource(url), true);
  assert.equal(isVideoBannerSource('blob:preview', 'video/webm'), true);
  for (const url of [null, undefined, '/banner.png?video=.mp4', '/banner.mp4.png'])
    assert.equal(isVideoBannerSource(url), false);
  assert.equal(bannerExtension('video/mp4', MAX_BANNER_BYTES), 'mp4');
  for (const size of [0, -1, MAX_BANNER_BYTES + 1, NaN, Infinity])
    assert.throws(() => bannerExtension('image/webp', size));
  for (const mime of ['image/svg+xml', 'toString', 'constructor', 'application/octet-stream'])
    assert.throws(() => bannerExtension(mime, 1));
});
