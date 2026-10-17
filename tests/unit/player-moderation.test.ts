import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

test('Guardian moderation rejects non-admin, self actions, bad confirmations and unsafe cleanup; routes enforce origin', async () => {
  const owner = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const target = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const fixture = `data:text/javascript,${encodeURIComponent(`
    export const state={admin:true,target:{id:'${target}',username:'player'},calls:[],recent:false,vault:false,failCleanup:false,ack:true};
    export const publicEnv=()=>({url:'https://example.supabase.co',key:'anon'});
    export async function authenticatedAdmin(){if(!state.admin){const error=new Error('Forbidden');error.status=403;throw error;}return {id:'${owner}'};}
    export const configuredGateSecret=()=> 'configured';
    export async function purgePlayerVault(id){state.calls.push(['purge',id]);if(state.failCleanup)throw new Error('R2 unavailable');}
    let table='',recent=false;
    const query={select(){recent=false;return query;},eq(){return query;},gte(){recent=true;return query;},maybeSingle(){return Promise.resolve({data:state.target,error:null});},limit(){return Promise.resolve({data:table==='user_vault_media'&&(recent?state.recent:state.vault)?[{id:'file'}]:[],error:null});},update(values){state.calls.push(['update',values]);return query;},then(ok){return Promise.resolve({error:null}).then(ok);}};
    const db={from(name){table=name;return query;},async rpc(name,args){state.calls.push([name,args]);return {data:state.ack,error:null};},auth:{admin:{async deleteUser(id){state.calls.push(['delete',id]);return {error:null};}}},storage:{async listBuckets(){state.calls.push(['storage']);return {data:[],error:null};}}};
    export const createClient=()=>db;
  `)}`;
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      if (
        [
          '@/lib/env',
          '@/lib/session',
          '@/services/gatekeeper',
          '@/services/r2',
          '@supabase/supabase-js',
        ].includes(specifier)
      )
        return { url: fixture, shortCircuit: true };
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
  const prior = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const priorAccount = process.env.R2_ACCOUNT_ID;
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only';
  delete process.env.R2_ACCOUNT_ID;
  try {
    const { state } = await import(fixture);
    const { moderatePlayer, acknowledgePlayerGate } =
      await import('../../src/services/player-moderation.ts');
    const { POST } = await import('../../src/app/api/guardian/players/[id]/action/route.ts');
    state.admin = false;
    await assert.rejects(
      moderatePlayer(target, { action: 'delete', confirmation: 'player' }),
      /Forbidden/,
    );
    state.admin = true;
    for (const action of ['lock', 'unlock', 'reset', 'delete'])
      await assert.rejects(
        moderatePlayer(owner.toUpperCase(), { action, confirmation: 'player' }),
        /propia cuenta/,
      );
    assert.equal(state.calls.length, 0);
    await assert.rejects(moderatePlayer(target, { action: 'unknown' }), /no válida/);
    await assert.rejects(moderatePlayer('invalid', { action: 'lock' }), /inválido/);
    for (const action of ['reset', 'delete'])
      await assert.rejects(moderatePlayer(target, { action, confirmation: 'wrong' }), /confirmar/);
    assert.equal(state.calls.length, 0);
    await moderatePlayer(target, { action: 'lock' });
    assert.equal(state.calls.at(-1)[1].access_locked, true);
    assert.ok(Date.parse(state.calls.at(-1)[1].access_locked_at));
    await moderatePlayer(target, { action: 'unlock' });
    assert.deepEqual(state.calls.at(-1)[1], { access_locked: false, access_locked_at: null });
    state.recent = true;
    await assert.rejects(
      moderatePlayer(target, { action: 'reset', confirmation: 'player' }),
      /subidas recientes/,
    );
    state.recent = false;
    state.vault = true;
    state.failCleanup = true;
    await assert.rejects(
      moderatePlayer(target, { action: 'delete', confirmation: 'player' }),
      /R2 unavailable/,
    );
    assert.ok(!state.calls.some((call: unknown[]) => call[0] === 'delete'));
    state.failCleanup = false;
    await moderatePlayer(target, { action: 'reset', confirmation: 'player' });
    assert.deepEqual(state.calls.at(-1), ['reset_player_account', { p_target_id: target }]);
    await moderatePlayer(target, { action: 'delete', confirmation: 'player' });
    assert.deepEqual(state.calls.at(-1), ['delete', target]);
    assert.ok(
      state.calls.findIndex((call: unknown[]) => call[0] === 'storage') < state.calls.length - 1,
    );
    state.ack = false;
    await assert.rejects(acknowledgePlayerGate(target, '2026-10-16T10:00:00Z'), /acceso cambió/);
    state.ack = true;
    await acknowledgePlayerGate(target, '2026-10-16T10:00:00Z');
    const count = state.calls.length;
    const request = new Request('https://savestate.test/api/guardian/players/action', {
      method: 'POST',
      headers: { origin: 'https://evil.example', 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'delete', confirmation: 'player' }),
    });
    assert.equal((await POST(request, { params: Promise.resolve({ id: target }) })).status, 403);
    assert.equal(state.calls.length, count);
    state.target = null;
    await assert.rejects(moderatePlayer(target, { action: 'lock' }), /No se encontró/);
  } finally {
    hooks.deregister();
    if (prior === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = prior;
    if (priorAccount === undefined) delete process.env.R2_ACCOUNT_ID;
    else process.env.R2_ACCOUNT_ID = priorAccount;
  }
});
