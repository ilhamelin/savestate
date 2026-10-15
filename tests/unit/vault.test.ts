import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateVaultFile,
  vaultHasSpace,
  vaultCapacity,
  VAULT_QUOTA_BYTES,
  safeVaultMediaUrl,
  VAULT_PUBLIC_ORIGIN,
} from '../../src/domain/vault.ts';
import { safeChatMediaUrl } from '../../src/domain/global-chat.ts';
import { discordComposerPayload, discordInlineMedia } from '../../src/domain/discord-client.ts';
const owner = '11111111-1111-4111-8111-111111111111';
const key = `${owner}/22222222-2222-4222-8222-222222222222-clip.mp4`;
test('Vault accepts only supported MIME types and positive integral sizes within quota', () => {
  for (const mime of [
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/webm',
  ])
    assert.equal(validateVaultFile('captura.png', 1024, mime).mimeType, mime);
  for (const size of [0, -1, 1.5, NaN, Infinity, VAULT_QUOTA_BYTES + 1, '20'])
    assert.throws(() => validateVaultFile('a.png', size, 'image/png'));
  for (const mime of [
    'image/svg+xml',
    'text/html',
    'application/javascript',
    'video/avi',
    '__proto__',
  ])
    assert.throws(() => validateVaultFile('a', 1, mime));
  assert.equal(
    validateVaultFile('../../mi captura.html', 12, 'image/png').fileName,
    'mi-captura.png',
  );
  assert.throws(() => validateVaultFile('', 12, 'image/png'));
});
test('Vault quota includes pending reservations, permits exact fit and blocks overflow', () => {
  const storage = { used_bytes: 50, reserved_bytes: 20, quota_bytes: 100 };
  assert.equal(vaultHasSpace(storage, 30), true);
  assert.equal(vaultHasSpace(storage, 31), false);
  assert.equal(vaultHasSpace(storage, 0), false);
  assert.equal(vaultHasSpace(storage, Infinity), false);
  for (const [used, state] of [
    [0, 'nominal'],
    [69, 'nominal'],
    [70, 'warning'],
    [89, 'warning'],
    [90, 'critical'],
    [100, 'full'],
  ] as const)
    assert.equal(
      vaultCapacity({ used_bytes: used, reserved_bytes: 0, quota_bytes: 100 }).state,
      state,
    );
  assert.equal(
    vaultCapacity({ used_bytes: 90, reserved_bytes: 10, quota_bytes: 100 }).state,
    'full',
  );
});
test('Vault URLs require exact public origin, canonical owner key and safe media extension', () => {
  const url = `${VAULT_PUBLIC_ORIGIN}/${key}`;
  assert.equal(safeVaultMediaUrl(url), url);
  for (const candidate of [
    url.replace('https:', 'http:'),
    url.replace('.r2.dev', '.r2.dev.evil.test'),
    url + '?x=1',
    url.replace('.mp4', '.svg'),
    url.replace(owner, '..'),
  ])
    assert.equal(safeVaultMediaUrl(candidate), null);
  assert.equal(safeChatMediaUrl(url, undefined, owner), url);
  assert.equal(safeChatMediaUrl(url, undefined, 'other-owner'), null);
  assert.equal(discordComposerPayload('', url, undefined, owner).mediaUrl, url);
  assert.deepEqual(discordInlineMedia(`Clip ${url}`), { text: 'Clip', urls: [url] });
});
