import test from 'node:test';
import assert from 'node:assert/strict';
import {
  forumPage,
  forumReaction,
  validateForumThread,
  validateForumReply,
} from '../../src/domain/forum.ts';
import { forumMarkdown } from '../../src/services/forum-markdown.ts';
const id = '00000000-0000-0000-0000-000000000001';
test('Foro: canales, límites y referencias estrictas', () => {
  assert.equal(forumPage(undefined), 1);
  assert.equal(forumPage('2'), 2);
  for (const value of ['0', '-1', '2.2', 'abc']) assert.throws(() => forumPage(value));
  assert.throws(() =>
    validateForumThread({ category_id: 'unknown', title: 'Hello', content: 'Hello world' }),
  );
  assert.throws(() =>
    validateForumThread({
      category_id: 'off-topic',
      title: 'x'.repeat(151),
      content: 'Hello world',
    }),
  );
  assert.throws(() => validateForumReply({ thread_id: id, reply_to_id: 'bad', content: 'Hi' }));
  assert.throws(() => validateForumReply({ thread_id: id, content: ' '.repeat(5) }));
  assert.throws(() => forumReaction('critical_hit'));
  assert.equal(
    validateForumThread({ category_id: 'off-topic', title: ' Hello ', content: 'Hello world' })
      .title,
    'Hello',
  );
  assert.equal(forumReaction('gg'), 'gg');
});
test('Foro: Markdown seguro y spoilers respetan bloques de código', () => {
  const html = forumMarkdown(
    '**Hola** ||final secreto|| <script>alert(1)</script> [x](javascript:alert(1))',
  );
  assert.ok(html.includes('<strong>Hola</strong>'));
  assert.ok(html.includes('<summary>Revelar spoiler</summary>'));
  assert.ok(!html.includes('<script'));
  assert.ok(!html.includes('href="javascript:'));
  const code = forumMarkdown('`||literal||`\n\n```js\n||literal||\n```');
  assert.ok(code.includes('||literal||'));
  assert.ok(!code.includes('<details'));
  assert.ok(!forumMarkdown('<img src=x onerror=alert(1)>').includes('<img'));
});
