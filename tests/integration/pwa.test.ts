import test from 'node:test';
import assert from 'node:assert/strict';

test(
  'PWA: manifiesto, iconos PNG y metadatos móviles servidos por producción local',
  { skip: !process.env.TEST_APP_URL },
  async () => {
    const base = process.env.TEST_APP_URL!;
    assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
    const response = await fetch(`${base}/manifest.webmanifest`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') ?? '', /manifest\+json/);
    const manifest = await response.json();
    assert.equal(manifest.display, 'standalone');
    assert.equal(manifest.start_url, '/');
    assert.equal(manifest.scope, '/');
    assert.equal(manifest.theme_color, '#00f0ff');
    assert.equal(manifest.background_color, '#08080c');
    for (const [path, size] of [
      ['/icons/icon-192.png', 192],
      ['/icons/icon-512.png', 512],
      ['/icons/apple-touch-icon.png', 180],
    ] as const) {
      const image = await fetch(`${base}${path}`);
      assert.equal(image.status, 200);
      assert.match(image.headers.get('content-type') ?? '', /image\/png/);
      const bytes = Buffer.from(await image.arrayBuffer());
      assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
      assert.equal(bytes.readUInt32BE(16), size);
      assert.equal(bytes.readUInt32BE(20), size);
      if (size !== 180)
        assert.ok(
          manifest.icons.some(
            (icon: { src: string; sizes: string }) =>
              icon.src === path && icon.sizes === `${size}x${size}`,
          ),
        );
    }
    const page = await fetch(base);
    assert.equal(page.status, 200);
    assert.match(page.headers.get('content-security-policy') ?? '', /'nonce-/);
    const html = await page.text();
    assert.match(html, /rel="manifest"[^>]*href="\/manifest.webmanifest"/);
    assert.match(html, /name="theme-color" content="#00f0ff"/);
    assert.match(html, /name="apple-mobile-web-app-capable" content="yes"/);
    assert.match(html, /rel="apple-touch-icon"[^>]*href="\/icons\/apple-touch-icon.png"/);
    assert.match(html, /viewport-fit=cover/);
    assert.doesNotMatch(html, /user-scalable=no/);
  },
);
