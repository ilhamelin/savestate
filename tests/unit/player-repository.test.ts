import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

test('Pending friend requests reuse the authenticated viewer ID and retain the safe default', async () => {
  const fixtureUrl = `data:text/javascript,${encodeURIComponent(`
    export const counts = { authentication: 0, clients: 0, filters: [] };
    const query = {
      select() { return this; }, eq() { return this; }, order() { return this; },
      or(filter) { counts.filters.push(filter); return this; },
      async range() { return { data: [], error: null }; }
    };
    const db = { from() { return query; } };
    export async function serverClient() { counts.clients++; return db; }
    export async function authenticated() { counts.authentication++; return { db, user: { id: 'default-viewer' } }; }
    export function dbCheck(error) { if (error) throw error; }
  `)}`;
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      if (specifier === 'server-only')
        return { url: 'data:text/javascript,export {};', shortCircuit: true };
      if (['@/integrations/supabase/server', '@/lib/session', '@/lib/http'].includes(specifier))
        return { url: fixtureUrl, shortCircuit: true };
      return next(specifier, context);
    },
    load(url, context, next) {
      if (url.startsWith('file:') && url.endsWith('.ts'))
        return {
          format: 'module',
          shortCircuit: true,
          source: stripTypeScriptTypes(readFileSync(fileURLToPath(url), 'utf8'), {
            mode: 'transform',
          }),
        };
      return next(url, context);
    },
  });
  try {
    const { counts } = await import(fixtureUrl);
    const { pendingFriendRequests } = await import('../../src/repositories/player.ts');
    assert.deepEqual(await pendingFriendRequests('known-viewer'), { received: [], sent: [] });
    assert.equal(counts.authentication, 0);
    assert.equal(counts.clients, 1);
    assert.match(counts.filters[0], /sender_id.eq.known-viewer/);
    assert.deepEqual(await pendingFriendRequests(), { received: [], sent: [] });
    assert.equal(counts.authentication, 1);
    assert.match(counts.filters[1], /receiver_id.eq.default-viewer/);
  } finally {
    hooks.deregister();
  }
});
