import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { MAX_BANNER_BYTES } from '../../src/domain/banner-media.ts';
test('Banner endpoint protects owner/origin, bounds files and signs direct uploads without disclosing service credentials', async () => {
  const fixture =
    'data:text/javascript,' +
    encodeURIComponent(
      `import {AppError} from '@/lib/http';export const state={authed:true,uploads:[],configs:[],signed:[]};const storage={async updateBucket(id,options){state.configs.push({id,options});return {error:null};},from(id){if(id!=='profiles')throw Error('Wrong bucket');return {getPublicUrl(path){return {data:{publicUrl:'https://project.supabase.co/storage/v1/object/public/profiles/'+path}};},async upload(path,file,options){state.uploads.push({path,size:file.size,options});return {error:null};},async createSignedUploadUrl(path,options){state.signed.push({path,options});return {data:{token:'scoped-test-token'},error:null};}};}};export function createClient(url,key){if(url!=='https://project.supabase.co'||key!=='test-only-service')throw Error('Unexpected configuration');return {storage};}export async function authenticated(){if(!state.authed)throw new AppError('Inicia sesión',401);return {user:{id:'owner'},db:{storage}};}export function publicEnv(){return {url:'https://project.supabase.co'};}`,
    );
  const hooks = registerHooks({
    resolve(s, c, next) {
      if (['@/lib/session', '@/lib/env', '@supabase/supabase-js'].includes(s))
        return { url: fixture, shortCircuit: true };
      if (s.startsWith('@/'))
        return { url: pathToFileURL(resolve('src', s.slice(2) + '.ts')).href, shortCircuit: true };
      return next(s, c);
    },
    load(url, c, next) {
      if (url.startsWith('file:') && url.endsWith('.ts'))
        return {
          format: 'module',
          shortCircuit: true,
          source: stripTypeScriptTypes(readFileSync(fileURLToPath(url), 'utf8'), {
            mode: 'transform',
          }),
        };
      return next(url, c);
    },
  });
  const previous = process.env.SUPABASE_SERVICE_ROLE_KEY,
    previousApp = process.env.NEXT_PUBLIC_APP_URL;
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only-service';
  process.env.NEXT_PUBLIC_APP_URL = 'https://example.com';
  try {
    const { state } = await import(fixture);
    const { POST } = await import('../../src/app/api/profile/banner/route.ts');
    const json = (data: unknown, origin = 'https://example.com') =>
      new Request('https://example.com/api/profile/banner', {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    assert.equal(
      (
        await POST(
          json(
            { action: 'prepare', contentType: 'video/mp4', size: MAX_BANNER_BYTES },
            'https://evil.test',
          ),
        )
      ).status,
      403,
    );
    state.authed = false;
    assert.equal(
      (await POST(json({ action: 'prepare', contentType: 'video/mp4', size: 1 }))).status,
      401,
    );
    state.authed = true;
    for (const data of [
      { action: 'prepare', contentType: 'image/svg+xml', size: 2 },
      { action: 'prepare', contentType: 'video/mp4', size: MAX_BANNER_BYTES + 1 },
      { action: 'prepare', contentType: 'constructor', size: 1 },
    ])
      assert.equal((await POST(json(data))).status, 400);
    assert.equal(state.configs.length, 0);
    const signed = await POST(
      json({
        action: 'prepare',
        contentType: 'video/mp4',
        size: MAX_BANNER_BYTES,
        userId: 'other',
        path: 'other/banner.mp4',
      }),
    );
    assert.equal(signed.status, 200);
    const result = await signed.json();
    assert.equal(result.path, 'owner/banner.mp4');
    assert.equal(result.token, 'scoped-test-token');
    assert.equal(JSON.stringify(result).includes('test-only-service'), false);
    assert.deepEqual(state.signed, [{ path: 'owner/banner.mp4', options: { upsert: true } }]);
    assert.equal(state.configs[0].options.fileSizeLimit, MAX_BANNER_BYTES);
    assert.equal(state.configs[0].options.allowedMimeTypes.length, 8);
    const form = new FormData();
    form.set('file', new File(['GIF89a'], 'banner.gif', { type: 'image/gif' }));
    const uploaded = await POST(
      new Request('https://example.com/api/profile/banner', {
        method: 'POST',
        headers: { Origin: 'https://example.com' },
        body: form,
      }),
    );
    assert.equal(uploaded.status, 200);
    assert.equal((await uploaded.json()).path, 'owner/banner.gif');
    assert.equal(state.uploads[0].options.contentType, 'image/gif');
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const direct = await POST(json({ action: 'prepare', contentType: 'image/avif', size: 100 }));
    assert.equal(direct.status, 200);
    assert.equal(state.configs.length, 2);
  } finally {
    if (previous === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previous;
    if (previousApp === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = previousApp;
    hooks.deregister();
  }
});
test('Banner preparation preserves animations byte-for-byte and large client uploads bypass the function body limit', async () => {
  const hooks = registerHooks({
    resolve(s, c, next) {
      if (s.startsWith('@/'))
        return { url: pathToFileURL(resolve('src', s.slice(2) + '.ts')).href, shortCircuit: true };
      return next(s, c);
    },
    load(url, c, next) {
      if (url.startsWith('file:') && url.endsWith('.ts'))
        return {
          format: 'module',
          shortCircuit: true,
          source: stripTypeScriptTypes(readFileSync(fileURLToPath(url), 'utf8'), {
            mode: 'transform',
          }),
        };
      return next(url, c);
    },
  });
  const oldFetch = globalThis.fetch;
  try {
    const { profileImage } = await import('../../src/lib/profile-image.ts');
    for (const mime of ['image/gif', 'image/apng', 'image/avif', 'video/webm', 'video/mp4']) {
      const file = new File(['original animation bytes'], 'banner', { type: mime });
      const blob = await profileImage(file, 'banner');
      assert.equal(blob.type, mime);
      assert.deepEqual(
        new Uint8Array(await blob.arrayBuffer()),
        new Uint8Array(await file.arrayBuffer()),
      );
    }
    const bytes = new Uint8Array(32);
    bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
    bytes.set(new TextEncoder().encode('acTL'), 12);
    const apng = await profileImage(
      new File([bytes], 'banner.png', { type: 'image/png' }),
      'banner',
    );
    assert.equal(apng.type, 'image/apng');
    const delayed = new Uint8Array(5044);
    delayed.set([137, 80, 78, 71, 13, 10, 26, 10]);
    delayed.set(new TextEncoder().encode('IHDR'), 12);
    new DataView(delayed.buffer).setUint32(20, 5000);
    delayed.set(new TextEncoder().encode('tEXt'), 24);
    delayed.set(new TextEncoder().encode('acTL'), 5036);
    const preserved = await profileImage(
      new File([delayed], 'delayed.png', { type: 'image/png' }),
      'banner',
    );
    assert.equal(preserved.type, 'image/apng');
    assert.deepEqual(new Uint8Array(await preserved.arrayBuffer()), delayed);
    await assert.rejects(
      profileImage(new File(['svg'], 'banner.svg', { type: 'image/svg+xml' }), 'banner'),
    );
    const { uploadProfileBanner } = await import('../../src/lib/banner-upload.ts');
    const sent: unknown[] = [];
    const db = {
      storage: {
        from() {
          return {
            async uploadToSignedUrl(path: string, token: string, blob: Blob, options: unknown) {
              sent.push({ path, token, size: blob.size, options });
              return { error: null };
            },
            async upload() {
              throw Error('Unexpected direct fallback');
            },
          };
        },
      },
    };
    globalThis.fetch = async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      assert.equal(body.action, 'prepare');
      assert.equal(body.size, MAX_BANNER_BYTES);
      return Response.json({
        url: 'https://project.supabase.co/storage/v1/object/public/profiles/owner/banner.mp4?v=1',
        path: 'owner/banner.mp4',
        contentType: 'video/mp4',
        token: 'scoped-test-token',
      });
    };
    await uploadProfileBanner(
      db as never,
      'owner',
      new Blob([new Uint8Array(MAX_BANNER_BYTES)], { type: 'video/mp4' }),
    );
    assert.equal(sent.length, 1);
    globalThis.fetch = async () => Response.json({ error: 'No autorizado' }, { status: 401 });
    await assert.rejects(
      uploadProfileBanner(db as never, 'owner', new Blob(['gif'], { type: 'image/gif' })),
      /No autorizado/,
    );
  } finally {
    globalThis.fetch = oldFetch;
    hooks.deregister();
  }
});
