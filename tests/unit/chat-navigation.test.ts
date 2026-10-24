import test from 'node:test';
import assert from 'node:assert/strict';
import config from '../../next.config.ts';
test('Legacy Discord stays in Chat while Arcade and LFG redirect permanently to La Taberna', async () => {
  const redirects = await config.redirects!();
  for (const [source, destination] of [
    ['/community/discord', '/chat'],
    ['/parties', '/tavern?tab=arcade'],
    ['/arcade', '/tavern?tab=arcade'],
  ]) {
    assert.ok(
      redirects.some(
        (rule) =>
          rule.source === source && rule.destination === destination && rule.permanent === true,
      ),
    );
  }
  assert.ok(!redirects.some((rule) => rule.source.startsWith('/api/discord')));
});
