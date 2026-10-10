import test from 'node:test';
import assert from 'node:assert/strict';
const base = process.env.TEST_APP_URL;
if (base && !['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname))
  throw new Error('Usa un servidor local de pruebas.');
test('HTTP: cabeceras del proxy en páginas y errores API', { skip: !base }, async () => {
  for (const [path, status] of [
    ['/', 200],
    ['/api/catalogue?year=NaN', 400],
  ] as const) {
    const response = await fetch(`${base}${path}`);
    assert.equal(response.status, status);
    assert.equal(
      response.headers.get('permissions-policy'),
      'camera=(), microphone=(self), geolocation=()',
    );
    assert.equal(response.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
    assert.equal(response.headers.get('x-frame-options'), 'DENY');
    assert.match(response.headers.get('content-security-policy') ?? '', /nonce-/);
  }
});
