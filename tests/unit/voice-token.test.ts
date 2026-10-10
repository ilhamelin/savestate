import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { TokenVerifier } from 'livekit-server-sdk';

test('voice tokens require a session and same-origin request, enforce capacity and grant audio only to the authenticated identity', async () => {
  const state = {
    authenticated: false,
    fail: false,
    capacity: null as number | null,
    calls: [] as { name: string; maxParticipants: number }[],
    profile: {
      id: '12345678-1234-4234-8234-123456789abc',
      username: 'real_player',
      avatar_url: null,
    },
  };
  const shared = globalThis as typeof globalThis & { __voiceTest?: typeof state };
  shared.__voiceTest = state;
  const sdk = pathToFileURL(resolve('node_modules/livekit-server-sdk/dist/index.js')).href;
  const http = pathToFileURL(resolve('src/lib/http.ts')).href;
  const hooks = registerHooks({
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
    resolve(specifier, context, next) {
      let source: string | undefined;
      if (specifier === 'server-only') source = 'export {};';
      if (specifier === 'livekit-server-sdk')
        source = `export {AccessToken, TrackSource} from ${JSON.stringify(sdk)}; export class RoomServiceClient { async createRoom(options) { const s=globalThis.__voiceTest;s.calls.push(options);if(s.fail)throw new Error('upstream unavailable');return {maxParticipants:s.capacity??options.maxParticipants}; } }`;
      if (specifier === '@/lib/session')
        source = `import {AppError} from ${JSON.stringify(http)};export async function authenticated(){const s=globalThis.__voiceTest;if(!s.authenticated)throw new AppError('Inicia sesión.',401);const query={select(){return this},eq(){return this},async single(){return {data:s.profile,error:null}}};return {user:{id:s.profile.id},db:{from(){return query}}}}`;
      if (source)
        return { url: 'data:text/javascript,' + encodeURIComponent(source), shortCircuit: true };
      if (specifier.startsWith('@/'))
        return {
          url: pathToFileURL(resolve('src', specifier.slice(2) + '.ts')).href,
          shortCircuit: true,
        };
      return next(specifier, context);
    },
  });
  const names = ['LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET', 'NEXT_PUBLIC_APP_URL'];
  const previous = names.map((name) => process.env[name]);
  try {
    process.env.LIVEKIT_URL = 'wss://voice.example.test';
    process.env.LIVEKIT_API_KEY = 'test_key';
    process.env.LIVEKIT_API_SECRET = 'test_secret_for_unit_tests_only_32';
    process.env.NEXT_PUBLIC_APP_URL = 'https://savestate.test';
    const { POST } = await import('../../src/app/api/voice/token/route.ts');
    const request = (input: unknown, origin = 'https://savestate.test') =>
      new Request('https://savestate.test/api/voice/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: origin },
        body: JSON.stringify(input),
      });
    assert.equal((await POST(request({ channelId: 'ch-lobby' }))).status, 401);
    assert.equal(state.calls.length, 0);
    state.authenticated = true;
    assert.equal((await POST(request({ channelId: 'ch-lobby' }, 'https://evil.test'))).status, 403);
    assert.equal((await POST(request({ channelId: 'arbitrary-room' }))).status, 400);
    assert.equal(state.calls.length, 0);
    const response = await POST(
      request({ channelId: 'ch-squad', identity: 'attacker', username: 'attacker' }),
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    const data = (await response.json()) as { token: string; url: string };
    const verified = await new TokenVerifier(
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
    ).verify(data.token);
    assert.equal(data.url, 'wss://voice.example.test');
    assert.equal(verified.sub, state.profile.id);
    assert.equal(verified.name, state.profile.username);
    assert.equal(verified.video?.room, 'ch-squad');
    assert.equal(verified.video?.roomJoin, true);
    assert.deepEqual(verified.video?.canPublishSources, ['microphone']);
    assert.equal(verified.video?.canSubscribe, true);
    assert.equal(verified.video?.canPublishData, true);
    assert.equal(verified.video?.canUpdateOwnMetadata, false);
    assert.equal(verified.video?.roomAdmin, undefined);
    assert.equal(verified.video?.roomCreate, undefined);
    assert.ok(verified.exp && verified.exp <= Math.floor(Date.now() / 1000) + 901);
    assert.deepEqual(
      state.calls.map(({ name, maxParticipants }) => ({ name, maxParticipants })),
      [{ name: 'ch-squad', maxParticipants: 6 }],
    );
    state.capacity = 0;
    assert.equal((await POST(request({ channelId: 'ch-lobby' }))).status, 503);
    state.capacity = null;
    state.fail = true;
    assert.equal((await POST(request({ channelId: 'ch-chill' }))).status, 503);
    state.fail = false;
    delete process.env.LIVEKIT_API_SECRET;
    const count = state.calls.length;
    assert.equal((await POST(request({ channelId: 'ch-lobby' }))).status, 503);
    assert.equal(state.calls.length, count);
  } finally {
    hooks.deregister();
    delete shared.__voiceTest;
    names.forEach((name, index) => {
      if (previous[index] === undefined) delete process.env[name];
      else process.env[name] = previous[index];
    });
  }
});
