import test from 'node:test';
import assert from 'node:assert/strict';
import { crtPalette, CRT_PALETTES } from '../../src/domain/crt.ts';
test('CRT palettes accept only supported stored values and safely fall back to cyan', () => {
  for (const key of Object.keys(CRT_PALETTES)) assert.equal(crtPalette(key), key);
  for (const value of [null, undefined, '', 'pink', 'constructor', '__proto__', {}, 1])
    assert.equal(crtPalette(value), 'cyan');
});
