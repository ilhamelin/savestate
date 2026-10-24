/* global document, innerWidth, getComputedStyle */
import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(
  pathToFileURL(process.env.RUNNER_TEMP + '/spec13-tools/node_modules/playwright/index.mjs').href
);
const browser = await chromium.launch({
  executablePath: existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined,
  headless: true,
  args: ['--no-sandbox'],
});
const base = 'http://127.0.0.1:3000',
  dir = process.env.RUNNER_TEMP + '/spec13-images';
mkdirSync(dir, { recursive: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('https://static-cdn.jtvnw.net/**', (route) =>
    route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><rect width="320" height="180" fill="#173c39"/><circle cx="210" cy="50" r="32" fill="#c6b67a"/><path d="M0 150L85 40L220 180H0 M120 180L270 70L320 130V180" fill="#122330"/></svg>',
    }),
  );
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1100 });
    await page.goto(base + '/radar-qa', { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'El pulso de The Witcher 3: Wild Hunt' }).waitFor();
    await page.locator('.radar-stream-thumb img').first().waitFor();
    assert.equal(await page.locator('.radar-stat-card').count(), 3);
    assert.equal(await page.locator('.radar-stream-card').count(), 4);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
      'No page overflow at ' + width,
    );
    const layout = await page.locator('.game-live-radar').evaluate((el) => {
      const boxes = [...el.querySelectorAll('.radar-stream-card')].map((c) => ({
        y: Math.round(c.getBoundingClientRect().y),
        h: c.getBoundingClientRect().height,
      }));
      const titles = [...el.querySelectorAll('.radar-stream-copy p')].map((p) => ({
        height: p.getBoundingClientRect().height,
        clamp: getComputedStyle(p).webkitLineClamp,
        title: p.getAttribute('title'),
      }));
      const buttons = [...el.querySelectorAll('.radar-deal-row .button')].map((b) => ({
        h: b.getBoundingClientRect().height,
        left: b.getBoundingClientRect().left,
        right: b.getBoundingClientRect().right,
      }));
      return {
        boxes,
        titles,
        buttons,
        cardLeft: el.getBoundingClientRect().left,
        cardRight: el.getBoundingClientRect().right,
      };
    });
    for (const title of layout.titles) {
      assert.equal(title.clamp, '2');
      assert.ok(title.title.length > 0);
      assert.ok(Math.abs(title.height - layout.titles[0].height) < 0.5);
    }
    for (const box of layout.boxes)
      for (const peer of layout.boxes.filter((p) => p.y === box.y))
        assert.ok(Math.abs(box.h - peer.h) < 0.5, 'Aligned cards');
    for (const button of layout.buttons) {
      assert.ok(button.h >= 44);
      assert.ok(button.left >= layout.cardLeft);
      assert.ok(button.right <= layout.cardRight);
    }
    if (width === 1440)
      assert.equal(new Set(layout.boxes.map((b) => b.y)).size, 1, 'Four columns on desktop');
    await page.locator('.game-live-radar').screenshot({ path: dir + '/radar-' + width + '.png' });
  }
  const steam = page
    .locator('.radar-deal-row')
    .filter({ has: page.locator('[data-store="steam"]') });
  assert.equal(await steam.locator('del').count(), 0);
  const gog = page.locator('.radar-deal-row').filter({ has: page.locator('[data-store="gog"]') });
  assert.equal(await gog.locator('del').count(), 1);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('.radar-stream-card').first().hover();
  const motion = await page.locator('.game-live-radar').evaluate((el) => ({
    dots: [...el.querySelectorAll('.radar-live-dot')].map((d) => getComputedStyle(d).animationName),
    cards: [...el.querySelectorAll('.radar-stream-card')].map((c) => ({
      transform: getComputedStyle(c).transform,
      duration: getComputedStyle(c).transitionDuration,
    })),
  }));
  assert.ok(motion.dots.every((name) => name === 'none'));
  assert.ok(motion.cards.every((c) => c.transform === 'none' && c.duration === '0s'));
  const focus = page.locator('.radar-stream-card').first();
  await focus.focus();
  assert.equal(await focus.evaluate((el) => el.matches(':focus-visible')), true);
  await page.goto(base + '/radar-qa?empty=1', { waitUntil: 'domcontentloaded' });
  await page
    .getByText('No hay datos disponibles para este título en este momento. Prueba otra búsqueda.')
    .waitFor();
  assert.equal(await page.locator('.radar-stream-card').count(), 0);
  assert.equal(await page.locator('.radar-instant-gaming-row').count(), 1);
  assert.deepEqual(errors, []);
  console.log(
    'PASS: SPEC-13 browser QA, 320/390/768/1440 px, responsive offers, equal stream heights, 4 desktop columns, clamp/tooltips, reduced motion, keyboard focus and empty state.',
  );
} finally {
  await browser.close();
}
