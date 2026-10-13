import test from 'node:test';
import assert from 'node:assert/strict';
import config from '../../next.config.ts';
test('Legacy community and parties routes redirect permanently to the unified chat', async () => {
  const redirects = await config.redirects!();
  for (const source of ['/parties', '/community/discord']) {
    assert.ok(
      redirects.some(
        (rule) => rule.source === source && rule.destination === '/chat' && rule.permanent === true,
      ),
    );
  }
  assert.ok(!redirects.some((rule) => rule.source.startsWith('/api/discord')));
});
