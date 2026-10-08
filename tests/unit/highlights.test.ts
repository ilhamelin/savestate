import test from 'node:test';
import assert from 'node:assert/strict';
import { youtubeId, validatePost, highlightPaths } from '../../src/domain/highlights.ts';
const user = '11111111-1111-4111-8111-111111111111',
  id = '22222222-2222-4222-8222-222222222222';
test('momentos: YouTube acepta watch, enlaces cortos y shorts; rechaza hosts y IDs falsificados', () => {
  for (const url of [
    'https://youtu.be/dQw4w9WgXcQ?t=3',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtube.com/shorts/dQw4w9WgXcQ',
  ])
    assert.equal(youtubeId(url), 'dQw4w9WgXcQ');
  assert.equal(youtubeId(''), null);
  for (const url of [
    'https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ',
    'https://youtu.be/short',
    'javascript:alert(1)',
    'http://youtube.com/watch?v=dQw4w9WgXcQ',
    'https://user:pass@youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtu.be/dQw4w9WgXcQ/evil',
    'https://youtube.com/watch?v=<script>',
  ])
    assert.throws(() => youtubeId(url));
});
test('momentos: rutas propias, límites, exclusión de medios y categorías se validan en servidor', () => {
  const path = `${user}/${id}/33333333-3333-4333-8333-333333333333.webp`;
  const data = {
    id,
    title: 'Mi momento',
    category: 'epic',
    is_private: false,
    image_urls: [path],
    content: 'A'.repeat(5000),
  };
  assert.equal(validatePost(data, user).media_type, 'images');
  assert.throws(() => validatePost({ ...data, youtube_url: 'https://youtu.be/dQw4w9WgXcQ' }, user));
  assert.throws(() => validatePost({ ...data, title: 'a'.repeat(121) }, user));
  assert.throws(() => validatePost({ ...data, content: 'a'.repeat(5001) }, user));
  assert.throws(() => validatePost({ ...data, category: 'invalid' }, user));
  assert.throws(() => validatePost({ ...data, is_private: 'false' }, user));
  assert.throws(() => highlightPaths([path, path], user, id));
  assert.throws(() => highlightPaths([path.replace(user, id)], user, id));
  assert.throws(() => highlightPaths([`${user}/${id}/../evil.webp`], user, id));
  assert.throws(() => highlightPaths(Array(5).fill(path), user, id));
});
