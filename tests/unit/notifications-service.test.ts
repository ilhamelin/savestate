import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

test('Notification enrichment executes five independent queries together and includes the tracker owner', async () => {
  const fixture =
    'data:text/javascript,' +
    encodeURIComponent(`
    export const state = { active: 0, maxActive: 0, filters: [], errorTable: '', empty: false };
    const rows = [{id:'notice',kind:'friend_request',actor_id:'actor',badge_id:'badge',forum_thread_id:'thread',itch_tracker_id:'tracker',read_at:null,created_at:'2026-10-13T12:00:00Z'}];
    const data = { profiles:[{id:'actor',username:'friend'},{id:'viewer',username:'owner'}], badges:[{id:'badge',name:'Medal'}],forum_threads:[{id:'thread',category_id:'retro-corner'}],friendships:[{id:'request',sender_id:'actor',created_at:'2026-10-13T11:00:00Z'}],itch_trackers:[{id:'tracker',metadata:{title:'Indie'}}] };
    const db = { from(table) {
      let head = false;
      const q = {select(columns,opts){head=Boolean(opts?.head);return q},eq(){return q},order(){return q},limit(){return q},is(){return q},in(key,values){state.filters.push({table,key,values});return q},then(resolve,reject){
        state.active++;state.maxActive=Math.max(state.maxActive,state.active);
        return new Promise(done=>setTimeout(()=>{state.active--;done({data:table==='notifications'?(head?null:state.empty?[]:rows):data[table],count:1,error:state.errorTable===table?{message:'Database failure'}:null})},2)).then(resolve,reject);
      }};return q;
    }};
    export const authenticated = async () => ({ db, user: { id:'viewer' } });
  `);
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      if (specifier === 'server-only')
        return { url: 'data:text/javascript,export {};', shortCircuit: true };
      if (specifier === '@/lib/session') return { url: fixture, shortCircuit: true };
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
    const { notificationSummary } = await import('../../src/services/notifications.ts');
    const { state } = await import(fixture);
    const summary = await notificationSummary();
    assert.equal(state.maxActive, 5);
    const item = summary.items[0];
    assert.ok(item);
    assert.equal(item.trackerHref, '/players/owner#itch-tracker');
    assert.equal(item.friendshipId, 'request');
    assert.equal(item.badgeName, 'Medal');
    assert.equal(item.forumHref, '/forum/retro-corner/thread');
    for (const table of ['profiles', 'badges', 'forum_threads', 'friendships', 'itch_trackers']) {
      state.errorTable = table;
      await assert.rejects(notificationSummary());
    }
    state.errorTable = '';
    state.empty = true;
    state.filters = [];
    assert.deepEqual((await notificationSummary()).items, []);
    assert.deepEqual(state.filters, []);
  } finally {
    hooks.deregister();
  }
});
