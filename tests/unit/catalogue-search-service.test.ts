import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
test('Catalogue uses IGDB ratings as fallback, preserves community priority and strips transient columns before upsert', async () => {
  const fixture =
    'data:text/javascript,' +
    encodeURIComponent(`export const state={remote:[],page:[],saved:[],input:null,fail:false};
    export const isConfigured=()=>true;
    export const fetchCatalogue=async filters=>{state.input=filters;if(state.fail)throw Error('Mock unavailable');return state.remote;};
    export const localCatalogue=async()=>state.page;
    export const catalogueAdmin=()=>({from:()=>({upsert:async rows=>{state.saved=rows;return {error:null};}})});`);
  const mockAliases = new Set([
    '@/lib/env',
    '@/integrations/igdb/server',
    '@/repositories/catalogue',
    '@/integrations/supabase/admin',
  ]);
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      if (specifier === 'server-only')
        return { url: 'data:text/javascript,export {};', shortCircuit: true };
      if (mockAliases.has(specifier)) return { url: fixture, shortCircuit: true };
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
  const names = ['TWITCH_CLIENT_ID', 'TWITCH_CLIENT_SECRET', 'SUPABASE_SERVICE_ROLE_KEY'];
  const previous = names.map((n) => process.env[n]);
  names.forEach((n) => (process.env[n] = 'mock-only'));
  try {
    const { catalogue } = await import('../../src/services/catalogue.ts'),
      { state } = await import(fixture);
    const { parseFilters } = await import('../../src/integrations/igdb/query.ts');
    const filters = parseFilters(new URLSearchParams({ rating: '8' }));
    state.remote = Array.from({ length: 24 }, (_, i) => ({
      igdb_id: i + 1,
      title: 'Game ' + i,
      slug: 'game-' + i,
      first_release_date: 1790000000,
      igdb_rating: 8.6,
      screenshots: ['https://images.igdb.com/igdb/image/upload/t_screenshot_big/sc_' + i + '.jpg'],
    }));
    state.page = state.remote.map((g: { igdb_id: number }) => ({
      id: String(g.igdb_id),
      igdb_id: g.igdb_id,
      community_rating: null,
    }));
    state.page[0].community_rating = 7;
    state.page[1].community_rating = 9;
    const result = await catalogue(filters);
    assert.equal(state.input.minRating, 8);
    assert.equal(result.source, 'igdb');
    assert.deepEqual(result.games[0]?.screenshots, state.remote[1].screenshots);
    assert.equal(result.games.length, 23);
    assert.equal(result.nextOffset, 24);
    assert.equal(result.games[0]?.community_rating, 9);
    assert.equal(result.games[1]?.community_rating, 8.6);
    assert.ok(
      state.saved.every((row: object) => !('igdb_rating' in row) && !('first_release_date' in row) && !('screenshots' in row)),
    );
    state.page.forEach((g: { community_rating: number | null }) => (g.community_rating = 2));
    const empty = await catalogue(filters);
    assert.deepEqual(empty.games, []);
    assert.equal(empty.nextOffset, null);
    state.fail = true;
    state.page[0].community_rating = null;
    state.page[1].community_rating = 9;
    const fallback = await catalogue(filters);
    assert.equal(fallback.source, 'local');
    assert.deepEqual(fallback.games[0]?.screenshots, []);
    assert.equal(fallback.games.length, 1);
    assert.equal(fallback.games[0]?.community_rating, 9);
  } finally {
    names.forEach((n, i) => {
      if (previous[i] === undefined) delete process.env[n];
      else process.env[n] = previous[i];
    });
    hooks.deregister();
  }
});
