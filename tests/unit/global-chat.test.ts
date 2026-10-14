import '../../src/domain/global-chat.test.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  safeChatMediaUrl,
  chatMediaPageUrl,
  validateChatMessagePayload,
} from '../../src/domain/global-chat.ts';
import {
  discordComposerPayload,
  discordInlineMedia,
  normalizedDiscordMessages,
} from '../../src/domain/discord-client.ts';

test('Chat accepts official GIF pages in the composer without treating HTML pages as images', () => {
  const pages = [
    'https://tenor.com/es/view/orange-annoying-annoying-orange-orange',
    'https://tenor.com/view/example-123',
    'https://www.tenor.com/es/view/example-123',
    'https://giphy.com/gifs/funny-cat',
    'https://www.giphy.com/gifs/funny-cat',
    'https://imgur.com/gallery/example',
    'https://imgur.com/a/example',
  ];
  for (const url of pages) {
    assert.equal(safeChatMediaUrl(url), url);
    assert.equal(chatMediaPageUrl(url), url);
    assert.equal(discordComposerPayload('', url).mediaUrl, url);
    assert.equal(
      validateChatMessagePayload({ mediaUrl: url }, '11111111-1111-4111-8111-111111111111')
        .media_url,
      url,
    );
    assert.deepEqual(discordInlineMedia(`Mira ${url}`), { text: 'Mira', urls: [url] });
  }
  for (const url of [
    'https://i.imgur.com/example.gif',
    'https://media.tenor.com/example/tenor.gif',
    'https://i.giphy.com/example.webp',
    'https://cdn.discordapp.com/attachments/a.jpg?sig=123',
    'https://media.discordapp.net/attachments/a.png',
  ]) {
    assert.equal(safeChatMediaUrl(url), url);
    assert.equal(chatMediaPageUrl(url), null);
  }
});
test('GIF page domains cannot bypass HTTPS, credentials, port, unsafe format or lookalike protections', () => {
  for (const url of [
    'http://tenor.com/es/view/example',
    'https://tenor.com.evil.example/es/view/example',
    'https://giphy.com.evil.example/gifs/funny-cat',
    'https://evilgiphy.com/gifs/funny-cat',
    'https://imgur.com.evil.example/gallery/a',
    'https://tenor.com@evil.example/view/a',
    'https://user@tenor.com/view/a',
    'https://giphy.com:8443/gifs/a',
    'https://i.imgur.com/a.svg',
    'https://media.tenor.com/a.svg',
    'javascript:alert(1)',
  ]) {
    assert.equal(safeChatMediaUrl(url), null);
    assert.equal(chatMediaPageUrl(url), null);
    assert.throws(() => discordComposerPayload('', url));
  }
});
test('Discord GIF pages retain their URL and use the resolved thumbnail from Discord embeds', () => {
  const page = 'https://tenor.com/es/view/orange-annoying-annoying-orange-orange';
  const gif = 'https://media.tenor.com/example/tenor.gif';
  const [message] = normalizedDiscordMessages([
    {
      id: '222222222222222222',
      author: { username: 'player' },
      timestamp: '2026-10-14T12:00:00Z',
      content: page,
      embeds: [{ thumbnail: { url: gif } }],
    },
  ]);
  assert.equal(message?.content, page);
  assert.deepEqual(message?.attachments, [{ name: 'Imagen / GIF', url: gif }]);
});
