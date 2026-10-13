import test from 'node:test';
import assert from 'node:assert/strict';
import { registerDiscordApplication } from '../../src/integrations/discord/application.ts';
test('Discord registration verifies the bot application and preserves unrelated commands and metadata', async () => {
  const original = globalThis.fetch,
    calls: { url: string; method: string; body: unknown }[] = [];
  let wrong = false;
  globalThis.fetch = async (input, init) => {
    const url = String(input),
      method = init?.method ?? 'GET';
    calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : null });
    if (url.endsWith('/oauth2/applications/@me'))
      return Response.json({ id: wrong ? '999999999999999999' : '1557446548982464652' });
    if (method === 'PUT') return Response.json([]);
    if (url.endsWith('/commands'))
      return Response.json([
        { id: 'existing', name: 'existing', description: 'Keep me', type: 1 },
        { id: 'old', name: 'web', description: 'Old', type: 1 },
      ]);
    return Response.json([{ key: 'legacy', type: 2, name: 'Legacy', description: 'Keep me' }]);
  };
  try {
    const result = await registerDiscordApplication('1557446548982464652', 'test-token');
    assert.equal(result.commands, 9);
    assert.equal(result.metadata, 4);
    const commandPut = calls.find(
      (call) => call.method === 'PUT' && call.url.endsWith('/commands'),
    )!;
    assert.ok(
      (commandPut.body as { name: string }[]).some((command) => command.name === 'existing'),
    );
    calls.length = 0;
    wrong = true;
    await assert.rejects(
      registerDiscordApplication('1557446548982464652', 'test-token'),
      /no corresponde/,
    );
    assert.ok(calls.every((call) => call.method === 'GET'));
  } finally {
    globalThis.fetch = original;
  }
});
