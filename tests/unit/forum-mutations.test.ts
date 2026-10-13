import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
test('Forum reply mutations enforce ownership and closed threads and use the existing SQL timestamp trigger', async () => {
  const fixture =
    'data:text/javascript,' +
    encodeURIComponent(`export const state={owned:true,locked:false,operations:[],tags:[]};
 export const db={from(table){let operation={table,kind:'read',filters:[],payload:null};const query={select(){return query},eq(key,value){operation.filters.push([key,value]);return query},update(payload){operation.kind='update';operation.payload=payload;return query},delete(){operation.kind='delete';return query},async maybeSingle(){state.operations.push(operation);return {error:null,data:table==='forum_replies'?(state.owned?{thread_id:'00000000-0000-0000-0000-000000000002'}:null):{is_locked:state.locked,category_id:'off-topic'}}},async single(){state.operations.push(operation);return {error:null,data:{id:'00000000-0000-0000-0000-000000000001'}}}};return query;}};
 export const authenticated=async()=>({db,user:{id:'00000000-0000-0000-0000-000000000003'}});
 export const serverClient=async()=>db;export const currentUser=async()=>null;
 export const unstable_cache=fn=>fn;export const revalidatePath=path=>state.tags.push(path);export const revalidateTag=tag=>state.tags.push(tag);
 export const cleanMarkdown=text=>text;export const forumMarkdown=text=>text;export const scheduleDiscordCheckpoint=()=>{};
 `);
  const aliases = new Set([
    '@/services/discord',
    '@/integrations/supabase/server',
    '@/lib/session',
    'next/cache',
    './markdown',
    './forum-markdown',
  ]);
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      if (specifier === 'server-only')
        return { url: 'data:text/javascript,export {};', shortCircuit: true };
      if (aliases.has(specifier)) return { url: fixture, shortCircuit: true };
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
    const { forumMutation } = await import('../../src/services/forum.ts'),
      { state } = await import(fixture);
    const reply_id = '00000000-0000-0000-0000-000000000001';
    await forumMutation({ action: 'edit_reply', reply_id, content: 'Editada' });
    const write = state.operations.find((op: { kind: string }) => op.kind === 'update');
    assert.deepEqual(write.payload, { content: 'Editada' });
    assert.ok(
      write.filters.some(
        ([key, value]: [string, string]) =>
          key === 'user_id' && value === '00000000-0000-0000-0000-000000000003',
      ),
    );
    assert.ok(state.tags.includes('forum-directory'));
    state.operations = [];
    state.owned = false;
    await assert.rejects(
      () => forumMutation({ action: 'edit_reply', reply_id, content: 'Ajena' }),
      /respuesta propia/,
    );
    assert.ok(!state.operations.some((op: { kind: string }) => op.kind === 'update'));
    state.operations = [];
    state.owned = true;
    state.locked = true;
    await assert.rejects(() => forumMutation({ action: 'delete_reply', reply_id }), /cerrado/);
    assert.ok(!state.operations.some((op: { kind: string }) => op.kind === 'delete'));
    state.operations = [];
    state.locked = false;
    await forumMutation({ action: 'delete_reply', reply_id });
    const removed = state.operations.find((op: { kind: string }) => op.kind === 'delete');
    assert.ok(
      removed.filters.some(
        ([key, value]: [string, string]) =>
          key === 'user_id' && value === '00000000-0000-0000-0000-000000000003',
      ),
    );
  } finally {
    hooks.deregister();
  }
});
