import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { broadcastInput, guardianXp, systemSwitchInput } from '../../src/domain/guardian-suite.ts';

test('Guardian suite validates switches, broadcast bounds and strictly integral XP', () => {
  for (const key of ['gatekeeper_enabled', 'registrations_open', 'double_xp'])
    assert.deepEqual(systemSwitchInput({ key, value: false }), { key, value: false });
  assert.deepEqual(systemSwitchInput({ key: 'seasonal_theme', value: 'classic' }), {
    key: 'seasonal_theme',
    value: 'classic',
  });
  for (const input of [
    { key: 'unknown', value: true },
    { key: 'gatekeeper_enabled', value: 'false' },
    { key: 'seasonal_theme', value: 'other' },
    { key: 'registrations_open', value: 1 },
    { key: 'double_xp', value: 'true' },
  ])
    assert.throws(() => systemSwitchInput(input));
  assert.equal(broadcastInput({ active: false }).active, false);
  assert.equal(
    broadcastInput({ active: true, message: ' hola ', category: 'event', notifyDiscord: true })
      .message,
    'hola',
  );
  for (const input of [
    { active: true, message: '', category: 'info' },
    { active: true, message: 'x'.repeat(241), category: 'info' },
    { active: true, message: 'ok', category: 'bad' },
    { active: 'true' },
    { active: true, message: 'ok', category: 'info', notifyDiscord: 'true' },
  ])
    assert.throws(() => broadcastInput(input));
  for (const amount of [50, 100, 500, 100000]) assert.equal(guardianXp(amount), amount);
  for (const amount of [0, -1, 1.5, NaN, Infinity, 100001, '500', null])
    assert.throws(() => guardianXp(amount));
});

test('Guardian suite protects routes, reports partial Discord delivery, rewards players and caches switches for 10 seconds', async () => {
  const fixture = `data:text/javascript,${encodeURIComponent(`
    import {AppError} from '@/lib/http';
    export const state={admin:true,configured:true,seed:true,failDb:false,failDiscord:false,calls:[],reads:0,switches:[{key:'gatekeeper_enabled',value:false},{key:'registrations_open',value:true},{key:'seasonal_theme',value:'halloween'},{key:'double_xp',value:false}]};
    export const publicEnv=()=>({url:'https://example.supabase.co',key:'anon'});
    export const isConfigured=()=>state.configured;
    export async function authenticatedAdmin(){if(!state.admin)throw new AppError('denied',403);return {id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'};}
    export function configuredGateSecret(){if(!state.seed)throw new AppError('Missing seed',503);return 'configured';}
    export async function guardianDiscordHealth(){return {configured:true,available:true};}
    export async function fetchGuardianDatabaseHardware(){state.calls.push(['hardware']);return {cpuPercent:null,ramPercent:63,diskPercent:17,diskTotalBytes:2000,diskUsedBytes:340,measuredAt:'2026-10-16T00:00:00Z'};}
    export async function postGuardianBroadcast(...args){state.calls.push(['discord',...args]);if(state.failDiscord)throw new Error('Discord unavailable');}
    export function createClient(){return {from(table){
      const q={select(){return q;},eq(){return q;},order(){return q;},limit(){return q;},abortSignal(){return q;},upsert(row){state.calls.push(['upsert',table,row]);return q;},delete(){state.calls.push(['delete',table]);return q;},insert(row){state.calls.push(['insert',table,row]);return q;},maybeSingle(){return Promise.resolve({data:table==='system_broadcasts'?{id:'broadcast',message:'hello',category:'info',created_at:'2026-10-16'}:{id:'player'},error:null});},then(ok){if(table==='system_switches')state.reads++;return Promise.resolve({data:table==='system_switches'?state.switches:[],error:state.failDb?{message:'unavailable',code:'PGRST000'}:null}).then(ok);}};return q;
    },async rpc(name,args){state.calls.push([name,args]);if(name==='guardian_set_switch')state.switches=state.switches.map(row=>row.key===args.p_key?{...row,value:args.p_value}:row);return {data:name==='guardian_broadcast'?'broadcast':name==='grant_player_xp'?[{new_xp:500,new_level:3}]:name==='guardian_telemetry'?{storage_bytes:1024,users_total:5,users_recent:2}:true,error:null};}};}
  `)}`;
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      if (
        [
          '@/lib/env',
          '@/lib/session',
          '@/services/gatekeeper',
          '@/services/discord',
          '@/services/guardian-hardware',
          '@supabase/supabase-js',
        ].includes(specifier)
      )
        return { url: fixture, shortCircuit: true };
      // Relative service imports resolve through these aliases for the same mock boundary.
      if (
        context.parentURL?.endsWith('/src/services/guardian-suite.ts') &&
        ['./gatekeeper', './discord'].includes(specifier)
      )
        return { url: fixture, shortCircuit: true };
      if (specifier === 'server-only')
        return { url: 'data:text/javascript,export {};', shortCircuit: true };
      if (specifier.startsWith('@/'))
        return {
          url: pathToFileURL(resolve('src', specifier.slice(2) + '.ts')).href,
          shortCircuit: true,
        };
      if (specifier.startsWith('./') && context.parentURL?.includes('/src/services/'))
        return { url: new URL(specifier + '.ts', context.parentURL).href, shortCircuit: true };
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
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only';
  const oldNow = Date.now;
  let clock = oldNow();
  Date.now = () => clock;
  const id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  try {
    const { state } = await import(fixture);
    const services = await import('../../src/services/guardian-suite.ts');
    const { sendOperatorSignal } = await import('../../src/services/operator-signals.ts');
    const system = await import('../../src/services/system-state.ts');
    const routes = await Promise.all(
      ['broadcast', 'switches', 'telemetry', 'security-logs'].map(
        (path) => import(`../../src/app/api/guardian/${path}/route.ts`),
      ),
    );
    state.admin = false;
    for (const route of routes) assert.equal((await route.GET()).status, 403);
    for (const fn of [
      () => services.changeGuardianBroadcast({ active: false }),
      () => services.changeGuardianSwitch({ key: 'registrations_open', value: false }),
      () => services.rewardGuardianPlayer(id, { xp: 50 }),
      () => sendOperatorSignal(id, 'operator_kick'),
      () => sendOperatorSignal(id, 'operator_whisper', { message: 'Hola' }),
    ])
      await assert.rejects(fn(), /denied/);
    assert.equal(state.calls.length, 0);
    state.admin = true;
    await assert.rejects(
      sendOperatorSignal('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'operator_kick'),
      /Inmunidad/,
    );
    await assert.rejects(sendOperatorSignal(id, 'operator_whisper', { message: ' '.repeat(10) }));
    await assert.rejects(sendOperatorSignal(id, 'operator_whisper', { message: 'a'.repeat(141) }));
    assert.deepEqual(await sendOperatorSignal(id, 'operator_whisper', { message: ' Hola ' }), {
      sent: true,
    });
    assert.deepEqual(await sendOperatorSignal(id, 'operator_kick'), { sent: true });
    assert.ok(
      state.calls.some(
        (call: [string, { p_message?: string }]) =>
          call[0] === 'guardian_operator_signal' && call[1].p_message === 'Hola',
      ),
    );
    for (const path of ['kick', 'whisper']) {
      const route = await import(`../../src/app/api/guardian/players/[id]/${path}/route.ts`);
      const request = (origin: string) =>
        new Request(`https://example.test/api/guardian/players/${id}/${path}`, {
          method: 'POST',
          headers: { origin, 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'Hola' }),
        });
      assert.equal(
        (await route.POST(request('https://evil.example'), { params: Promise.resolve({ id }) }))
          .status,
        403,
      );
      state.admin = false;
      assert.equal(
        (await route.POST(request('https://example.test'), { params: Promise.resolve({ id }) }))
          .status,
        403,
      );
      state.admin = true;
      assert.equal(
        (await route.POST(request('https://example.test'), { params: Promise.resolve({ id }) }))
          .status,
        200,
      );
    }
    const broadcast = await services.changeGuardianBroadcast({
      active: true,
      message: 'Notice',
      category: 'warning',
      notifyDiscord: true,
    });
    assert.equal(broadcast.discord, 'sent');
    state.failDiscord = true;
    assert.equal(
      (
        await services.changeGuardianBroadcast({
          active: true,
          message: 'Notice',
          category: 'info',
          notifyDiscord: true,
        })
      ).discord,
      'failed',
    );
    assert.ok(
      state.calls.some(
        (call: unknown[]) =>
          call[0] === 'insert' &&
          (call[2] as { event: string }).event === 'broadcast_discord_failed',
      ),
    );
    assert.equal(
      (await services.changeGuardianBroadcast({ active: false, notifyDiscord: true })).discord,
      'skipped',
    );
    const first = await system.getSystemSwitches();
    assert.equal(first.double_xp, false);
    assert.equal(first.gatekeeper_enabled, false);
    const reads = state.reads;
    state.switches[0].value = true;
    assert.equal((await system.getSystemSwitches()).gatekeeper_enabled, false);
    assert.equal(state.reads, reads);
    clock += 10001;
    assert.equal((await system.getSystemSwitches()).gatekeeper_enabled, true);
    state.seed = false;
    await assert.rejects(
      services.changeGuardianSwitch({ key: 'gatekeeper_enabled', value: true }),
      /Missing seed/,
    );
    state.seed = true;
    await services.changeGuardianSwitch({ key: 'gatekeeper_enabled', value: false });
    assert.equal((await system.getSystemSwitches()).gatekeeper_enabled, false);
    await services.changeGuardianSwitch({ key: 'seasonal_theme', value: 'classic' });
    assert.equal((await system.getSystemSwitches()).seasonal_theme, 'classic');
    await services.changeGuardianSwitch({ key: 'double_xp', value: true });
    assert.equal((await system.getSystemSwitches()).double_xp, true);
    await services.changeGuardianSwitch({ key: 'double_xp', value: false });
    assert.equal((await system.getSystemSwitches()).double_xp, false);
    await services.rewardGuardianPlayer('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', { xp: 50 });
    await services.rewardGuardianPlayer('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', {
      badge_id: 'completionist',
      action: 'grant',
    });
    assert.deepEqual(await services.rewardGuardianPlayer(id, { xp: 500 }), {
      new_xp: 500,
      new_level: 3,
    });
    await assert.rejects(services.rewardGuardianPlayer(id, { xp: 1.5 }), /entero/);
    await services.rewardGuardianPlayer(id, { badge_id: 'completionist', action: 'grant' });
    assert.ok(
      state.calls.some((call: unknown[]) => call[0] === 'upsert' && call[1] === 'user_badges'),
    );
    await services.rewardGuardianPlayer(id, { badge_id: 'completionist', action: 'revoke' });
    assert.ok(
      state.calls.some((call: unknown[]) => call[0] === 'delete' && call[1] === 'user_badges'),
    );
    const telemetry = await services.guardianTelemetry();
    assert.equal(telemetry.users.total, 5);
    assert.equal(telemetry.database.ramPercent, 63);
    assert.equal(telemetry.database.connections.active, null);
    assert.equal(telemetry.database.diskSizeBytes, null);
    assert.equal(telemetry.database.cpuPercent, null);
    assert.ok(telemetry.vercel.memory.rssMB > 0);
    assert.ok(telemetry.vercel.computeMs >= 0);
    assert.ok(telemetry.vercel.elapsedMs >= 0);
    assert.equal(telemetry.vercel.warm, false);
    assert.equal((await services.guardianTelemetry()).vercel.warm, true);
    const before = state.calls.length;
    const denied = await routes[0].POST(
      new Request('https://example.test/api/guardian/broadcast', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'https://evil.example' },
        body: JSON.stringify({ active: false }),
      }),
    );
    assert.equal(denied.status, 403);
    assert.equal(state.calls.length, before);
    state.failDb = true;
    system.clearSystemSwitchCache();
    await assert.rejects(system.getSystemSwitches(), /interruptores/);
  } finally {
    hooks.deregister();
    Date.now = oldNow;
    if (prior === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = prior;
  }
});
