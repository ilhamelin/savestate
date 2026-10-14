import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

test('Identity linking callback exchanges PKCE code and honors only safe local next destinations', async () => {
  const fixture = `data:text/javascript,${encodeURIComponent(`
    export const state={code:null,error:false};
    export const NextResponse={redirect(url){return Response.redirect(url)}};
    export function appUrl(){return 'https://savestate.example'};
    export async function serverClient(){return {auth:{async exchangeCodeForSession(code){state.code=code;return {error:state.error?new Error('Invalid code'):null}}}}};
  `)}`;
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      if (['next/server', '@/integrations/supabase/server', '@/lib/env'].includes(specifier))
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
  try {
    const { GET } = await import('../../src/app/auth/callback/route.ts');
    const { state } = await import(fixture);
    for (const next of ['/settings', '/chat']) {
      const response = await GET(
        new Request(
          `https://savestate.example/auth/callback?code=pkce-link&next=${encodeURIComponent(next)}`,
        ),
      );
      assert.equal(response.headers.get('location'), `https://savestate.example${next}`);
      assert.equal(state.code, 'pkce-link');
    }
    const unsafe = await GET(
      new Request(
        'https://savestate.example/auth/callback?code=pkce-link&next=https://evil.example',
      ),
    );
    assert.equal(unsafe.headers.get('location'), 'https://savestate.example/library');
    state.error = true;
    const failed = await GET(
      new Request('https://savestate.example/auth/callback?code=invalid&next=/settings'),
    );
    assert.equal(failed.headers.get('location'), 'https://savestate.example/login?error=callback');
  } finally {
    hooks.deregister();
  }
});
