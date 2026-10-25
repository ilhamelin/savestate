/* global document, window, getComputedStyle */
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(
  pathToFileURL(process.env.RUNNER_TEMP + '/spec20-tools/node_modules/playwright/index.mjs').href
);
const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: 'reduce',
});
const failures = [];
page.on('pageerror', (error) => failures.push(error.message));
let allowed = false,
  offline = false,
  sequence = 0;
const sent = [];
const makeMessage = (n, content = 'Mensaje comunitario de prueba ' + n) => ({
  id: String(111111111111111100n + BigInt(n)),
  author: 'player' + n,
  authorId: '222222222222222222',
  avatar: null,
  content,
  createdAt: '2026-10-24T15:00:00Z',
  attachments: [],
});
let messages = Array.from({ length: 24 }, (_, i) => makeMessage(i));
messages[22] = makeMessage(
  22,
  '**[@tester en Savestate]:** 🎮 Portal (http://localhost:3000/games/portal)',
);
messages[23] = {
  ...makeMessage(23),
  replyTo: { id: messages[20].id, author: 'player20', excerpt: 'Una respuesta legible' },
};
const members = Array.from({ length: 50 }, (_, i) => ({
  id: String(i),
  username: 'Guardian' + i,
  status: i % 3 === 0 ? 'idle' : 'online',
  avatar: null,
  game: 'League of Legends',
}));
await page.route('**/api/**', async (route) => {
  const request = route.request(),
    url = new URL(request.url());
  const json = async (body) => route.fulfill({ json: body });
  if (url.pathname === '/api/discord/messages') {
    if (offline)
      return route.fulfill({ status: 503, json: { error: 'Relay temporalmente inaccesible' } });
    if (request.method() === 'POST') {
      const input = request.postDataJSON();
      sent.push(input);
      const message = makeMessage(100 + ++sequence, input.content);
      messages = [...messages, message];
      return json({ data: { message } });
    }
    const channel = url.searchParams.get('channel');
    return json({
      messages:
        channel === 'web-chat' || channel === 'chat-privado'
          ? messages
          : [makeMessage(80, 'Aviso oficial del canal ' + channel)],
      presence: { onlineCount: 50, members },
      viewerUsername: 'tester',
      privateChatAccess: { canRead: allowed, canSend: allowed, canAttach: allowed },
    });
  }
  if (url.pathname === '/api/discord/role-connection')
    return json({
      data: {
        username: 'tester',
        stats: { level: 20, completed_games: 9, platinum_games: 3 },
        connected: true,
        configured: true,
      },
    });
  if (url.pathname === '/api/discord/games')
    return json({ games: [{ id: '1', title: 'Portal', slug: 'portal' }] });
  return json({ data: {} });
});
await page.goto('http://localhost:3000/chat-design-qa', { waitUntil: 'domcontentloaded' });
await page.getByText(/LIVE SYNC/).waitFor();
assert.equal(await page.locator('.discord-tools-group button').count(), 5);
assert.equal(await page.locator('.discord-emoji-palette button').count(), 4);
assert.equal(await page.locator('.discord-channel-pill').count(), 3);
assert.equal(await page.locator('.discord-game-card-embed').count(), 1);
const submit = page.locator('.discord-send-action button');
assert.equal(await submit.isDisabled(), true);
const input = page.locator('.discord-advanced-composer textarea');
await input.fill('Primera línea');
await input.press('Shift+Enter');
await input.type('Segunda línea');
assert.match(await input.inputValue(), /\n/);
await input.press('Enter');
await page.waitForFunction(
  () => document.querySelector('.discord-advanced-composer textarea').value === '',
);
assert.equal(sent.length, 1);
assert.equal(sent[0].channel, 'web-chat');
assert.match(sent[0].content, /\n/);
await input.fill('No saltar cooldown');
await input.press('Enter');
assert.equal(sent.length, 1);
assert.equal(await submit.isDisabled(), true);
await page.waitForTimeout(3200);
await input.fill('');
await page.getByRole('button', { name: '🎮 Juego', exact: true }).click();
await page.getByLabel('Buscar en el catálogo local').fill('Portal');
await page.getByRole('button', { name: 'Portal ↗', exact: true }).click();
assert.match(await input.inputValue(), /🎮 Portal/);
await input.fill('');
await page.getByRole('button', { name: '@ Mencionar', exact: true }).first().click();
await page.locator('#discord-mention-options button').first().click();
assert.match(await input.inputValue(), /@/);
await input.fill('');
await page.locator('.discord-tools-group button').filter({ hasText: 'Pegar URL' }).click();
await page
  .getByLabel('URL de imagen/GIF o página de Tenor, Giphy o Imgur')
  .fill('https://tenor.com/es/view/orange-annoying-annoying-orange-orange');
await page.getByRole('button', { name: 'Adjuntar URL', exact: true }).click();
await page.getByText('🔗 Enlace de GIF listo para enviar ↗').waitFor();
await page.getByRole('button', { name: '✕ Quitar', exact: true }).click();
const list = page.locator('.discord-message-list');
await list.evaluate((el) => {
  el.scrollTop = 0;
});
messages = [...messages, makeMessage(60)];
await page.getByRole('button', { name: 'Sincronizar mensajes del canal' }).click();
await page.getByRole('button', { name: '↓ Nuevos mensajes' }).waitFor();
assert.ok((await list.evaluate((el) => el.scrollTop)) < 50);
await page.getByRole('button', { name: '↓ Nuevos mensajes' }).click();
await page.waitForTimeout(150);
assert.ok((await list.evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight)) < 4);
const sizes = [];
for (const [width, height] of [
  [1440, 1000],
  [1366, 768],
  [900, 1024],
  [768, 1024],
  [390, 844],
  [320, 740],
]) {
  await page.setViewportSize({ width, height });
  await page.waitForTimeout(80);
  const metrics = await page.evaluate(() => {
    const grid = document.querySelector('.discord-layout-grid'),
      chat = document.querySelector('.discord-chat'),
      list = document.querySelector('.discord-message-list'),
      composer = document.querySelector('.discord-advanced-composer'),
      presence = document.querySelector('.discord-presence-scroll');
    const box = (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom };
    };
    return {
      width: window.innerWidth,
      scroll: document.documentElement.scrollWidth,
      grid: box(grid),
      chat: box(chat),
      list: box(list),
      composer: box(composer),
      presence: box(presence),
      columns: getComputedStyle(grid).gridTemplateColumns,
    };
  });
  assert.ok(metrics.scroll <= width + 1, JSON.stringify(metrics));
  assert.ok(metrics.list.height > 100, JSON.stringify(metrics));
  assert.ok(metrics.composer.bottom <= metrics.chat.bottom + 1, JSON.stringify(metrics));
  assert.ok(metrics.presence.height <= 261, JSON.stringify(metrics));
  sizes.push(metrics);
  if (width === 1440 || width === 390)
    console.log(
      'SPEC20_' +
        (width === 1440 ? 'DESKTOP' : 'MOBILE') +
        '_JPEG:' +
        (
          await page.locator('.discord-layout-grid').screenshot({ type: 'jpeg', quality: 65 })
        ).toString('base64'),
    );
}
await page.setViewportSize({ width: 1440, height: 1000 });
await page.locator('.discord-channel-pill').filter({ hasText: '#💾-checkpoints' }).click();
await page.getByText('REGISTRO DE CHECKPOINTS', { exact: false }).last().waitFor();
assert.equal(await input.count(), 0);
allowed = true;
await page.getByRole('button', { name: 'Sincronizar mensajes del canal' }).click();
await page.locator('.discord-channel-pill').filter({ hasText: '#〘🕵〙chat-privado' }).waitFor();
await page.locator('.discord-channel-pill').filter({ hasText: '#〘🕵〙chat-privado' }).click();
await input.waitFor();
await input.fill('Privado autorizado');
await input.press('Enter');
await page.waitForFunction(
  () => document.querySelector('.discord-advanced-composer textarea').value === '',
);
assert.equal(sent.at(-1).channel, 'chat-privado');
await page.waitForTimeout(3200);
offline = true;
await page.getByRole('button', { name: 'Sincronizar mensajes del canal' }).click();
await page.getByText(/SYNC EN PAUSA/).waitFor();
await input.fill('No publicar sin relay');
assert.equal(await submit.isDisabled(), true);
await input.press('Enter');
assert.equal(sent.length, 2);
assert.deepEqual(failures, []);
console.log(
  'SPEC20_BROWSER_SUCCESS ' + JSON.stringify({ sizes, sent: sent.length, errors: failures }),
);
await browser.close();
