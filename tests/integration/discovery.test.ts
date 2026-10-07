import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

// Explicit opt-in: this test creates and removes only its own temporary Auth user.
test(
  'Descubrimiento: páginas reales, agregado idempotente y listas independientes',
  { skip: process.env.TEST_DISCOVERY_LIVE !== '1' },
  async () => {
    const base = process.env.TEST_APP_URL;
    assert.ok(base && ['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname));
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
    assert.ok(url && key && service);
    const admin = createClient(url, service, { auth: { persistSession: false } });
    let userId: string | undefined;
    try {
      const email = `discovery_${randomBytes(8).toString('hex')}@example.com`;
      const password = randomBytes(24).toString('base64url');
      const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      assert.equal(created.error, null);
      userId = created.data.user!.id;
      const cookies = new Map<string, string>();
      const db = createServerClient(url, key, {
        cookies: {
          getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
          setAll: (values) => values.forEach(({ name, value }) => cookies.set(name, value)),
        },
      });
      const signed = await db.auth.signInWithPassword({ email, password });
      assert.equal(signed.error, null);
      async function post(resource: string, input: unknown, expected = 200) {
        const response = await fetch(`${base}/api/${resource}`, {
          method: 'POST',
          headers: {
            Origin: base!,
            'Content-Type': 'application/json',
            Cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join('; '),
          },
          body: JSON.stringify(input),
        });
        const result = await response.json();
        assert.equal(response.status, expected, JSON.stringify(result));
        return result.data;
      }
      async function page(params = '') {
        const response = await fetch(`${base}/api/catalogue${params}`);
        assert.equal(response.status, 200);
        const result = await response.json();
        assert.equal(result.source, 'igdb');
        return result as {
          games: { id: string; release_year: number }[];
          nextOffset: number | null;
        };
      }
      const first = await page();
      const second = await page('?offset=24');
      assert.equal(first.games.length, 24);
      assert.equal(second.games.length, 24);
      assert.equal(first.nextOffset, 24);
      assert.equal(new Set([...first.games, ...second.games].map((game) => game.id)).size, 48);
      const classics = await page('?sort=classics');
      assert.ok(classics.games.length && classics.games.every((game) => game.release_year < 2010));
      const recent = await page('?sort=recent');
      assert.ok(
        recent.games.length &&
          recent.games.every((game) => game.release_year <= new Date().getUTCFullYear()),
      );
      assert.equal((await fetch(`${base}/api/catalogue?offset=1`)).status, 400);
      const gameId = first.games[0]!.id,
        listGameId = first.games[1]!.id;
      await post('library', { action: 'add', game_id: gameId, status: 'backlog' });
      await post('library', { action: 'save', game_id: gameId, status: 'backlog', rating: 9.5 });
      await post('library', { action: 'favorites', game_ids: [gameId] });
      const duplicate = await post('library', {
        action: 'add',
        game_id: gameId,
        status: 'wishlist',
      });
      assert.equal(duplicate.status, 'backlog');
      assert.equal(duplicate.rating, 9.5);
      assert.equal(duplicate.favorite_position, 1);
      await post('library', { action: 'add', game_id: gameId, status: 'cleared' }, 400);
      const list = await post('lists', {
        action: 'save',
        title: 'Prueba descubrimiento',
        description: '',
        is_private: true,
      });
      const item = await post('lists', {
        action: 'item',
        list_id: list.id,
        game_id: listGameId,
        position_index: 0,
        note: 'Fuera de biblioteca',
      });
      assert.equal(item.game_id, listGameId);
      const edited = await post('lists', {
        action: 'item',
        list_id: list.id,
        game_id: listGameId,
        position_index: 1,
        note: 'Actualizada',
      });
      assert.equal(edited.note, 'Actualizada');
      const { data: entries, error } = await db
        .from('user_games')
        .select('*')
        .eq('user_id', userId);
      assert.equal(error, null);
      assert.equal(entries?.length, 1);
      assert.equal(entries![0].game_id, gameId);
    } finally {
      if (userId) {
        const removed = await admin.auth.admin.deleteUser(userId);
        assert.equal(removed.error, null, 'No se pudo limpiar la cuenta temporal.');
      }
    }
  },
);
