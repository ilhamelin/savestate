import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import sitemap from '../../src/app/sitemap.ts';
import robots from '../../src/app/robots.ts';
import { effectiveSeasonalTheme, HALLOWEEN_END_MS } from '../../src/domain/seasonal-theme.ts';
import { gatekeeperExempt } from '../../src/domain/gatekeeper.ts';

test('Halloween respects operator preference and the inclusive Chilean closing deadline', () => {
  assert.equal(effectiveSeasonalTheme(undefined, HALLOWEEN_END_MS - 1), 'halloween');
  assert.equal(effectiveSeasonalTheme('halloween', HALLOWEEN_END_MS), 'halloween');
  assert.equal(effectiveSeasonalTheme('halloween', HALLOWEEN_END_MS + 1), 'classic');
  assert.equal(effectiveSeasonalTheme('classic', HALLOWEEN_END_MS - 1), 'classic');
});

test('Sitemap indexes canonical routes including La Taberna with priorities and a matching robots URL', () => {
  const previous = process.env.NEXT_PUBLIC_APP_URL;
  try {
    process.env.NEXT_PUBLIC_APP_URL = 'https://savestate.example/';
    const entries = sitemap();
    assert.equal(entries.length, 13);
    assert.equal(new Set(entries.map((entry) => entry.url)).size, 13);
    const paths = entries.map((entry) => new URL(entry.url).pathname);
    assert.ok(paths.includes('/tavern'));
    assert.ok(!paths.includes('/forum') && !paths.includes('/highlights'));
    for (const entry of entries) {
      const path = new URL(entry.url).pathname;
      assert.equal(
        entry.priority,
        path === '/' ? 1 : ['/explore', '/hoyo'].includes(path) ? 0.9 : 0.8,
      );
      assert.equal(
        entry.changeFrequency,
        ['/', '/feed', '/hoyo'].includes(path) ? 'hourly' : 'daily',
      );
      assert.ok(entry.lastModified instanceof Date);
    }
    const policy = robots();
    assert.equal(policy.sitemap, 'https://savestate.example/sitemap.xml');
    assert.deepEqual(policy.rules, [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/guardian', '/gatekeeper', '/api/guardian/', '/api/gatekeeper/', '/settings'],
      },
    ]);
    delete process.env.NEXT_PUBLIC_APP_URL;
    assert.equal(sitemap()[0]?.url, 'https://savestate-eight.vercel.app');
    assert.equal(robots().sitemap, 'https://savestate-eight.vercel.app/sitemap.xml');
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = previous;
  }
});

test('SEO endpoints are public without exempting content or operator mutations', () => {
  assert.equal(gatekeeperExempt('/sitemap.xml'), true);
  assert.equal(gatekeeperExempt('/robots.txt'), true);
  assert.equal(gatekeeperExempt('/status'), true);
  assert.equal(gatekeeperExempt('/api/system-status'), true);
  for (const path of ['/', '/settings', '/status/private', '/sitemap.xml/other']) {
    assert.equal(gatekeeperExempt(path), false);
  }
});

test('Live seasonal refresh shares the deadline policy and error recovery hides internal messages', () => {
  const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
  assert.match(
    read('src/components/system-broadcast-banner.tsx'),
    /effectiveSeasonalTheme\(\s*result.switches.seasonal_theme,?\s*\)/,
  );
  const error = read('src/app/error.tsx');
  assert.match(error, /error.digest/);
  assert.doesNotMatch(error, /error.message/);
  assert.match(error, /soundFx.click\(\)/);
  assert.match(error, /reset\(\)/);
});
