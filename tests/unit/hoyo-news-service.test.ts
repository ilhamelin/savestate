import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

test('HoYo news loads games in parallel with Spanish headers, bounded responses and independent fallbacks', async () => {
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
  const previousFetch = globalThis.fetch;
  let active = 0,
    maxActive = 0,
    fail = false;
  globalThis.fetch = async (input, options) => {
    active++;
    maxActive = Math.max(maxActive, active);
    try {
      const url = new URL(String(input));
      assert.equal(url.hostname, 'bbs-api-os.hoyolab.com');
      assert.equal(new Headers(options?.headers).get('x-rpc-language'), 'es-es');
      assert.equal(
        (options as RequestInit & { next: { revalidate: number } }).next.revalidate,
        900,
      );
      assert.equal(options?.redirect, 'error');
      assert.ok(options?.signal);
      await new Promise((resolve) => setTimeout(resolve, 5));
      if (fail && url.searchParams.get('gids') === '6')
        return new Response('unavailable', { status: 503 });
      return Response.json({
        retcode: 0,
        data: {
          list: [
            {
              post: {
                post_id: url.searchParams.get('gids'),
                subject: 'Anuncio oficial',
                created_at: 1790000000,
              },
            },
          ],
        },
      });
    } finally {
      active--;
    }
  };
  try {
    const { fetchHoyoNews } = await import('../../src/services/hoyo-news.ts');
    const result = await Promise.all([fetchHoyoNews('genshin'), fetchHoyoNews('hsr')]);
    assert.equal(maxActive, 2);
    assert.deepEqual(
      result.map((list) => list.length),
      [1, 1],
    );
    fail = true;
    assert.deepEqual(
      (await Promise.all([fetchHoyoNews('genshin'), fetchHoyoNews('hsr')])).map(
        (list) => list.length,
      ),
      [1, 0],
    );
    globalThis.fetch = async () => new Response('not JSON');
    assert.deepEqual(await fetchHoyoNews('genshin'), []);
    globalThis.fetch = async () => new Response('x'.repeat(1_000_001));
    assert.deepEqual(await fetchHoyoNews('hsr'), []);
    globalThis.fetch = async () => {
      throw new Error('Timeout');
    };
    assert.deepEqual(await fetchHoyoNews('genshin'), []);
  } finally {
    globalThis.fetch = previousFetch;
    hooks.deregister();
  }
});
