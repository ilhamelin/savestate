import test from 'node:test';
import assert from 'node:assert/strict';
const base = process.env.TEST_APP_URL;
if (base && !['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname))
  throw new Error('Usa un servidor local de pruebas.');
test('HTTP: catálogo sin configurar no inventa datos y no se cachea', { skip: !base }, async () => {
  const response = await fetch(`${base}/api/catalogue`);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.source, 'unconfigured');
  assert.deepEqual(data.games, []);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});
test('HTTP: valida filtros y bloquea mutaciones de otro origen', { skip: !base }, async () => {
  assert.equal((await fetch(`${base}/api/catalogue?year=NaN`)).status, 400);
  const response = await fetch(`${base}/api/library`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://evil.test' },
    body: '{}',
  });
  assert.equal(response.status, 403);
  const own = await fetch(`${base}/api/library`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: base! },
    body: '{"action":"save"}',
  });
  assert.equal(own.status, 401);
  const large = await fetch(`${base}/api/library`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: base! },
    body: JSON.stringify({ content: 'a'.repeat(25000) }),
  });
  assert.equal(large.status, 413);
  const invalid = await fetch(`${base}/api/library`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: base! },
    body: '{',
  });
  assert.equal(invalid.status, 400);
});
test(
  'HTTP: CSP con nonce, cabeceras seguras y páginas privadas sin caché compartida',
  { skip: !base },
  async () => {
    const response = await fetch(base!);
    assert.equal(response.status, 200);
    assert.match(
      response.headers.get('content-security-policy') ?? '',
      /script-src 'self' 'nonce-/,
    );
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.match(await response.text(), /Cada juego/);
  },
);
