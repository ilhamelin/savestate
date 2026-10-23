import test from 'node:test';
import assert from 'node:assert/strict';
import config from '../../next.config.ts';
test('Legacy Discord stays in Chat while Arcade and LFG redirect permanently to the Forum hub', async () => {
  const redirects = await config.redirects!();
  for (const [source, destination] of [
    ['/community/discord', '/chat'],
    ['/parties', '/forum?tab=arcade'],
    ['/arcade', '/forum?tab=arcade'],
  ]) {
    assert.ok(
      redirects.some(
        (rule) => rule.source === source && rule.destination === destination && rule.permanent === true,
      ),
    );
  }
  assert.ok(!redirects.some((rule) => rule.source.startsWith('/api/discord')));
});
