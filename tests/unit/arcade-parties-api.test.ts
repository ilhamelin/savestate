import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { PARTY_PLATFORMS, PARTY_STYLES, partyFeedFilters } from '../../src/domain/arcade.ts';

const fixtureUrl =
  'data:text/javascript,' +
  encodeURIComponent(`
import {AppError} from '@/lib/http';
export const state={user:null,rows:[],operations:[],inserts:[],games:[],profiles:[]};
const db={from(table){
 let action='select',data=null,filters=[],start=0,end=Infinity;
 const q={
  select(){return q;},delete(){action='delete';return q;},insert(value){action='insert';data=value;return q;},
  eq(key,value){filters.push(['eq',key,value]);return q;},
  gt(key,value){filters.push(['gt',key,value]);return q;},
  in(key,value){filters.push(['in',key,value]);return q;},
  order(){return q;},range(a,b){start=a;end=b;return q;},
  then(ok,fail){return Promise.resolve().then(()=>{
   state.operations.push({table,action,filters,start,end});
   if(action==='insert'){state.inserts.push(data);return{data:null,error:null};}
   const source=table==='party_requests'?state.rows:table==='games'?state.games:state.profiles;
   const matches=row=>filters.every(([kind,key,value])=>kind==='eq'?row[key]===value:kind==='gt'?row[key]>value:value.includes(row[key]));
   const rows=source.filter(matches);
   if(action==='delete'){state.rows=state.rows.filter(row=>!matches(row));return{data:rows.map(row=>({id:row.id})),error:null};}
   return{data:rows.slice(start,end+1),error:null};
  }).then(ok,fail);}
 };return q;
}};
export async function serverClient(){return db;}
export async function authenticated(){if(!state.user)throw new AppError('Inicia sesión',401);return{db,user:{id:state.user}};}
export async function currentUser(){return state.user?{id:state.user}:null;}
`);
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'server-only')
      return { url: 'data:text/javascript,export {};', shortCircuit: true };
    if (
      context.parentURL?.includes('/services/arcade.ts') &&
      ['@/lib/session', '@/integrations/supabase/server'].includes(specifier)
    )
      return { url: fixtureUrl, shortCircuit: true };
    if (specifier.startsWith('@/')) {
      const path = resolve('src', specifier.slice(2));
      return {
        url: pathToFileURL(existsSync(path + '.ts') ? path + '.ts' : path + '.tsx').href,
        shortCircuit: true,
      };
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith('file:') && url.endsWith('.ts') && !url.includes('node_modules'))
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
test.after(() => hooks.deregister());
const { state } = await import(fixtureUrl);
const { GET, POST } = await import('../../src/app/api/parties/route.ts');
const user = '00000000-0000-0000-0000-000000000001';
const game = '00000000-0000-0000-0000-000000000002';
const id = '00000000-0000-0000-0000-000000000003';
const input = {
  action: 'create',
  game_id: game,
  platform: 'PC',
  playstyle: 'casual',
  schedule: 'Viernes 21:00',
  contact_note: 'Discord: @player',
};
function reset() {
  Object.assign(state, {
    user: null,
    rows: [],
    operations: [],
    inserts: [],
    games: [{ id: game, title: 'Test Game', slug: 'test-game', cover_url: null }],
    profiles: [{ id: user, username: 'tester', level: 1, avatar_url: null }],
  });
}
function request(body: unknown, origin = 'https://savestate.test') {
  return new Request('https://savestate.test/api/parties', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify(body),
  });
}
function row(overrides = {}) {
  return {
    id,
    user_id: user,
    game_id: game,
    platform: 'PC',
    playstyle: 'casual',
    schedule: 'Hoy a las 21:00',
    contact_note: 'Discord @tester',
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 48 * 3600000).toISOString(),
    ...overrides,
  };
}
test('LFG filter contract accepts every supported platform/style and defaults to page one', () => {
  assert.equal(partyFeedFilters(new URLSearchParams()).page, 1);
  for (const platform of PARTY_PLATFORMS)
    for (const playstyle of PARTY_STYLES) {
      assert.deepEqual(partyFeedFilters(new URLSearchParams({ platform, playstyle, page: '2' })), {
        platform,
        playstyle,
        page: 2,
      });
    }
});
test('LFG GET rejects unknown/repeated filters and malformed or unbounded pagination before reading DB', async () => {
  reset();
  for (const query of [
    'platform=PS5',
    'playstyle=unknown',
    'page=0',
    'page=-1',
    'page=1.5',
    'page=NaN',
    'page=1e2',
    'page=',
    'page=10001',
    'page=9007199254740993',
    'platform=PC&platform=Xbox',
  ]) {
    const response = await GET(new Request('https://savestate.test/api/parties?' + query));
    assert.equal(response.status, 400, query);
    assert.match(response.headers.get('cache-control')!, /no-store/);
  }
  assert.equal(state.operations.length, 0);
});
test('LFG public GET filters exact platform/style, excludes expired rows and returns joined cards with no-store', async () => {
  reset();
  state.rows = [
    row(),
    row({ id: 'expired', expires_at: new Date(Date.now() - 1).toISOString() }),
    row({ id: 'xbox', platform: 'Xbox' }),
    row({ id: 'competitive', playstyle: 'competitive' }),
  ];
  const response = await GET(
    new Request('https://savestate.test/api/parties?platform=PC&playstyle=casual'),
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  const { data } = await response.json();
  assert.equal(data.items.length, 1);
  assert.equal(data.items[0].game.title, 'Test Game');
  assert.equal(data.items[0].author.username, 'tester');
  assert.equal(data.hasMore, false);
  assert.ok(
    state.operations[0].filters.some(
      ([kind, key]: string[]) => kind === 'gt' && key === 'expires_at',
    ),
  );
});
test('LFG GET pages by twelve using a lookahead and never repeats rows across pages', async () => {
  reset();
  state.rows = Array.from({ length: 15 }, (_, i) => row({ id: String(i) }));
  const first = (await (await GET(new Request('https://savestate.test/api/parties'))).json()).data;
  const second = (
    await (await GET(new Request('https://savestate.test/api/parties?page=2'))).json()
  ).data;
  assert.equal(first.items.length, 12);
  assert.equal(first.hasMore, true);
  assert.equal(second.items.length, 3);
  assert.equal(second.hasMore, false);
  assert.equal(
    new Set([...first.items, ...second.items].map((item: { id: string }) => item.id)).size,
    15,
  );
});
test('LFG POST requires a session for create and delete and enforces same origin', async () => {
  reset();
  assert.equal((await POST(request(input))).status, 401);
  assert.equal((await POST(request({ action: 'delete', id }))).status, 401);
  state.user = user;
  assert.equal((await POST(request(input, 'https://evil.test'))).status, 403);
  assert.equal(state.inserts.length, 0);
});
test('LFG POST validates UUID, style, platform and trimmed text bounds without writing invalid inputs', async () => {
  reset();
  state.user = user;
  for (const overrides of [
    { game_id: 'bad' },
    { platform: 'PS5' },
    { playstyle: 'bad' },
    { schedule: '  ' },
    { schedule: 'ab' },
    { schedule: 'x'.repeat(101) },
    { contact_note: 'ab' },
    { contact_note: 'x'.repeat(501) },
    { action: 'vote' },
  ]) {
    assert.equal((await POST(request({ ...input, ...overrides }))).status, 400);
  }
  assert.equal(state.inserts.length, 0);
});
test('LFG POST creates only server-owned fields and preserves plain text without executing markup', async () => {
  reset();
  state.user = user;
  const note = '<img src=x onerror=alert(1)>';
  const response = await POST(
    request({
      ...input,
      schedule: 'x'.repeat(100),
      contact_note: note,
      user_id: 'attacker',
      expires_at: '2099-01-01',
      created_at: '2099-01-01',
    }),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { data: { created: true } });
  assert.equal(state.inserts[0].user_id, user);
  assert.equal(state.inserts[0].contact_note, note);
  assert.ok(!('expires_at' in state.inserts[0]));
  assert.ok(!('created_at' in state.inserts[0]));
  assert.match(readFileSync('src/components/party-board.tsx', 'utf8'), /\{item\.contact_note\}/);
});
test('LFG POST accepts both inclusive text length limits', async () => {
  reset();
  state.user = user;
  for (const length of [3, 100])
    assert.equal((await POST(request({ ...input, schedule: 'x'.repeat(length) }))).status, 200);
  for (const length of [3, 500])
    assert.equal((await POST(request({ ...input, contact_note: 'x'.repeat(length) }))).status, 200);
});
test('LFG POST deletes only the author row; unknown, foreign and malformed IDs are safe', async () => {
  reset();
  state.user = '00000000-0000-0000-0000-000000000004';
  state.rows = [row()];
  assert.equal((await POST(request({ action: 'delete', id }))).status, 404);
  assert.equal(state.rows.length, 1);
  state.user = user;
  assert.equal((await POST(request({ action: 'delete', id: 'bad' }))).status, 400);
  assert.equal((await POST(request({ action: 'delete', id }))).status, 200);
  assert.equal(state.rows.length, 0);
  assert.equal((await POST(request({ action: 'delete', id }))).status, 404);
  const operation = state.operations.find(
    (operation: { action: string; filters: string[][] }) =>
      operation.action === 'delete' &&
      operation.filters.some((filter: string[]) => filter[1] === 'user_id' && filter[2] === user),
  );
  assert.ok(operation);
});
test('LFG route alias is permanent and navigation opens Arcade without changing the chat destination', () => {
  assert.match(readFileSync('src/app/parties/page.tsx', 'utf8'), /permanentRedirect\('\/arcade'\)/);
  assert.match(
    readFileSync('src/components/header-nav.tsx', 'utf8'),
    /href: '\/arcade', label: 'Arcade', icon: Gamepad2/,
  );
  assert.match(readFileSync('src/components/header-nav.tsx', 'utf8'), /href: '\/chat'/);
  const sql = readFileSync('supabase/migrations/202610070008_arcade_and_parties.sql', 'utf8');
  assert.match(sql, /expires_at > now\(\)/);
  assert.match(sql, /interval '48 hours'/);
  assert.match(sql, /using \(user_id = \(select auth.uid\(\)\)\)/);
});
