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

test('Foro: extractos censuran spoilers y bloques de código antes de truncar Markdown', async () => {
  const { extractForumExcerpt } = await import('../../src/domain/forum.ts');
  const row = extractForumExcerpt(
    '# Título\n**Texto** [guía](https://example.com) ||secreto||\n```js\nconst oculto = true;\n```',
  );
  assert.equal(row.hasSpoilers, true);
  assert.equal(row.hasCode, true);
  assert.ok(row.excerpt.includes('[Spoiler]'));
  assert.ok(row.excerpt.includes('[Código]'));
  assert.ok(!row.excerpt.includes('secreto'));
  assert.ok(!row.excerpt.includes('const oculto'));
  assert.ok(!row.excerpt.includes('https:'));
  assert.ok(row.excerpt.includes('Título Texto guía'));
  assert.equal(
    extractForumExcerpt('||secreto con más caracteres||', 10).excerpt.includes('secreto'),
    false,
  );
  assert.equal(extractForumExcerpt('texto', 0).excerpt, '');
  assert.ok(Array.from(extractForumExcerpt('😀'.repeat(50), 10).excerpt).length <= 10);
  assert.equal(extractForumExcerpt('Simple').hasSpoilers, false);
});
test('Foro: edición de respuesta valida autoría referenciada por UUID y límites estrictos', async () => {
  const { validateForumReplyEdit } = await import('../../src/domain/forum.ts');
  assert.deepEqual(validateForumReplyEdit({ reply_id: id, content: ' Editado ' }), {
    reply_id: id,
    content: 'Editado',
  });
  for (const input of [
    { reply_id: 'bad', content: 'x' },
    { reply_id: id, content: '' },
    { reply_id: id, content: 'x'.repeat(8001) },
  ])
    assert.throws(() => validateForumReplyEdit(input));
});
test('Foro: reacciones optimistas alternan y cambian sin mutar el estado confirmado', async () => {
  const { optimisticForumReaction } = await import('../../src/domain/forum.ts');
  const original = {
    counts: { like: 3, gg: 2, mind_blown: 0, game_over: 0 },
    ownReaction: 'like',
  } as import('../../src/domain/forum.ts').ForumReplyView;
  const changed = optimisticForumReaction(original, 'gg');
  assert.equal(changed.ownReaction, 'gg');
  assert.equal(changed.counts.like, 2);
  assert.equal(changed.counts.gg, 3);
  assert.equal(original.counts.like, 3);
  assert.equal(original.counts.gg, 2);
  const removed = optimisticForumReaction(original, 'like');
  assert.equal(removed.ownReaction, null);
  assert.equal(removed.counts.like, 2);
});
