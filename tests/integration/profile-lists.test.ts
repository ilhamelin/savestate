import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

test(
  'estudio y listas: persistencia de perfil, notas, límites y autoría bajo RLS',
  { skip: process.env.TEST_STUDIO_LIVE !== '1', timeout: 120000 },
  async () => {
    const base = process.env.TEST_APP_URL,
      url = process.env.NEXT_PUBLIC_SUPABASE_URL,
      key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      service = process.env.SUPABASE_SERVICE_ROLE_KEY;
    assert.ok(base && ['localhost', '127.0.0.1'].includes(new URL(base).hostname));
    assert.ok(url && key && service);
    const admin = createClient(url, service, { auth: { persistSession: false } });
    const users: string[] = [];
    try {
      async function identity() {
        const email = `studio_${randomBytes(8).toString('hex')}@example.com`,
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
      async function mutate(
        resource: string,
        input: unknown,
        cookie = owner.cookie,
        expected = 200,
      ) {
        const response = await fetch(`${base}/api/${resource}`, {
          method: 'POST',
          headers: { Origin: base!, 'Content-Type': 'application/json', Cookie: cookie },
          body: JSON.stringify(input),
        });
        const json = await response.json();
        assert.equal(response.status, expected, JSON.stringify(json));
        return json.data;
      }
      const original = (await admin.from('profiles').select('*').eq('id', owner.id).single()).data!;
      const profile = {
        ...original,
        id: other.id,
        terminal_status: '🏆 Platinando una aventura',
        theme_color: 'amber',
        avatar_url: '/avatars/amber.svg',
        library_private: false,
        social_links: { github: 'https://github.com/example' },
      };
      await mutate('profile', profile);
      const stored = (await admin.from('profiles').select('*').eq('id', owner.id).single()).data!;
      assert.equal(stored.theme_color, 'amber');
      assert.equal(stored.terminal_status, profile.terminal_status);
      assert.equal(
        (await admin.from('profiles').select('theme_color').eq('id', other.id).single()).data!
          .theme_color,
        'cyan',
      );
      await mutate('profile', { ...profile, terminal_status: 'a'.repeat(161) }, owner.cookie, 400);
      await mutate(
        'profile',
        {
          ...profile,
          avatar_url: `${url}/storage/v1/object/public/profiles/${other.id}/avatar.webp`,
        },
        owner.cookie,
        400,
      );
      const list = await mutate('lists', {
        action: 'save',
        title: 'Fixture de listas con personalidad',
        description: 'Notas de prueba',
        is_private: false,
      });
      const games = (await admin.from('games').select('id').order('title').limit(4)).data!;
      assert.equal(games.length, 4);
      for (const [position, game] of games.entries())
        await mutate('lists', {
          action: 'item',
          list_id: list.id,
          game_id: game.id,
          position_index: position,
          note: position ? `Nota ${position + 1}` : 'a'.repeat(1000),
        });
      await mutate(
        'lists',
        {
          action: 'item',
          list_id: list.id,
          game_id: games[0]!.id,
          position_index: 0,
          note: 'a'.repeat(1001),
        },
        owner.cookie,
        400,
      );
      await mutate(
        'lists',
        {
          action: 'item',
          list_id: list.id,
          game_id: games[0]!.id,
          position_index: 0,
          note: 'Edición ajena',
        },
        other.cookie,
        403,
      );
      await mutate('lists', {
        action: 'item',
        list_id: list.id,
        game_id: games[0]!.id,
        position_index: 0,
        note: 'Mi nota editada\nCon emoción.',
      });
      assert.equal(
        (
          await admin
            .from('list_items')
            .select('note')
            .eq('list_id', list.id)
            .eq('game_id', games[0]!.id)
            .single()
        ).data!.note,
        'Mi nota editada\nCon emoción.',
      );
      const overview = await fetch(`${base}/lists?player=${owner.id}`);
      assert.equal(overview.status, 200);
      assert.match(
        await overview.text(),
        /Portada compuesta de Fixture de listas con personalidad/,
      );
      const detail = await fetch(`${base}/lists/${list.id}`);
      assert.equal(detail.status, 200);
      assert.match(await detail.text(), /Nota del autor/);
      await mutate('lists', {
        action: 'save',
        id: list.id,
        title: list.title,
        description: list.description,
        is_private: true,
      });
      const anon = createClient(url, key, { auth: { persistSession: false } });
      assert.equal(
        (await anon.from('list_items').select('*').eq('list_id', list.id)).data?.length,
        0,
      );
      // A streamed Next.js notFound response can retain HTTP 200 after headers flush.
      const hidden = await fetch(`${base}/lists/${list.id}`);
      const hiddenHtml = await hidden.text();
      assert.doesNotMatch(hiddenHtml, /Fixture de listas con personalidad|Mi nota editada/);
      assert.match(hiddenHtml, /noindex/);
    } finally {
      for (const id of users) assert.equal((await admin.auth.admin.deleteUser(id)).error, null);
    }
  },
);
