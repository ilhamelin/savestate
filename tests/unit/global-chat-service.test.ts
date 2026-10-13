import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

test('Global chat enforces authentication, atomic rate errors, ownership and stable history cursors', async () => {
  const fixture =
    'data:text/javascript,' +
    encodeURIComponent(`
    export const state = { auth:true, error:null, inserted:null, filters:[], rows:[] };
    const db = {from(table) {
      if(table!=='global_chat_messages') throw Error('Unexpected table');
      const q = { select(){return q}, order(key,opts){state.filters.push([key,opts]);return q}, limit(value){state.filters.push(['limit',value]);return q}, or(value){state.filters.push(['or',value]);return q}, lt(key,value){state.filters.push([key,value]);return q}, eq(){return q}, insert(value){state.inserted=value;return q}, single(){return Promise.resolve({data:state.rows[0],error:state.error})},maybeSingle(){return Promise.resolve({data:state.rows[0],error:state.error})}, then(done,fail){return Promise.resolve({data:state.rows,error:state.error}).then(done,fail)} };return q;
    }};
    export const publicClient = () => db;
    export const authenticated = async () => {if(!state.auth) throw Object.assign(new Error('No session'),{status:401});return {db,user:{id:'11111111-1111-4111-8111-111111111111'}}};
    export const publicEnv = () => ({url:'https://example.supabase.co',key:'public-test-key'});
  `);
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      if (specifier === 'server-only')
        return { url: 'data:text/javascript,export {};', shortCircuit: true };
      if (['@/lib/session', '@/lib/env', '@/integrations/supabase/public'].includes(specifier))
        return { url: fixture, shortCircuit: true };
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
  try {
    const service = await import('../../src/services/global-chat.ts');
    const { state } = await import(fixture);
    const id = '11111111-1111-4111-8111-111111111111';
    const row = (suffix: string, date: string) => ({
      id: id.slice(0, -1) + suffix,
      user_id: id,
      content: 'Hello',
      media_url: null,
      media_type: null,
      created_at: date,
      profiles: { id, username: 'gamer', avatar_url: null },
    });
    state.rows = [
      row('3', '2026-10-13T03:00:00Z'),
      row('2', '2026-10-13T02:00:00Z'),
      row('1', '2026-10-13T01:00:00Z'),
    ];
    const history = await service.listGlobalChatMessages({ limit: 2 });
    assert.deepEqual(
      history.messages.map((message) => message.id),
      [state.rows[1].id, state.rows[0].id],
    );
    assert.equal(history.nextCursor, `2026-10-13T02:00:00Z|${state.rows[1].id}`);
    state.filters = [];
    await service.listGlobalChatMessages({ before: history.nextCursor! });
    assert.ok(state.filters.some(([key]: [string]) => key === 'or'));
    assert.ok(state.filters.some(([key]: [string]) => key === 'id'));
    await assert.rejects(service.listGlobalChatMessages({ limit: 100 }));
    const sent = await service.postGlobalChatMessage({ content: ' hi ', userId: 'spoof' });
    assert.equal(sent.author.username, 'gamer');
    assert.deepEqual(state.inserted, {
      user_id: id,
      content: 'hi',
      media_url: null,
      media_type: null,
    });
    state.error = { code: 'P0001', message: 'global_chat_rate_limit' };
    await assert.rejects(
      service.postGlobalChatMessage({ content: 'again' }),
      (error: unknown) => (error as { status: number }).status === 429,
    );
    state.auth = false;
    await assert.rejects(
      service.postGlobalChatMessage({ content: 'unauthorized' }),
      (error: unknown) => (error as { status: number }).status === 401,
    );
    state.auth = true;
    state.error = null;
    await assert.rejects(
      service.uploadChatMedia(
        new File(['GIF89a'], 'a.gif', { type: 'image/gif' }),
        '22222222-2222-4222-8222-222222222222',
      ),
      (error: unknown) => (error as { status: number }).status === 403,
    );
    await assert.rejects(
      service.uploadChatMedia(new File(['not an image'], 'a.gif', { type: 'image/gif' }), id),
    );
  } finally {
    hooks.deregister();
  }
});
