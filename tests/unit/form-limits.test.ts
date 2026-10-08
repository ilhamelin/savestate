import test from 'node:test';
import assert from 'node:assert/strict';
import { text, username, socialLinks } from '../../src/domain/validation.ts';
test('formularios: límites de perfil y Markdown se validan también en servidor', () => {
  assert.equal(username('a'.repeat(30)).length, 30);
  assert.throws(() => username('a'.repeat(31)));
  assert.equal(text('a'.repeat(160), 'Estado', 160, 0).length, 160);
  assert.throws(() => text('a'.repeat(161), 'Estado', 160, 0));
  assert.equal(text('a'.repeat(10000), 'Reseña', 10000).length, 10000);
  assert.throws(() => text('a'.repeat(10001), 'Reseña', 10000));
  assert.throws(() => socialLinks({ github: `https://github.com/${'a'.repeat(300)}` }));
  assert.equal(text('a'.repeat(1000), 'Nota', 1000, 0).length, 1000);
  assert.throws(() => text('a'.repeat(1001), 'Nota', 1000, 0));
});
