import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { sealDiscordCookie } from '../../src/domain/discord-oauth-cookie.ts';
test('Discord commands use public RLS queries and roles use only server-owned stats with protected OAuth', async () => {
  const fixture = `data:text/javascript,${encodeURIComponent(`
 import {AppError} from '@/lib/http';
 export const state={userId:'11111111-1111-4111-8111-111111111111',private:true,authenticated:true,cookies:new Map(),options:[],tables:[],ids:[]};
 function query(table,publicMode=false){let status=null;let selection='';const q={select(value){selection=value;return this;},gte(){return this;},lte(){return this;},eq(column,value){if(column==='status')status=value;if(column==='id'||column==='user_id'){state.ids.push(value);if(!publicMode&&value!==state.userId)throw Error('Wrong owner');}return this;},in(column,values){if(column==='status'&&JSON.stringify(values)!==JSON.stringify(['cleared','platinum']))throw Error('Wrong statuses');return this;},order(){return this;},ilike(){return this;},limit(){return this;},abortSignal(){return this;},maybeSingle(){return Promise.resolve({data:table==='profiles'?{id:state.userId,username:'player',level:14,equipped_title:'Insert Coin',library_private:state.private,terminal_status:'Ready to play'}:{id:'game-id',title:'Game',slug:'game-slug',cover_url:null,release_year:2026,genres:['RPG'],platforms:['PC']},error:null});},single(){return Promise.resolve({data:{username:'player',level:14},error:null});},then(success,failure){return Promise.resolve({data:selection==='username'?[{username:'player'}]:selection==='title'?[{title:'Game'}]:selection==='favorite_position,games(title)'?[{favorite_position:1,games:{title:'Favorite Game'}}]:[],error:null,count:status==='platinum'?1:status==='cleared'?2:3}).then(success,failure);}};return q;}
 export function publicClient(){return {from(table){state.tables.push(table);return query(table,true);}};}
 export async function authenticated(){if(!state.authenticated)throw new AppError('Unauthorized',401);return {user:{id:state.userId},db:{from(table){state.tables.push(table);return query(table);},auth:{async getUser(){return {data:{user:{id:state.userId,identities:[]}},error:null};}}}};}
 export async function cookies(){return {get(name){return state.cookies.has(name)?{value:state.cookies.get(name)}:undefined;},set(name,value,options){state.cookies.set(name,value);state.options.push(options);}};}
 `)}`;
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      if (specifier === 'server-only')
        return { url: 'data:text/javascript,export {};', shortCircuit: true };
      if (['@/lib/session', 'next/headers', '@/integrations/supabase/public'].includes(specifier))
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
          shortCircuit: true,
          source: stripTypeScriptTypes(readFileSync(fileURLToPath(url), 'utf8'), {
            mode: 'transform',
          }),
        };
      return next(url, context);
    },
  });
  const oldFetch = globalThis.fetch;
  const names = ['DISCORD_APPLICATION_ID', 'DISCORD_CLIENT_SECRET', 'NEXT_PUBLIC_APP_URL'];
  const previous = names.map((name) => process.env[name]);
  process.env.DISCORD_APPLICATION_ID = '1557446548982464652';
  process.env.DISCORD_CLIENT_SECRET = 'test-only-discord-secret';
  process.env.NEXT_PUBLIC_APP_URL = 'https://example.com';
  const sent: Record<string, unknown>[] = [];
  let calls = 0;
  try {
    const { state } = await import(fixture);
    const commands = await import('../../src/services/discord-interactions.ts');
    let result = await commands.discordCommandResponse({
      data: { name: 'perfil', options: [{ name: 'usuario', value: 'player' }] },
    });
    assert.match(result.data.embeds![0]!.description, /privada/);
    assert.deepEqual(state.tables, ['profiles']);
    state.private = false;
    state.tables = [];
    result = await commands.discordCommandResponse({
      data: { name: 'perfil', options: [{ name: 'usuario', value: 'player' }] },
    });
    assert.match(result.data.embeds![0]!.description, /3 Juegos/);
    assert.match(result.data.embeds![0]!.description, /2 Terminados/);
    assert.match(result.data.embeds![0]!.description, /1 Platinos/);
    assert.match(result.data.embeds![0]!.description, /Favorite Game/);
    assert.match(result.data.embeds![0]!.description, /Ready to play/);
    assert.deepEqual(state.tables, [
      'profiles',
      'user_games',
      'user_games',
      'user_games',
      'user_games',
    ]);
    result = await commands.discordCommandResponse({
      data: { name: 'juego', options: [{ name: 'titulo', value: 'Game' }] },
    });
    assert.match(result.data.components![0]!.components[0]!.url, /games\/game-slug$/);
    assert.match(result.data.embeds![0]!.description, /RPG/);
    assert.match(result.data.embeds![0]!.description, /PC/);
    assert.match(result.data.embeds![0]!.description, /3 jugadores/);
    assert.deepEqual(
      await commands.discordAutocompleteResponse({
        data: { name: 'perfil', options: [{ name: 'usuario', value: '@pla', focused: true }] },
      }),
      { type: 8, data: { choices: [{ name: 'player', value: 'player' }] } },
    );
    assert.deepEqual(
      await commands.discordAutocompleteResponse({
        data: { name: 'juego', options: [{ name: 'titulo', value: 'Gam', focused: true }] },
      }),
      { type: 8, data: { choices: [{ name: 'Game', value: 'Game' }] } },
    );
    assert.deepEqual(
      await commands.discordAutocompleteResponse({
        data: { name: 'juego', options: [{ name: 'titulo', value: 'Gam' }] },
      }),
      { type: 8, data: { choices: [] } },
    );
    assert.deepEqual(
      await commands.discordAutocompleteResponse({
        data: { name: 'juego', options: [{ name: 'titulo', value: '', focused: true }] },
      }),
      { type: 8, data: { choices: [] } },
    );
    assert.equal(result.data.flags, undefined);
    const deliveries: { method: string; url: string; body?: Record<string, unknown> }[] = [];
    globalThis.fetch = async (input, init) => {
      deliveries.push({
        method: String(init?.method),
        url: String(input),
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      });
      return new Response(null, { status: 204 });
    };
    for (const name of ['web', 'savestate', 'perfil', 'juego']) {
      const input = {
        token: 'test-token',
        data: {
          name,
          options: [
            { name: 'usuario', value: 'player' },
            { name: 'titulo', value: 'Game' },
          ],
        },
      };
      assert.equal((await commands.discordCommandResponse(input)).data.flags, undefined);
      await commands.finishDiscordInteraction(input);
      assert.equal(deliveries.at(-1)?.method, 'PATCH');
      assert.equal(deliveries.at(-1)?.body?.flags, undefined);
      assert.ok(deliveries.at(-1)?.body?.embeds);
    }
    deliveries.length = 0;
    const invalid = { token: 'test-token', data: { name: 'juego', options: [] } };
    assert.equal((await commands.discordCommandResponse(invalid)).data.flags, 64);
    await commands.finishDiscordInteraction(invalid);
    assert.deepEqual(
      deliveries.map((item) => item.method),
      ['PATCH', 'POST', 'DELETE'],
    );
    assert.equal(deliveries[0]?.body?.content, '\u200b');
    assert.equal(deliveries[1]?.body?.flags, 64);
    assert.equal(deliveries[2]?.body, undefined);
    globalThis.fetch = async (input, init) => {
      calls++;
      const url = String(input);
      if (url.endsWith('oauth2/token'))
        return Response.json({
          access_token: 'private-oauth-token',
          expires_in: 7200,
          scope: 'identify role_connections.write',
        });
      if (url.endsWith('users/@me')) return Response.json({ id: '222222222222222222' });
      assert.equal(init?.method, 'PUT');
      assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer private-oauth-token');
      sent.push(JSON.parse(String(init?.body)));
      return Response.json({});
    };
    const roles = await import('../../src/services/discord-roles.ts');
    const authorized = await roles.authorizeDiscordRoles();
    const authUrl = new URL(authorized.url);
    assert.equal(authUrl.searchParams.get('scope'), 'identify role_connections.write');
    assert.ok(state.options.at(-1).httpOnly);
    assert.equal(state.options.at(-1).sameSite, 'lax');
    assert.equal(state.options.at(-1).secure, true);
    await assert.rejects(
      roles.completeDiscordRoleAuthorization(
        new URL('https://example.com/api/discord/role-connection/callback?state=bad&code=test'),
      ),
      /caducó/,
    );
    assert.equal(calls, 0);
    const second = await roles.authorizeDiscordRoles();
    const nonce = new URL(second.url).searchParams.get('state');
    await roles.completeDiscordRoleAuthorization(
      new URL(`https://example.com/api/discord/role-connection/callback?state=${nonce}&code=test`),
    );
    assert.deepEqual(sent[0]?.metadata, { level: '14', completed_games: '3', platinum_games: '1' });
    assert.ok(
      !String(state.cookies.get('savestate_discord_role_token')).includes('private-oauth-token'),
    );
    const status = await roles.discordRoleStatus();
    assert.equal(status.connected, true);
    assert.ok(!JSON.stringify(status).includes('private-oauth-token'));
    const { POST } = await import('../../src/app/api/discord/role-connection/route.ts');
    const request = () =>
      new Request('https://example.com/api/discord/role-connection', {
        method: 'POST',
        headers: { origin: 'https://example.com', 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'sync',
          level: 99999,
          completed_games: 99999,
          platinum_games: 99999,
        }),
      });
    assert.equal((await POST(request())).status, 200);
    assert.deepEqual(sent.at(-1)?.metadata, {
      level: '14',
      completed_games: '3',
      platinum_games: '1',
    });
    state.cookies.set(
      'savestate_discord_role_token',
      sealDiscordCookie(
        { userId: 'other', expiresAt: Date.now() + 60000, accessToken: 'stolen-token' },
        'test-only-discord-secret',
      ),
    );
    const before = calls;
    assert.deepEqual(await roles.syncDiscordRoles(), { authorizeRequired: true });
    assert.equal(calls, before);
    state.authenticated = false;
    assert.equal((await POST(request())).status, 401);
  } finally {
    globalThis.fetch = oldFetch;
    names.forEach((name, index) => {
      const value = previous[index];
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    });
    hooks.deregister();
  }
});
