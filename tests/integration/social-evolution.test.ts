import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

test(
  'evolución social: notificaciones aisladas, Realtime, edición y conservación de interacciones',
  { skip: process.env.TEST_SOCIAL_LIVE !== '1', timeout: 180000 },
  async () => {
    const base = process.env.TEST_APP_URL,
      url = process.env.NEXT_PUBLIC_SUPABASE_URL,
      key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      service = process.env.SUPABASE_SERVICE_ROLE_KEY;
    assert.ok(base && ['localhost', '127.0.0.1'].includes(new URL(base).hostname));
    assert.ok(url && key && service);
    const admin = createClient(url, service, { auth: { persistSession: false } });
    const users: string[] = [],
      paths: string[] = [];
    const clients: {
      removeAllChannels: () => Promise<unknown>;
      auth: { signOut: () => Promise<unknown> };
    }[] = [];
    try {
      async function identity() {
        const email = `social_${randomBytes(8).toString('hex')}@example.com`,
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
        clients.push(db);
        return {
          id,
          db,
          cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join('; '),
        };
      }
      const owner = await identity(),
        other = await identity();
      async function mutate(cookie: string, input: unknown, status = 200, resource = 'highlights') {
        const response = await fetch(`${base}/api/${resource}`, {
          method: 'POST',
          headers: { Origin: base!, 'Content-Type': 'application/json', Cookie: cookie },
          body: JSON.stringify(input),
        });
        const json = await response.json();
        assert.equal(response.status, status, JSON.stringify(json));
        return json.data;
      }
      async function summary(cookie: string, status = 200) {
        const response = await fetch(`${base}/api/notifications`, { headers: { Cookie: cookie } });
        assert.equal(response.status, status);
        return (await response.json()).data;
      }
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
      const game = (await admin.from('games').select('id').limit(1)).data![0]!.id;
      const initial = {
        id,
        title: 'Fixture social',
        content: 'Texto original',
        category: 'epic',
        is_private: false,
        image_urls: [path],
        game_id: game,
      };
      await mutate(owner.cookie, { action: 'create', ...initial });
      await mutate(owner.cookie, { action: 'comment', post_id: id, content: 'Comentario propio' });
      assert.equal((await summary(owner.cookie)).unreadCount, 0);
      let delivered = false;
      const session = await owner.db.auth.getSession();
      await owner.db.realtime.setAuth(session.data.session!.access_token);
      const channel = owner.db.channel(`social-test:${id}`).on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${owner.id}`,
        },
        () => {
          delivered = true;
        },
      );
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Realtime subscription timeout')), 15000);
        channel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            clearTimeout(timer);
            resolve();
          }
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            clearTimeout(timer);
            reject(new Error(status));
          }
        });
      });
      await mutate(other.cookie, { action: 'comment', post_id: id, content: 'Comentario ajeno' });
      await mutate(other.cookie, { action: 'reaction', post_id: id, reaction_type: 'gg' });
      for (let attempts = 0; !delivered && attempts < 20; attempts++)
        await new Promise((resolve) => setTimeout(resolve, 250));
      const signals = await summary(owner.cookie);
      assert.equal(signals.unreadCount, 2);
      assert.deepEqual(signals.items.map((n: { kind: string }) => n.kind).sort(), [
        'post_comment',
        'post_reaction',
      ]);
      assert.equal(delivered, true, 'Realtime must deliver the recipient notification');
      assert.equal((await summary(other.cookie)).unreadCount, 0);
      await summary('', 401);
      assert.equal(
        (await other.db.from('notifications').select('id').eq('user_id', owner.id)).data?.length,
        0,
      );
      await mutate(other.cookie, { action: 'read_all_notifications' }, 200, 'community');
      assert.equal((await summary(owner.cookie)).unreadCount, 2);
      await mutate(owner.cookie, { action: 'read_all_notifications' }, 200, 'community');
      assert.equal((await summary(owner.cookie)).unreadCount, 0);
      const original = (await admin.from('posts').select('*').eq('id', id).single()).data!;
      const update = {
        action: 'update',
        ...initial,
        title: 'Momento editado',
        content: '**Nuevo** <script>bad()</script>',
        category: 'emotional',
        expected_updated_at: original.updated_at,
      };
      await mutate(other.cookie, update, 404);
      const forbidden = await other.db
        .from('posts')
        .update({ title: 'Ajeno' })
        .eq('id', id)
        .select('id');
      assert.equal(forbidden.data?.length, 0);
      await mutate(owner.cookie, { ...update, title: 'a'.repeat(121) }, 400);
      await mutate(owner.cookie, update);
      const edited = (await admin.from('posts').select('*').eq('id', id).single()).data!;
      assert.equal(edited.title, 'Momento editado');
      assert.doesNotMatch(edited.content, /<script/i);
      assert.notEqual(edited.updated_at, original.updated_at);
      assert.deepEqual(edited.image_urls, [path]);
      assert.equal(
        (await admin.from('post_comments').select('id').eq('post_id', id)).data?.length,
        2,
      );
      assert.equal(
        (await admin.from('post_reactions').select('user_id').eq('post_id', id)).data?.length,
        1,
      );
      await mutate(owner.cookie, update, 409);
      await mutate(owner.cookie, {
        ...update,
        expected_updated_at: edited.updated_at,
        image_urls: [],
        youtube_url: 'https://youtube.com/shorts/dQw4w9WgXcQ',
        is_private: true,
      });
      const privatePost = (await admin.from('posts').select('*').eq('id', id).single()).data!;
      assert.equal(privatePost.media_type, 'youtube');
      assert.equal(privatePost.youtube_video_id, 'dQw4w9WgXcQ');
      assert.equal((await other.db.from('posts').select('id').eq('id', id)).data?.length, 0);
      assert.equal(
        (await other.db.from('activity_logs').select('id').eq('user_id', owner.id)).data?.length,
        0,
      );
      assert.equal(
        (await admin.storage.from('highlights').list(`${owner.id}/${id}`)).data?.length,
        0,
      );
      await mutate(owner.cookie, {
        ...initial,
        action: 'update',
        image_urls: [],
        is_private: true,
        expected_updated_at: privatePost.updated_at,
      });
      assert.equal(
        (await admin.from('posts').select('media_type').eq('id', id).single()).data!.media_type,
        'none',
      );
      const ownerPage = await fetch(`${base}/highlights?post=${id}`, {
        headers: { Cookie: owner.cookie },
      });
      assert.equal(ownerPage.status, 200);
      assert.match(await ownerPage.text(), /Editar/);
    } finally {
      for (const db of clients) {
        await db.removeAllChannels();
        await db.auth.signOut();
      }
      if (paths.length)
        assert.equal((await admin.storage.from('highlights').remove(paths)).error, null);
      for (const id of users) assert.equal((await admin.auth.admin.deleteUser(id)).error, null);
    }
  },
);
