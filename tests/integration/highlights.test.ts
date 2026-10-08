import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

test(
  'momentos: API, reacciones, comentarios, actividad y Storage respetan privacidad real',
  { skip: process.env.TEST_HIGHLIGHTS_LIVE !== '1' },
  async () => {
    const base = process.env.TEST_APP_URL,
      url = process.env.NEXT_PUBLIC_SUPABASE_URL,
      key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      service = process.env.SUPABASE_SERVICE_ROLE_KEY;
    assert.ok(base && ['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname));
    assert.ok(url && key && service);
    const admin = createClient(url, service, { auth: { persistSession: false } }),
      anon = createClient(url, key, { auth: { persistSession: false } }),
      users: string[] = [],
      paths: string[] = [];
    try {
      async function identity() {
        const email = `highlights_${randomBytes(8).toString('hex')}@example.com`,
          password = randomBytes(24).toString('base64url');
        const result = await admin.auth.admin.createUser({ email, password, email_confirm: true });
        assert.equal(result.error, null);
        const id = result.data.user!.id;
        users.push(id);
        const cookies = new Map<string, string>();
        const db = createServerClient(url!, key!, {
          cookies: {
            getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
            setAll: (values) => values.forEach(({ name, value }) => cookies.set(name, value)),
          },
        });
        assert.equal((await db.auth.signInWithPassword({ email, password })).error, null);
        return {
          id,
          db,
          cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join('; '),
        };
      }
      const owner = await identity(),
        other = await identity();
      async function post(cookie: string, input: unknown, expected = 200) {
        const result = await fetch(`${base}/api/highlights`, {
          method: 'POST',
          headers: { Origin: base!, 'Content-Type': 'application/json', Cookie: cookie },
          body: JSON.stringify(input),
        });
        const json = await result.json();
        assert.equal(result.status, expected, JSON.stringify(json));
        return json.data;
      }
      const game = await admin.from('games').select('id').limit(1);
      assert.equal(game.error, null);
      assert.ok(game.data?.length);
      const id = randomUUID(),
        path = `${owner.id}/${id}/${randomUUID()}.webp`;
      paths.push(path);
      const webp = Buffer.from('UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=', 'base64');
      assert.equal(
        (
          await owner.db.storage
            .from('highlights')
            .upload(path, webp, { contentType: 'image/webp' })
        ).error,
        null,
      );
      assert.ok((await anon.storage.from('highlights').createSignedUrl(path, 300)).error);
      const created = await post(owner.cookie, {
        action: 'create',
        id,
        title: 'Fixture épica',
        content: '**Hola** <script>alert(1)</script>',
        category: 'epic',
        is_private: false,
        game_id: game.data[0]!.id,
        image_urls: [path],
      });
      assert.equal(created.id, id);
      await post(owner.cookie, {
        action: 'create',
        id,
        title: 'Fixture épica',
        content: '**Hola** <script>alert(1)</script>',
        category: 'epic',
        is_private: false,
        game_id: game.data[0]!.id,
        image_urls: [path],
      });
      await post(
        owner.cookie,
        {
          action: 'create',
          id,
          title: 'Otro contenido',
          category: 'epic',
          is_private: false,
          game_id: game.data[0]!.id,
          image_urls: [path],
        },
        409,
      );
      assert.ok(
        (
          await other.db.storage
            .from('highlights')
            .upload(`${owner.id}/${randomUUID()}/${randomUUID()}.webp`, webp, {
              contentType: 'image/webp',
            })
        ).error,
      );
      const stored = await admin.from('posts').select('*').eq('id', id).single();
      assert.equal(stored.error, null);
      assert.doesNotMatch(stored.data!.content, /<script/i);
      assert.equal((await anon.from('posts').select('id').eq('id', id)).data?.length, 1);
      const signed = await anon.storage.from('highlights').createSignedUrl(path, 300);
      assert.equal(signed.error, null);
      assert.ok(signed.data?.signedUrl);
      assert.equal((await fetch(signed.data.signedUrl)).status, 200);
      const publicUrl = anon.storage.from('highlights').getPublicUrl(path).data.publicUrl;
      assert.notEqual((await fetch(publicUrl)).status, 200);
      await post(other.cookie, { action: 'reaction', post_id: id, reaction_type: 'critical_hit' });
      assert.equal(
        (await other.db.from('post_reactions').select('*').eq('post_id', id)).data?.length,
        1,
      );
      await post(other.cookie, { action: 'reaction', post_id: id, reaction_type: 'critical_hit' });
      assert.equal(
        (await other.db.from('post_reactions').select('*').eq('post_id', id)).data?.length,
        0,
      );
      await post(other.cookie, { action: 'comment', post_id: id, content: 'Buen momento' });
      await post(other.cookie, { action: 'comment', post_id: id, content: 'a'.repeat(2001) }, 400);
      const comments = await fetch(`${base}/api/highlights?post=${id}`);
      assert.equal(comments.status, 200);
      const commentData = await comments.json();
      assert.equal(commentData.comments[0].content, 'Buen momento');
      await post(
        owner.cookie,
        { action: 'delete_comment', post_id: id, comment_id: commentData.comments[0].id },
        404,
      );
      await post(other.cookie, {
        action: 'delete_comment',
        post_id: id,
        comment_id: commentData.comments[0].id,
      });
      await post(other.cookie, { action: 'delete', post_id: id }, 404);
      await post('', { action: 'comment', post_id: id, content: 'Anon' }, 401);
      await post(
        owner.cookie,
        {
          action: 'create',
          id: randomUUID(),
          title: 'Inválido',
          category: 'other',
          is_private: false,
          image_urls: [path],
        },
        400,
      );
      const events = await anon
        .from('activity_logs')
        .select('id')
        .eq('user_id', owner.id)
        .eq('event_type', 'moment_shared');
      assert.equal(events.error, null);
      assert.equal(events.data?.length, 1);
      assert.equal(
        (await owner.db.from('posts').update({ is_private: true }).eq('id', id)).error,
        null,
      );
      assert.equal((await anon.from('posts').select('id').eq('id', id)).data?.length, 0);
      assert.equal(
        (
          await anon
            .from('activity_logs')
            .select('id')
            .eq('user_id', owner.id)
            .eq('event_type', 'moment_shared')
        ).data?.length,
        0,
      );
      assert.ok((await other.db.storage.from('highlights').createSignedUrl(path, 300)).error);
      await post(other.cookie, { action: 'reaction', post_id: id, reaction_type: 'gg' }, 404);
      await post(other.cookie, { action: 'comment', post_id: id, content: 'No permitido' }, 404);
      assert.equal((await fetch(`${base}/api/highlights?post=${id}`)).status, 404);
      const spoof = await other.db.from('posts').insert({
        id: randomUUID(),
        user_id: other.id,
        title: 'Referencia ajena',
        category: 'other',
        image_urls: [path],
        media_type: 'images',
        is_private: false,
      });
      assert.equal(spoof.error, null);
      assert.ok((await anon.storage.from('highlights').createSignedUrl(path, 300)).error);
      const privateId = randomUUID();
      await post(owner.cookie, {
        action: 'create',
        id: privateId,
        title: 'Solo yo',
        category: 'emotional',
        is_private: true,
        youtube_url: 'https://youtu.be/dQw4w9WgXcQ',
        game_id: game.data[0]!.id,
      });
      assert.equal(
        (
          await admin
            .from('activity_logs')
            .select('id')
            .eq('user_id', owner.id)
            .eq('event_type', 'moment_shared')
        ).data?.length,
        1,
      );
      assert.equal((await other.db.from('posts').select('id').eq('id', privateId)).data?.length, 0);
      assert.equal(
        (await owner.db.from('posts').update({ is_private: false }).eq('id', id)).error,
        null,
      );
      assert.equal(
        (await owner.db.from('profiles').update({ library_private: true }).eq('id', owner.id))
          .error,
        null,
      );
      assert.ok((await other.db.storage.from('highlights').createSignedUrl(path, 300)).error);
      assert.equal(
        (
          await admin
            .from('friendships')
            .insert({ sender_id: owner.id, receiver_id: other.id, status: 'accepted' })
        ).error,
        null,
      );
      assert.equal(
        (await other.db.storage.from('highlights').createSignedUrl(path, 300)).error,
        null,
      );
      assert.equal((await other.db.from('posts').select('id').eq('id', privateId)).data?.length, 0);
      await post(owner.cookie, { action: 'delete', post_id: id });
      assert.equal((await admin.from('posts').select('id').eq('id', id)).data?.length, 0);
      const page = await fetch(`${base}/highlights`);
      assert.equal(page.status, 200);
      assert.match(
        page.headers.get('content-security-policy') ?? '',
        /frame-src 'self' https:\/\/www.youtube-nocookie.com/,
      );
    } finally {
      if (paths.length)
        assert.equal((await admin.storage.from('highlights').remove(paths)).error, null);
      for (const id of users) assert.equal((await admin.auth.admin.deleteUser(id)).error, null);
    }
  },
);
