import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

test('Freebies uses hourly cache and safely handles empty, malformed and failed upstream responses', async () => {
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      if (specifier === 'server-only')
        return { url: 'data:text/javascript,export {};', shortCircuit: true };
      if (specifier.startsWith('@/'))
        return {
          url: pathToFileURL(resolve('src', specifier.slice(2) + '.ts')).href,
          shortCircuit: true,
        };
      return next(specifier, context);
    },
    load(url, context, next) {
      if (url.startsWith('file:') && url.endsWith('.ts'))
        return {
          format: 'module',
          source: stripTypeScriptTypes(readFileSync(fileURLToPath(url), 'utf8'), {
            mode: 'transform',
          }),
          shortCircuit: true,
        };
      return next(url, context);
    },
  });
  const original = globalThis.fetch;
  let mode = 'ok';
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), 'https://www.gamerpower.com/api/giveaways?type=game');
    assert.equal((init as RequestInit & { next: { revalidate: number } }).next.revalidate, 3600);
    assert.equal(init?.redirect, 'error');
    if (mode === 'failed') throw new Error('Network unavailable');
    if (mode === 'empty') return Response.json({ status: 201 }, { status: 201 });
    if (mode === 'invalid') return new Response('invalid json');
    return Response.json([
      {
        id: 1,
        title: 'Aventura',
        type: 'Game',
        status: 'Active',
        worth: '$4.99',
        platforms: 'PC, Steam',
        thumbnail: 'https://www.gamerpower.com/offers/1/game.jpg',
        open_giveaway_url: 'https://www.gamerpower.com/open/game',
        end_date: 'N/A',
      },
    ]);
  };
  try {
    const { getActiveFreebies } = await import('../../src/services/freebies.ts');
    assert.equal((await getActiveFreebies())[0]?.title, 'Aventura');
    for (const value of ['failed', 'empty', 'invalid']) {
      mode = value;
      assert.deepEqual(await getActiveFreebies(), []);
    }
  } finally {
    globalThis.fetch = original;
    hooks.deregister();
  }
});
