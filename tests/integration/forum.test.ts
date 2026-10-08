import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
test(
  'Foro real: RLS, contadores concurrentes, citas, notificaciones y rutas',
  { skip: process.env.TEST_FORUM_LIVE !== '1', timeout: 120000 },
  async () => {
    const base = process.env.TEST_APP_URL!,
      url = process.env.NEXT_PUBLIC_SUPABASE_URL!,
      key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    assert.ok(base && ['localhost', '127.0.0.1'].includes(new URL(base).hostname));
    assert.ok(url && key && service);
    const admin = createClient(url, service, { auth: { persistSession: false } }),
      users: string[] = [],
      threadIds: string[] = [],
      clients = [admin];
    try {
      async function identity() {
        const password = randomBytes(24).toString('base64url'),
          created = await admin.auth.admin.createUser({
            email: `forum_${randomBytes(8).toString('hex')}@example.com`,
            password,
            email_confirm: true,
          });
        assert.equal(created.error, null);
        const id = created.data.user!.id;
        users.push(id);
        const cookies = new Map<string, string>();
        const db = createServerClient(url, key, {
          cookies: {
            getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
            setAll: (rows) => rows.forEach(({ name, value }) => cookies.set(name, value)),
          },
        });
        clients.push(db);
        assert.equal(
          (await db.auth.signInWithPassword({ email: created.data.user!.email!, password })).error,
          null,
        );
        return {
          id,
          db,
          cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join('; '),
        };
      }
      const [a, b, c] = await Promise.all([identity(), identity(), identity()]);
      async function post(who: typeof a | null, data: Record<string, unknown>, origin = base) {
        const response = await fetch(`${base}/api/forum`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Origin: origin,
            ...(who ? { Cookie: who.cookie } : {}),
          },
          body: JSON.stringify(data),
        });
        return { status: response.status, json: await response.json() };
      }
      assert.equal((await post(null, { action: 'create' })).status, 401);
      assert.equal((await post(a, { action: 'create' }, 'https://invalid.example')).status, 403);
      const categories = await admin.from('forum_categories').select('*');
      assert.equal(categories.error, null);
      assert.equal(categories.data!.length, 5);
      for (let i = 0; i < 2; i++) {
        const r = await post(a, {
          action: 'create',
          category_id: 'off-topic',
          title: `Fixture forum ${i}`,
          content: '**Mensaje inicial** ||spoiler de prueba||',
        });
        assert.equal(r.status, 200, JSON.stringify(r.json));
        threadIds.push(r.json.data.id);
      }
      const id = threadIds[0]!;
      const initial = await post(a, {
        action: 'reply',
        thread_id: id,
        content: 'Mensaje del autor',
      });
      assert.equal(initial.status, 200);
      const firstId = initial.json.data.id;
      assert.equal(
        (await admin.from('notifications').select('*').eq('forum_thread_id', id)).data?.length,
        0,
      );
      const rb = await post(b, {
        action: 'reply',
        thread_id: id,
        content: 'Respuesta del compañero',
      });
      assert.equal(rb.status, 200);
      const rbId = rb.json.data.id;
      assert.equal(
        (
          await post(c, {
            action: 'reply',
            thread_id: id,
            reply_to_id: rbId,
            content: 'Citando al compañero',
          })
        ).status,
        200,
      );
      assert.equal(
        (
          await post(c, {
            action: 'reply',
            thread_id: id,
            reply_to_id: firstId,
            content: 'Citando al creador',
          })
        ).status,
        200,
      );
      const notices = await admin
        .from('notifications')
        .select('user_id,actor_id,kind')
        .eq('forum_thread_id', id);
      assert.equal(notices.error, null);
      assert.equal(notices.data!.length, 4);
      assert.equal(
        notices.data!.filter((n) => n.user_id === a.id && n.kind === 'forum_quote').length,
        1,
      );
      assert.equal(
        notices.data!.filter((n) => n.user_id === b.id && n.kind === 'forum_quote').length,
        1,
      );
      assert.ok(notices.data!.every((n) => n.user_id !== n.actor_id));
      assert.equal(
        (
          await post(b, {
            action: 'reply',
            thread_id: threadIds[1],
            reply_to_id: firstId,
            content: 'Cita cruzada inválida',
          })
        ).status,
        400,
      );
      const concurrent = await Promise.all(
        Array.from({ length: 18 }, (_, i) =>
          post(b, { action: 'reply', thread_id: id, content: `Respuesta concurrente ${i}` }),
        ),
      );
      assert.ok(concurrent.every((r) => r.status === 200));
      assert.equal(
        (await admin.from('forum_threads').select('replies_count').eq('id', id).single()).data
          ?.replies_count,
        22,
      );
      assert.ok(
        (
          await a.db
            .from('forum_threads')
            .update({ views_count: 999, is_pinned: true })
            .eq('id', id)
        ).error,
      );
      assert.ok(
        (await b.db.from('forum_threads').update({ title: 'Robo del hilo' }).eq('id', id).select())
          .data?.length === 0,
      );
      assert.ok(
        (
          await b.db
            .from('forum_replies')
            .insert({ thread_id: id, user_id: a.id, content: 'Autor falsificado' })
        ).error,
      );
      assert.ok(
        (await b.db.from('forum_replies').update({ thread_id: threadIds[1] }).eq('id', rbId)).error,
      );
      for (const reaction of ['gg', 'mind_blown', 'mind_blown'])
        assert.equal(
          (await post(b, { action: 'reaction', reply_id: firstId, reaction_type: reaction }))
            .status,
          200,
        );
      assert.equal(
        (await admin.from('forum_reactions').select('*').eq('reply_id', firstId)).data!.length,
        0,
      );
      const view = await post(null, { action: 'view', thread_id: id });
      assert.equal(view.status, 200);
      assert.equal(
        (await admin.from('forum_threads').select('views_count').eq('id', id).single()).data
          ?.views_count,
        1,
      );
      const summary = await fetch(`${base}/api/notifications`, { headers: { Cookie: a.cookie } });
      const summaryJson = await summary.json();
      assert.ok(
        summaryJson.data.items.some(
          (n: { forumHref?: string }) => n.forumHref === `/forum/off-topic/${id}`,
        ),
      );
      for (const path of [
        '/forum',
        '/forum/off-topic',
        `/forum/off-topic/${id}`,
        `/forum/off-topic/${id}?page=2`,
      ]) {
        const response = await fetch(base + path);
        assert.equal(response.status, 200);
        const html = await response.text();
        assert.ok(html.includes('Fixture forum') || html.includes('La Taberna Retro'));
      }
      const preview = await post(a, {
        action: 'preview',
        content: '**Texto** ||secreto|| <script>alert(1)</script>',
      });
      assert.equal(preview.status, 200);
      assert.ok(preview.json.data.html.includes('Revelar spoiler'));
      assert.ok(!preview.json.data.html.includes('<script'));
      assert.equal((await b.db.from('forum_replies').delete().eq('id', rbId)).error, null);
      assert.equal(
        (await admin.from('forum_threads').select('replies_count').eq('id', id).single()).data
          ?.replies_count,
        21,
      );
      assert.equal(
        (await admin.from('forum_threads').update({ is_locked: true }).eq('id', id)).error,
        null,
      );
      assert.equal(
        (await post(b, { action: 'reply', thread_id: id, content: 'No debe entrar' })).status,
        403,
      );
      assert.ok(
        (
          await b.db
            .from('forum_replies')
            .insert({ thread_id: id, user_id: b.id, content: 'También bloqueado por SQL' })
        ).error,
      );
    } finally {
      for (const client of clients.slice(1)) await client.auth.signOut();
      if (threadIds.length)
        assert.equal((await admin.from('forum_threads').delete().in('id', threadIds)).error, null);
      for (const id of users) assert.equal((await admin.auth.admin.deleteUser(id)).error, null);
      await Promise.all(clients.map((client) => client.removeAllChannels()));
    }
  },
);
