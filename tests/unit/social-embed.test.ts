import test from 'node:test';
import assert from 'node:assert/strict';
import { socialPost, socialLinks } from '../../src/domain/social-embed.ts';
import { sanitizeEmbedHtml } from '../../src/services/embed-html.ts';
test('social embeds canonicalize exact public post hosts and reject SSRF URLs', () => {
  assert.equal(
    socialPost('https://x.com/SaveState/status/123?s=20')?.url,
    'https://twitter.com/SaveState/status/123',
  );
  assert.equal(
    socialPost('https://www.instagram.com/reel/abc_-123/?igsh=test')?.frameUrl,
    'https://www.instagram.com/reel/abc_-123/embed/',
  );
  assert.equal(socialPost('https://instagram.com/p/abc')?.provider, 'instagram');
  for (const url of [
    'http://x.com/a/status/1',
    'https://x.com.evil.test/a/status/1',
    'https://evil.test@x.com/a/status/1',
    'https://x.com:444/a/status/1',
    'https://127.0.0.1/status/1',
    'https://instagram.com/accounts/login',
    'https://x.com/a/status/1/photo/1',
    'https://x.com\\@evil.test/a/status/1',
    'javascript:alert(1)',
  ])
    assert.equal(socialPost(url), null);
});
test('social embed discovery respects code/spoilers, deduplicates and caps cards', () => {
  const source =
    '```\nhttps://x.com/a/status/1\n```\n||https://x.com/a/status/2||\n    https://x.com/a/status/3\nhttps://x.com/a/status/4\nhttps://twitter.com/a/status/4\nhttps://instagram.com/p/a/\nhttps://instagram.com/reel/b/\nhttps://instagram.com/p/c/';
  assert.deepEqual(
    socialLinks(source).map((post) => post.url),
    [
      'https://twitter.com/a/status/4',
      'https://www.instagram.com/p/a/',
      'https://www.instagram.com/reel/b/',
    ],
  );
});
test('oEmbed HTML never includes provider scripts, event handlers, frames or unsafe URLs', () => {
  const html = sanitizeEmbedHtml(
    '<blockquote style="color:red" onclick="bad()"><p>Hello</p><script src="https://evil.test"></script><iframe src="https://evil.test"></iframe><img src=x onerror=bad()><a href="javascript:alert(1)">bad</a><a href="https://x.com/a/status/1">X</a></blockquote>',
  );
  assert.doesNotMatch(html, /<script|<iframe|<img|onclick|onerror|style=|javascript:/i);
  assert.match(html, /<p>Hello<\/p>/);
  assert.match(html, /rel="noopener noreferrer"/);
});
