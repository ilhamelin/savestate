import test from 'node:test';
import assert from 'node:assert/strict';
import { optimizeVaultImage, vaultImageDimensions } from '../../src/lib/vault-image.ts';

test('Vault image resizing preserves proportions, caps at 2560 and never upscales', () => {
  assert.deepEqual(vaultImageDimensions(5120, 2880), { width: 2560, height: 1440 });
  assert.deepEqual(vaultImageDimensions(1920, 1080), { width: 1920, height: 1080 });
  assert.deepEqual(vaultImageDimensions(2000, 4000), { width: 1280, height: 2560 });
  assert.throws(() => vaultImageDimensions(0, 10));
});
test('Vault WebP compression keeps smaller results, preserves metadata and releases resources on fallback', async () => {
  const priorImage = globalThis.Image,
    priorDocument = globalThis.document;
  const priorCreate = URL.createObjectURL,
    priorRevoke = URL.revokeObjectURL;
  let decodeError = false,
    output: Blob | null = new Blob(['small'], { type: 'image/webp' }),
    canvasAvailable = true;
  const draws: unknown[][] = [],
    revoked: string[] = [];
  class MockImage {
    naturalWidth = 5120;
    naturalHeight = 2880;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_value: string) {
      queueMicrotask(() => (decodeError ? this.onerror?.() : this.onload?.()));
    }
  }
  globalThis.Image = MockImage as unknown as typeof Image;
  globalThis.document = {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () =>
        canvasAvailable ? { drawImage: (...args: unknown[]) => draws.push(args) } : null,
      toBlob: (callback: (blob: Blob | null) => void, mime: string, quality: number) => {
        assert.equal(mime, 'image/webp');
        assert.equal(quality, 0.85);
        callback(output);
      },
    }),
  } as unknown as Document;
  URL.createObjectURL = () => 'blob:test';
  URL.revokeObjectURL = (url) => revoked.push(url);
  try {
    const original = new File([new Uint8Array(1024)], 'capture.jpeg', {
      type: 'image/jpeg',
      lastModified: 1234,
    });
    const result = await optimizeVaultImage(original);
    assert.equal(result.name, 'capture.webp');
    assert.equal(result.type, 'image/webp');
    assert.equal(result.size, 5);
    assert.equal(result.lastModified, 1234);
    assert.deepEqual(draws[0]?.slice(1), [0, 0, 2560, 1440]);
    assert.deepEqual(revoked, ['blob:test']);
    for (const candidate of [
      null,
      new Blob([new Uint8Array(2048)], { type: 'image/webp' }),
      new Blob(['jpg'], { type: 'image/jpeg' }),
    ]) {
      output = candidate;
      assert.equal(await optimizeVaultImage(original), original);
    }
    decodeError = true;
    assert.equal(await optimizeVaultImage(original), original);
    decodeError = false;
    canvasAvailable = false;
    assert.equal(await optimizeVaultImage(original), original);
    assert.equal(revoked.length, 6);
  } finally {
    globalThis.Image = priorImage;
    globalThis.document = priorDocument;
    URL.createObjectURL = priorCreate;
    URL.revokeObjectURL = priorRevoke;
  }
});
test('Vault preserves GIF, video, animated WebP and APNG bytes without invoking canvas', async () => {
  const webp = new Uint8Array(32);
  webp.set(new TextEncoder().encode('RIFF'), 0);
  webp.set(new TextEncoder().encode('WEBPVP8X'), 8);
  webp[20] = 2;
  const png = new Uint8Array(32);
  png.set([137, 80, 78, 71, 13, 10, 26, 10]);
  png.set(new TextEncoder().encode('acTL'), 12);
  for (const file of [
    new File(['GIF89a'], 'a.gif', { type: 'image/gif' }),
    new File(['clip'], 'a.mp4', { type: 'video/mp4' }),
    new File(['clip'], 'a.webm', { type: 'video/webm' }),
    new File([webp], 'a.webp', { type: 'image/webp' }),
    new File([png], 'a.png', { type: 'image/png' }),
  ])
    assert.equal(await optimizeVaultImage(file), file);
});
