import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

test('Offline access endpoint verifies the session and never emits cacheable account data', async () => {
  const fixture =
    'data:text/javascript,' +
    encodeURIComponent(`
    export const state = { allowed: false, calls: 0 };
    export async function authenticated() {
      state.calls++;
      if (!state.allowed) throw new Error('Unauthorized');
      return { user: { id: '11111111-1111-4111-8111-111111111111' } };
    }
    export const errorResponse = () => Response.json({error:'Unauthorized'}, {status:401});
  `);
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      if (specifier === '@/lib/session' || specifier === '@/lib/http')
        return { url: fixture, shortCircuit: true };
      return next(specifier, context);
    },
  });
  try {
    const { state } = await import(fixture);
    const { GET } = await import('../../src/app/api/library/offline-access/route.ts');
    assert.equal((await GET()).status, 401);
    state.allowed = true;
    const response = await GET();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
    assert.deepEqual(await response.json(), { userId: '11111111-1111-4111-8111-111111111111' });
    assert.equal(state.calls, 2);
  } finally {
    hooks.deregister();
  }
});
