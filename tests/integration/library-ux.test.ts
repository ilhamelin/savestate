import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
test(
  'UX biblioteca: sesiones concurrentes, propiedad y vista previa sin publicar',
  { skip: process.env.TEST_LIBRARY_UX_LIVE !== '1' },
  async () => {
    const base = process.env.TEST_APP_URL;
    assert.ok(base && ['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname));
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
      key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      service = process.env.SUPABASE_SERVICE_ROLE_KEY;
    assert.ok(url && key && service);
    const admin = createClient(url, service, { auth: { persistSession: false } });
    const users: string[] = [];
    try {
      const login = await fetch(`${base}/login`);
      assert.equal(login.status, 200);
      assert.match(await login.text(), /<form[^>]*method="post"/);
      async function identity() {
        const email = `libraryux_${randomBytes(8).toString('hex')}@example.com`,
          password = randomBytes(24).toString('base64url');
        const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
        assert.equal(created.error, null);
        const id = created.data.user!.id;
        users.push(id);
        const cookies = new Map<string, string>();
        const db = createServerClient(url!, key!, {
          cookies: {
            getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
            setAll: (values) => values.forEach(({ name, value }) => cookies.set(name, value)),
          },
        });
        assert.equal((await db.auth.signInWithPassword({ email, password })).error, null);
        return { id, cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join('; ') };
      }
      const owner = await identity(),
        other = await identity();
      async function post(cookie: string, input: unknown, expected = 200) {
        const response = await fetch(`${base}/api/library`, {
          method: 'POST',
          headers: { Origin: base!, 'Content-Type': 'application/json', Cookie: cookie },
          body: JSON.stringify(input),
        });
        const result = await response.json();
        assert.equal(response.status, expected, JSON.stringify(result));
        return result.data;
      }
      const games = await admin.from('games').select('id').limit(1);
      assert.equal(games.error, null);
      assert.ok(games.data?.length);
      const entry = await post(owner.cookie, {
        action: 'save',
        game_id: games.data[0]!.id,
        status: 'playing',
        rating: 9.5,
      });
      const log = await post(owner.cookie, {
        action: 'log',
        user_game_id: entry.id,
        platform_played: 'SNES',
        play_method: 'emulator',
        difficulty: 'Normal',
        hours_played: 1,
        start_date: '2026-01-01',
        finish_date: null,
        note: 'Fixture de pruebas',
      });
      await Promise.all([
        post(owner.cookie, { action: 'quick_session', id: log.id, minutes: 30 }),
        post(owner.cookie, { action: 'quick_session', id: log.id, minutes: 60 }),
      ]);
      const stored = await admin.from('play_logs').select('*').eq('id', log.id).single();
      assert.equal(stored.error, null);
      assert.equal(Number(stored.data.hours_played), 2.5);
      for (const field of [
        'note',
        'platform_played',
        'play_method',
        'start_date',
        'finish_date',
        'user_game_id',
      ])
        assert.equal(stored.data[field], log[field]);
      await post(other.cookie, { action: 'quick_session', id: log.id, minutes: 90 }, 404);
      await post('', { action: 'quick_session', id: log.id, minutes: 90 }, 401);
      for (const minutes of [0, 1441, '90', 1.5])
        await post(owner.cookie, { action: 'quick_session', id: log.id, minutes }, 400);
      const html = await post(owner.cookie, {
        action: 'preview_review',
        content: '**Hola** <script>alert(1)</script> [mal](javascript:alert(1))',
      });
      assert.match(html, /<strong>Hola<\/strong>/);
      assert.doesNotMatch(html, /<script|javascript:/i);
      assert.equal(
        (await admin.from('reviews').select('id').eq('user_game_id', entry.id)).data?.length,
        0,
      );
      assert.equal(
        Number(
          (await admin.from('user_games').select('rating').eq('id', entry.id).single()).data
            ?.rating,
        ),
        9.5,
      );
      await post('', { action: 'preview_review', content: '**Hola**' }, 401);
      assert.equal(
        (await admin.from('play_logs').update({ hours_played: 99999.9 }).eq('id', log.id)).error,
        null,
      );
      await post(owner.cookie, { action: 'quick_session', id: log.id, minutes: 60 }, 400);
      assert.equal(
        Number(
          (await admin.from('play_logs').select('hours_played').eq('id', log.id).single()).data
            ?.hours_played,
        ),
        99999.9,
      );
    } finally {
      for (const id of users) assert.equal((await admin.auth.admin.deleteUser(id)).error, null);
    }
  },
);
