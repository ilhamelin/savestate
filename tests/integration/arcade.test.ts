import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
test(
  'arcade real: votos únicos, Realtime, RLS, expiración y temas',
  { skip: process.env.TEST_ARCADE_LIVE !== '1', timeout: 120000 },
  async () => {
    const base = process.env.TEST_APP_URL,
      url = process.env.NEXT_PUBLIC_SUPABASE_URL,
      key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      service = process.env.SUPABASE_SERVICE_ROLE_KEY;
    assert.ok(base && ['localhost', '127.0.0.1'].includes(new URL(base).hostname));
    assert.ok(url && key && service);
    const admin = createClient(url, service, { auth: { persistSession: false } }),
      anon = createClient(url, key, { auth: { persistSession: false } });
    const users: string[] = [];
    const clients = [admin, anon];
    let duelId: string | undefined;
    try {
      async function identity() {
        const email = `arcade_${randomBytes(8).toString('hex')}@example.com`,
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
        clients.push(db);
        const signed = await db.auth.signInWithPassword({ email, password });
        assert.equal(signed.error, null);
        await db.realtime.setAuth(signed.data.session!.access_token);
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
        const body = await response.json();
        assert.equal(response.status, expected, JSON.stringify(body));
        return body.data;
      }
      const games = await admin.from('games').select('id').limit(3);
      assert.equal(games.error, null);
      assert.equal(games.data!.length, 3);
      const [a, b, c] = games.data!;
      const duel = await admin
        .from('game_duels')
        .insert({ game_a_id: a!.id, game_b_id: b!.id, title: 'Fixture arcade de verificación' })
        .select()
        .single();
      assert.equal(duel.error, null);
      duelId = duel.data.id;
      assert.ok(
        (await anon.from('game_duels').insert({ game_a_id: a!.id, game_b_id: b!.id })).error,
      );
      assert.ok(
        (
          await owner.db
            .from('duel_votes')
            .insert({ duel_id: duelId, user_id: other.id, chosen_game_id: a!.id })
        ).error,
      );
      assert.ok(
        (
          await owner.db
            .from('duel_votes')
            .insert({ duel_id: duelId, user_id: owner.id, chosen_game_id: c!.id })
        ).error,
      );
      let delivered = false;
      const channel = other.db.channel(`arcade-test:${duelId}`).on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'duel_votes',
          filter: `duel_id=eq.${duelId}`,
        },
        () => {
          delivered = true;
        },
      );
      try {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('Realtime no suscrito')), 12000);
          channel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              clearTimeout(timer);
              resolve();
            }
          });
        });
        const result = await mutate('arcade', { action: 'vote', duel_id: duelId, game_id: a!.id });
        assert.equal(result.ownVote, a!.id);
        const deadline = Date.now() + 8000;
        while (!delivered && Date.now() < deadline)
          await new Promise((resolve) => setTimeout(resolve, 100));
        assert.equal(delivered, true, 'Realtime entrega el voto a otra sesión');
      } finally {
        await other.db.removeChannel(channel);
      }
      await mutate('arcade', { action: 'vote', duel_id: duelId, game_id: a!.id });
      await mutate(
        'arcade',
        { action: 'vote', duel_id: duelId, game_id: b!.id },
        owner.cookie,
        409,
      );
      const result = await mutate(
        'arcade',
        { action: 'vote', duel_id: duelId, game_id: b!.id },
        other.cookie,
      );
      assert.equal(result.votes[a!.id], 1);
      assert.equal(result.votes[b!.id], 1);
      assert.equal(
        (await owner.db.from('duel_votes').delete().eq('duel_id', duelId)).error?.code,
        '42501',
      );
      assert.equal(
        (await admin.from('game_duels').update({ is_active: false }).eq('id', duelId)).error,
        null,
      );
      await admin.from('duel_votes').delete().eq('duel_id', duelId).eq('user_id', other.id);
      await mutate(
        'arcade',
        { action: 'vote', duel_id: duelId, game_id: b!.id },
        other.cookie,
        400,
      );
      const party = {
        action: 'create',
        game_id: a!.id,
        platform: 'PC',
        playstyle: 'coop_campaign',
        schedule: 'Viernes 21:00 GMT-3',
        contact_note: 'Discord: @fixture',
        user_id: other.id,
        expires_at: '2099-01-01',
      };
      await mutate('parties', party);
      await mutate('parties', { ...party, schedule: 'x'.repeat(101) }, owner.cookie, 400);
      await mutate('parties', party, '', 401);
      const stored = await admin
        .from('party_requests')
        .select('*')
        .eq('user_id', owner.id)
        .single();
      assert.equal(stored.error, null);
      assert.equal(stored.data.user_id, owner.id);
      assert.equal(
        Date.parse(stored.data.expires_at) - Date.parse(stored.data.created_at),
        48 * 3600000,
      );
      await mutate('parties', { action: 'delete', id: stored.data.id }, other.cookie, 404);
      assert.ok(
        (
          await owner.db.from('party_requests').insert({
            user_id: owner.id,
            game_id: a!.id,
            platform: 'PC',
            playstyle: 'casual',
            schedule: 'Ahora',
            contact_note: 'Contacto',
            expires_at: '2099-01-01',
          })
        ).error,
      );
      const response = await fetch(`${base}/parties?platform=PC&playstyle=coop_campaign`);
      assert.equal(response.status, 200);
      assert.match(await response.text(), /Discord: @fixture/);
      const clock = Date.now();
      const createdAt = new Date(clock - 49 * 3600000).toISOString(),
        expiresAt = new Date(clock - 3600000).toISOString();
      assert.equal(
        (
          await admin
            .from('party_requests')
            .update({ created_at: createdAt, expires_at: expiresAt })
            .eq('id', stored.data.id)
        ).error,
        null,
      );
      assert.equal(
        (await anon.from('party_requests').select('*').eq('id', stored.data.id)).data?.length,
        0,
      );
      const expired = await fetch(`${base}/parties`);
      assert.equal((await expired.text()).includes('Discord: @fixture'), false);
      const profile = (await admin.from('profiles').select('*').eq('id', owner.id).single()).data!;
      for (const theme of ['crt_terminal', 'handheld_console', 'retro_shelf']) {
        await mutate('profile', { ...profile, room_theme: theme });
        assert.equal(
          (await admin.from('profiles').select('room_theme').eq('id', owner.id).single()).data
            ?.room_theme,
          theme,
        );
        const page = await fetch(`${base}/players/${profile.username}`);
        assert.match(await page.text(), new RegExp(`room-${theme}`));
      }
      await mutate('profile', { ...profile, room_theme: 'bad' }, owner.cookie, 400);
      assert.ok(
        (
          await owner.db
            .from('profiles')
            .update({ room_theme: 'handheld_console' })
            .eq('id', other.id)
            .select()
        ).data?.length === 0,
      );
    } finally {
      if (duelId)
        assert.equal((await admin.from('game_duels').delete().eq('id', duelId)).error, null);
      for (const id of users.reverse())
        assert.equal((await admin.auth.admin.deleteUser(id)).error, null);
      for (const client of clients) {
        client.auth.stopAutoRefresh();
        await client.removeAllChannels();
        client.realtime.disconnect();
      }
    }
  },
);
