import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

test('Gaming news fetches concurrently with 30 minute cache, Latin-1 decoding and partial fallbacks', async () => {
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
  const originalFetch = globalThis.fetch;
  let active = 0,
    maxActive = 0,
    mode = 'ok';
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    assert.equal((init as RequestInit & { next: { revalidate: number } })?.next.revalidate, 1800);
    assert.equal(init?.redirect, 'error');
    active++;
    maxActive = Math.max(maxActive, active);
    await new Promise((done) => setTimeout(done, 2));
    active--;
    if (mode === 'all-failed' || (mode === 'partial' && url.includes('es.ign.com')))
      throw new Error('Offline');
    const vandal = url.includes('vandal.elespanol.com');
    const host = vandal
      ? 'vandal.elespanol.com'
      : url.includes('3djuegos.com')
        ? 'www.3djuegos.com'
        : url.includes('areajugones.sport.es')
          ? 'areajugones.sport.es'
          : 'es.ign.com';
    const xml = `<rss><item><title>Acción y Pokémon</title><link>https://${host}/news/1</link><pubDate>Sat, 10 Oct 2026 17:00:00 GMT</pubDate><description>Resumen</description></item></rss>`;
    return new Response(Buffer.from(xml, vandal ? 'latin1' : 'utf8'), {
      headers: {
        'Content-Type': vandal ? 'text/xml; charset=ISO-8859-1' : 'text/xml; charset=utf-8',
      },
    });
  };
  try {
    const { getRecentGamingNews } = await import('../../src/services/gaming-news.ts');
    const news = await getRecentGamingNews();
    assert.equal(maxActive, 4);
    assert.equal(news.length, 4);
    assert.ok(news.some((item) => item.source === 'anime'));
    assert.ok(news.some((item) => item.source === '3djuegos'));
    assert.ok(news.every((item) => item.title === 'Acción y Pokémon'));
    mode = 'partial';
    const partial = await getRecentGamingNews();
    assert.equal(partial.length, 3);
    assert.equal(partial[0]?.source, 'vandal');
    assert.ok(partial.some((item) => item.source === 'anime'));
    mode = 'all-failed';
    assert.deepEqual(await getRecentGamingNews(), []);
  } finally {
    globalThis.fetch = originalFetch;
    hooks.deregister();
  }
});
