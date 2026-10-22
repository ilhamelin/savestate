import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
test(
  'PWA reloads offline, invalidates other tabs and obeys online access denial',
  { timeout: 90000 },
  async () => {
    let userId = A,
      denied = false;
    const server = createServer(async (request, response) => {
      const path = new URL(request.url, 'http://localhost').pathname;
      response.setHeader('Cache-Control', 'no-store');
      if (path === '/api/library/offline-access') {
        response.writeHead(denied ? 403 : 200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ userId }));
        return;
      }
      if (path === '/library' || path === '/') {
        response.writeHead(200, { 'Content-Type': 'text/html' });
        response.end('<!doctype html><title>Online library fixture</title><h1>Online</h1>');
        return;
      }
      const assets = {
        '/library-sw.js': 'text/javascript',
        '/offline-library/index.html': 'text/html',
        '/offline-library/app.mjs': 'text/javascript',
        '/offline-library/store.mjs': 'text/javascript',
        '/offline-library/style.css': 'text/css',
      };
      if (!assets[path]) {
        response.writeHead(404);
        response.end();
        return;
      }
      try {
        response.writeHead(200, { 'Content-Type': assets[path] });
        response.end(await readFile('public' + path));
      } catch {
        response.end();
      }
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const base = 'http://127.0.0.1:' + server.address().port;
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await page.goto(base + '/library');
      await page.evaluate(async (ownerId) => {
        const store = await import('/offline-library/store.mjs');
        const lease = await store.synchronizeOfflineLibraryAccount(ownerId);
        const now = Date.now();
        await store.saveOfflineLibrary(lease, {
          version: 1,
          ownerId,
          savedAt: new Date(now).toISOString(),
          expiresAt: new Date(now + store.OFFLINE_MAX_AGE_MS).toISOString(),
          totalCount: 1,
          rows: [
            {
              gameId: '33333333-3333-4333-8333-333333333333',
              title: '<img src=x onerror=alert(1)> Celeste',
              slug: 'celeste',
              status: 'playing',
              rating: 9,
              hours: 2,
              sessions: 1,
              platforms: ['PC'],
            },
          ],
        });
        await navigator.serviceWorker.register('/library-sw.js', { scope: '/' });
        await navigator.serviceWorker.ready;
        if (!navigator.serviceWorker.controller)
          await new Promise((resolve) =>
            navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }),
          );
      }, A);
      await context.setOffline(true);
      await page.goto(base + '/library');
      await page.getByText('Celeste', { exact: false }).waitFor();
      assert.match(await page.locator('#connection').textContent(), /Offline/);
      assert.equal(await page.locator('#rows img').count(), 0); // Stored text cannot execute HTML.
      assert.equal(
        await page.getByRole('button', { name: /Guardar|Editar|Eliminar partida/ }).count(),
        0,
      );
      await page.reload();
      await page.locator('#rows article').waitFor();
      await page.locator('#search').fill('missing');
      assert.equal(await page.locator('#rows article').count(), 0);
      await page.locator('#search').fill('Celeste');
      await page.locator('#rows article').waitFor();
      const second = await context.newPage();
      await second.goto(base + '/library');
      await second.locator('#rows article').waitFor();
      await page.evaluate(async () => {
        await (await import('/offline-library/store.mjs')).revokeOfflineLibrary();
      });
      await second.waitForFunction(() => document.querySelectorAll('#rows article').length === 0);
      assert.equal(
        await page.evaluate(async () =>
          (await import('/offline-library/store.mjs')).readOfflineLibrary(),
        ),
        null,
      );
      await context.setOffline(false);
      await page.goto(base + '/library');
      await page.evaluate(async (ownerId) => {
        const store = await import('/offline-library/store.mjs'),
          lease = await store.synchronizeOfflineLibraryAccount(ownerId),
          now = Date.now();
        await store.saveOfflineLibrary(lease, {
          version: 1,
          ownerId,
          savedAt: new Date(now).toISOString(),
          expiresAt: new Date(now + store.OFFLINE_MAX_AGE_MS).toISOString(),
          totalCount: 0,
          rows: [],
        });
      }, A);
      userId = B;
      await page.goto(base + '/offline-library/index.html');
      await page.waitForFunction(
        () =>
          document.querySelector('#status').textContent.includes('sesión') ||
          document.querySelector('#status').textContent.includes('copia vigente'),
      );
      assert.equal(
        await page.evaluate(async () =>
          (await import('/offline-library/store.mjs')).readOfflineLibrary(),
        ),
        null,
      );
      denied = true;
      await page.reload();
      await page.waitForFunction(() =>
        document.querySelector('#status').textContent.includes('validarse'),
      );
      assert.equal(
        await page.evaluate(async () =>
          (await import('/offline-library/store.mjs')).readOfflineLibrary(),
        ),
        null,
      );
    } finally {
      await browser.close();
      await new Promise((resolve) => server.close(resolve));
    }
  },
);
