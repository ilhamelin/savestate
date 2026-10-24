/* global document, innerWidth, getComputedStyle */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(
  pathToFileURL(process.env.RUNNER_TEMP + '/spec11-tools/node_modules/playwright/index.mjs').href
);
const port = 4186,
  base = 'http://127.0.0.1:' + port;
let logs = '';
const server = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)],
  {
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: 'https://127.0.0.1:1',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fixture-public-anon',
      SUPABASE_SERVICE_ROLE_KEY: '',
      GATEKEEPER_ENABLED: 'true',
      NEXT_PUBLIC_APP_URL: base,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);
server.stdout.on('data', (data) => {
  logs += data;
});
server.stderr.on('data', (data) => {
  logs += data;
});
let browser;
try {
  for (let i = 0; i < 100; i++) {
    try {
      await fetch(base + '/robots.txt', { signal: AbortSignal.timeout(1000) });
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  const response = await fetch(base + '/api/system-status');
  assert.equal(response.status, 200);
  const report = await response.json();
  assert.equal(report.health.services.length, 6);
  assert.equal(report.health.overall, 'down');
  assert.equal(report.stateAvailable, false);
  const second = await (await fetch(base + '/api/system-status?healthOnly=1')).json();
  assert.equal(second.health.generatedAt, report.health.generatedAt);
  assert.ok(!JSON.stringify(second).includes('fixture-public-anon'));
  const denied = await fetch(base + '/api/guardian/dependencies/probe', {
    method: 'POST',
    headers: { Origin: base },
  });
  assert.ok([401, 403].includes(denied.status));
  browser = await chromium.launch({
    headless: true,
    executablePath: existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined,
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const loaded = await page.goto(base + '/status', { waitUntil: 'domcontentloaded' });
    assert.equal(loaded.status(), 200);
    await page.getByRole('heading', { name: 'Estado de SaveState y sus dependencias.' }).waitFor();
    await page.getByRole('heading', { name: 'Incidente en la base de datos principal' }).waitFor();
    assert.equal(await page.locator('.dependency-card').count(), 6);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2),
      false,
    );
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(
      await page
        .locator('.dependency-pulse')
        .evaluate((element) => getComputedStyle(element).animationName),
      'none',
    );
    console.log('PASS real production build /status HTTP200, core down, six cards, width=' + width);
  }
  assert.deepEqual(errors, []);
  console.log(
    'PASS real route diagnostics survive unavailable DB + enabled Gatekeeper; cache stable; anonymous probe denied.',
  );
} catch (error) {
  console.log(logs.slice(-5000));
  throw error;
} finally {
  await browser?.close();
  server.kill('SIGTERM');
  if (server.exitCode !== null && server.exitCode !== 0) console.log(logs.slice(-5000));
}
