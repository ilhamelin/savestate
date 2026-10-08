import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, createHmac } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
test(
  'Steam/Wrapped: importación atómica, repetición, tickets y privacidad real',
  { skip: process.env.TEST_STEAM_WRAPPED_LIVE !== '1', timeout: 120000 },
  async () => {
    const base = process.env.TEST_APP_URL,
      url = process.env.NEXT_PUBLIC_SUPABASE_URL,
      key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      service = process.env.SUPABASE_SERVICE_ROLE_KEY;
    assert.ok(base && ['localhost', '127.0.0.1'].includes(new URL(base).hostname));
    assert.ok(url && key && service);
    const admin = createClient(url, service, { auth: { persistSession: false } }),
      clients = [admin],
      users: string[] = [];
    try {
      async function identity() {
        const email = `steam_wrapped_${randomBytes(8).toString('hex')}@example.com`,
          password = randomBytes(24).toString('base64url');
        const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
        assert.equal(created.error, null);
        const id = created.data.user!.id;
        users.push(id);
        const cookies = new Map<string, string>();
        const db = createServerClient(url!, key!, {
          cookies: {
            getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
            setAll: (rows) => rows.forEach(({ name, value }) => cookies.set(name, value)),
          },
        });
        clients.push(db);
        assert.equal((await db.auth.signInWithPassword({ email, password })).error, null);
        const profile = await db.from('profiles').select('username').eq('id', id).single();
        assert.equal(profile.error, null);
        return {
          id,
          db,
          username: profile.data!.username,
          cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join('; '),
        };
      }
      const owner = await identity(),
        other = await identity();
      const game = await admin.from('games').select('id,title').limit(1).single();
      assert.equal(game.error, null);
      function ticket(userId = owner.id, expires = Date.now() + 600000) {
        const payload = Buffer.from(
          JSON.stringify({
            game: { appid: 12345, name: game.data!.title, minutes: 120 },
            userId,
            expires,
          }),
        ).toString('base64url');
        return `${payload}.${createHmac('sha256', service!).update(`savestate.steam.v1:${payload}`).digest('base64url')}`;
      }
      async function post(input: unknown, cookie = owner.cookie, origin = base!) {
        const response = await fetch(`${base}/api/steam/import`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Origin: origin, Cookie: cookie },
          body: JSON.stringify(input),
        });
        return { status: response.status, body: await response.json() };
      }
      const input = {
        action: 'commit',
        ticket: ticket(),
        game_id: game.data!.id,
        status: 'playing',
        minutes: 999999,
      };
      assert.equal((await post(input, '')).status, 401);
      assert.equal((await post(input, owner.cookie, 'https://evil.test')).status, 403);
      assert.equal((await post(input, other.cookie)).status, 400);
      assert.equal(
        (await post({ ...input, ticket: ticket(owner.id, Date.now() - 1) })).status,
        400,
      );
      assert.equal((await post({ ...input, ticket: ticket().replace(/^./, 'X') })).status, 400);
      const imported = await post(input);
      assert.equal(imported.status, 200, JSON.stringify(imported.body));
      assert.equal(imported.body.data.state, 'imported');
      const entry = await owner.db
        .from('user_games')
        .select('*')
        .eq('user_id', owner.id)
        .eq('game_id', game.data!.id)
        .single();
      assert.equal(entry.error, null);
      const logs = await owner.db.from('play_logs').select('*').eq('user_game_id', entry.data!.id);
      assert.equal(logs.error, null);
      assert.equal(logs.data!.length, 1);
      assert.equal(Number(logs.data![0]!.hours_played), 2);
      assert.match(logs.data![0]!.note, /^\[Steam lifetime:/);
      assert.equal(
        (
          await owner.db
            .from('user_games')
            .update({ status: 'platinum', rating: 9.5 })
            .eq('id', entry.data!.id)
        ).error,
        null,
      );
      const repeated = await post(input);
      assert.equal(repeated.status, 200);
      assert.equal(repeated.body.data.state, 'existing');
      const unchanged = await owner.db
        .from('user_games')
        .select('status,rating')
        .eq('id', entry.data!.id)
        .single();
      assert.equal(unchanged.data!.status, 'platinum');
      assert.equal(Number(unchanged.data!.rating), 9.5);
      assert.equal(
        (await owner.db.from('play_logs').select('id').eq('user_game_id', entry.data!.id)).data!
          .length,
        1,
      );
      const bad = await owner.db.rpc('import_steam_game', {
        p_game_id: game.data!.id,
        p_status: 'platinum',
        p_minutes: 1,
        p_appid: 1,
      });
      assert.ok(bad.error);
      assert.equal(
        (await owner.db.from('profiles').update({ library_private: true }).eq('id', owner.id))
          .error,
        null,
      );
      const path = `${base}/players/${owner.username}/wrapped`;
      const denied = await fetch(path);
      assert.equal(denied.status, 200);
      const deniedHtml = await denied.text();
      assert.match(deniedHtml, /Resumen visible solo para amigos/);
      assert.doesNotMatch(deniedHtml, /Exportar Ficha de Guardado/);
      const own = await fetch(path, { headers: { Cookie: owner.cookie } });
      assert.equal(own.status, 200);
      assert.match(await own.text(), /Exportar Ficha de Guardado/);
      const otherView = await fetch(path, { headers: { Cookie: other.cookie } });
      assert.match(await otherView.text(), /Resumen visible solo para amigos/);
      if (!process.env.STEAM_API_KEY) {
        const preview = await post({ action: 'preview', profile: '76561198000000001' });
        assert.equal(preview.status, 503);
        assert.match(preview.body.error, /STEAM_API_KEY/);
      }
    } finally {
      for (const client of clients.slice(1)) await client.auth.signOut();
      for (const id of users) assert.equal((await admin.auth.admin.deleteUser(id)).error, null);
      await Promise.all(clients.map((client) => client.removeAllChannels()));
    }
  },
);
