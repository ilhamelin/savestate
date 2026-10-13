import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
test('Discord route verifies signatures before commands and defers database work without reading a session', async () => {
  const fixture = `data:text/javascript,${encodeURIComponent(`export const state={after:[],calls:[]};export function after(fn){state.after.push(fn);}export async function discordAutocompleteResponse(){state.calls.push('autocomplete');return {type:8,data:{choices:[{name:'player',value:'player'}]}};}export async function discordCommandResponse(){state.calls.push('response');return {type:4,data:{content:'web'}};}export function interactionCommand(input){return {name:input.data?.name};}export async function finishDiscordInteraction(){state.calls.push('finish');}`)}`;
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      if (specifier === 'next/server' || specifier === '@/services/discord-interactions')
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
  const previousKey = process.env.DISCORD_PUBLIC_KEY,
    previousId = process.env.DISCORD_APPLICATION_ID;
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  process.env.DISCORD_PUBLIC_KEY = publicKey
    .export({ format: 'der', type: 'spki' })
    .subarray(-32)
    .toString('hex');
  process.env.DISCORD_APPLICATION_ID = '1557446548982464652';
  try {
    const { POST } = await import('../../src/app/api/discord/interactions/route.ts');
    const { state } = await import(fixture);
    const request = (
      payload: unknown,
      timestamp = String(Math.floor(Date.now() / 1000)),
      tamper = false,
    ) => {
      const raw = JSON.stringify(payload);
      return new Request('http://localhost/api/discord/interactions', {
        method: 'POST',
        body: tamper ? raw + ' ' : raw,
        headers: {
          'X-Signature-Ed25519': sign(null, Buffer.from(timestamp + raw), privateKey).toString(
            'hex',
          ),
          'X-Signature-Timestamp': timestamp,
        },
      });
    };
    assert.deepEqual(await (await POST(request({ type: 1 }))).json(), { type: 1 });
    assert.equal((await POST(request({ type: 1 }, undefined, true))).status, 401);
    // Discord validation may use synthetic timestamps; authenticate the signed payload.
    assert.deepEqual(await (await POST(request({ type: 1 }, '1700000000'))).json(), { type: 1 });
    assert.equal((await POST(request({ type: 1 }, '1700000000', true))).status, 401);
    assert.deepEqual(
      await (await POST(request({ type: 1, application_id: 'different' }, 'synthetic'))).json(),
      { type: 1 },
    );
    assert.equal((await POST(request({ type: 1 }, 'synthetic', true))).status, 401);
    assert.equal((await POST(request({ type: 1 }, 'x'.repeat(65)))).status, 401);
    assert.equal((await POST(request({ type: 1 }, ''))).status, 401);
    assert.equal(state.calls.length, 0);
    process.env.DISCORD_PUBLIC_KEY = ` ${process.env.DISCORD_PUBLIC_KEY} `;
    process.env.DISCORD_APPLICATION_ID = '';
    assert.deepEqual(
      (
        await (
          await POST(
            request({
              type: 2,
              application_id: '1557446548982464652',
              data: { name: 'web' },
            }),
          )
        ).json()
      ).type,
      4,
    );
    assert.deepEqual(
      await (
        await POST(
          request({
            type: 2,
            application_id: '1557446548982464652',
            token: 'safe-token',
            data: { name: 'perfil' },
          }),
        )
      ).json(),
      { type: 5 },
    );
    assert.equal(state.after.length, 1);
    assert.ok(!state.calls.includes('finish'));
    await state.after[0]();
    assert.ok(state.calls.includes('finish'));
    assert.deepEqual(
      await (
        await POST(
          request({
            type: 4,
            application_id: '1557446548982464652',
            data: { name: 'perfil', options: [{ name: 'usuario', value: 'pla', focused: true }] },
          }),
        )
      ).json(),
      { type: 8, data: { choices: [{ name: 'player', value: 'player' }] } },
    );
    assert.equal(state.after.length, 1);
    assert.ok(state.calls.includes('autocomplete'));
    for (const name of ['gratis', 'valorant', 'lol', 'genshin']) {
      assert.deepEqual(
        await (
          await POST(
            request({
              type: 2,
              application_id: '1557446548982464652',
              token: 'safe-token',
              data: { name },
            }),
          )
        ).json(),
        { type: 5 },
      );
    }
    assert.equal(state.after.length, 5);
    assert.equal(
      (await POST(request({ type: 2, application_id: 'different', data: { name: 'web' } }))).status,
      401,
    );
  } finally {
    if (previousKey === undefined) delete process.env.DISCORD_PUBLIC_KEY;
    else process.env.DISCORD_PUBLIC_KEY = previousKey;
    if (previousId === undefined) delete process.env.DISCORD_APPLICATION_ID;
    else process.env.DISCORD_APPLICATION_ID = previousId;
    hooks.deregister();
  }
});
