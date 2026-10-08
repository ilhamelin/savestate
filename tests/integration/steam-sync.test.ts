import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
test(
  'Steam quick sync: real quota, concurrent HTTP calls, atomic hours, failures and permissions',
  { skip: process.env.TEST_STEAM_SYNC_LIVE !== '1', timeout: 150000 },
  async () => {
    // The local app must run with the explicit Valve fixture preload.
    const base = process.env.TEST_APP_URL!;
    assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
    assert.equal(process.env.TEST_STEAM_SYNC_MOCK, '1');
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });
    const users: string[] = [];
    const clients: ReturnType<typeof createServerClient>[] = [];
    try {
      async function identity() {
        const email = `steam_sync_${randomBytes(8).toString('hex')}@example.com`;
        const password = randomBytes(24).toString('base64url');
        const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
        assert.equal(created.error, null);
        const id = created.data.user!.id;
        users.push(id);
        const cookies = new Map<string, string>();
        const db = createServerClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
          cookies: {
            getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
            setAll: (rows) => rows.forEach(({ name, value }) => cookies.set(name, value)),
          },
        });
        clients.push(db);
        assert.equal((await db.auth.signInWithPassword({ email, password })).error, null);
        return {
          id,
          db,
          cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join('; '),
        };
      }
      const owner = await identity(),
        other = await identity();
      const post = (route: string, input: unknown, cookie = owner.cookie, origin = base) =>
        fetch(`${base}/api/steam/${route}`, {
          method: 'POST',
          headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });
      const status = async () =>
        (await fetch(`${base}/api/steam/sync`, { headers: { Cookie: owner.cookie } })).json();
      assert.equal((await post('sync', {}, '')).status, 401);
      assert.equal((await post('sync', {}, owner.cookie, 'https://outside.test')).status, 403);
      assert.equal((await post('sync', {})).status, 400);
      assert.equal((await status()).remainingSlots, 3);
      assert.equal((await status()).linked, false);
      const previewResponse = await post('import', {
        action: 'preview',
        profile: '76561198000000001',
      });
      assert.equal(previewResponse.status, 200);
      const preview = (await previewResponse.json()).data;
      assert.equal(preview.steamId, '76561198000000001');
      assert.equal(
        (
          await post('import', {
            action: 'commit',
            ticket: preview.linkTicket,
            game_id: '00000000-0000-0000-0000-000000000001',
            status: 'playing',
          })
        ).status,
        400,
      );
      assert.equal(
        (await post('import', { action: 'link', ticket: preview.games[0].ticket })).status,
        400,
      );
      assert.equal(
        (await post('import', { action: 'link', ticket: preview.linkTicket }, other.cookie)).status,
        400,
      );
      assert.equal(
        (await post('import', { action: 'link', ticket: preview.linkTicket })).status,
        200,
      );
      assert.equal((await status()).linked, true);
      assert.equal((await status()).remainingSlots, 3);
      const games = await admin.from('games').select('id').order('id').limit(3);
      assert.equal(games.error, null);
      assert.equal(games.data!.length, 3);
      for (let index = 0; index < 2; index++) {
        const imported: { error: unknown } = await owner.db.rpc('import_steam_game', {
          p_game_id: games.data![index]!.id,
          p_status: 'playing',
          p_minutes: index === 0 ? 120 : 0,
          p_appid: 10000 + index,
        });
        assert.equal(imported.error, null);
      }
      const rows = await owner.db
        .from('user_games')
        .select('id,game_id')
        .eq('user_id', owner.id)
        .order('game_id');
      assert.equal(rows.error, null);
      const first = rows.data!.find((row) => row.game_id === games.data![0]!.id)!;
      const second = rows.data!.find((row) => row.game_id === games.data![1]!.id)!;
      assert.equal(
        (
          await owner.db
            .from('user_games')
            .update({ status: 'platinum', rating: 9.5, favorite_position: 1 })
            .eq('id', first.id)
        ).error,
        null,
      );
      const manual = await admin
        .from('play_logs')
        .insert([
          {
            user_game_id: first.id,
            hours_played: 1.25,
            platform_played: 'PS2',
            play_method: 'emulator',
            note: 'Manual session must remain untouched.',
          },
          {
            user_game_id: first.id,
            hours_played: 0.5,
            platform_played: 'PC / Steam',
            play_method: 'hardware',
            note: '[Steam lifetime:10000] Existing split lifetime log.',
          },
        ])
        .select('id,note');
      assert.equal(manual.error, null);
      assert.equal(
        (
          await owner.db
            .from('play_logs')
            .select('hours_played')
            .eq('user_game_id', second.id)
            .single()
        ).data!.hours_played,
        0,
      );
      const untouched = await admin
        .from('user_games')
        .insert({ user_id: owner.id, game_id: games.data![2]!.id, status: 'cleared', rating: 8 })
        .select('id')
        .single();
      assert.equal(untouched.error, null);
      const otherEntry = await admin
        .from('user_games')
        .insert({ user_id: other.id, game_id: games.data![0]!.id })
        .select('id')
        .single();
      assert.equal(otherEntry.error, null);
      assert.equal(
        (
          await admin.from('play_logs').insert({
            user_game_id: otherEntry.data!.id,
            hours_played: 99,
            platform_played: 'Steam',
            play_method: 'hardware',
            note: '[Steam lifetime:10000] Other owner.',
          })
        ).error,
        null,
      );
      const attempted = await Promise.all(
        Array.from({ length: 10 }, () =>
          post('sync', { p_user_id: other.id, p_games: [{ appid: 10000, minutes: 6000000 }] }),
        ),
      );
      assert.equal(attempted.filter((response) => response.status === 200).length, 3);
      assert.equal(attempted.filter((response) => response.status === 429).length, 7);
      const results = await Promise.all(
        attempted
          .filter((response) => response.status === 200)
          .map(async (response) => (await response.json()).data),
      );
      assert.equal(
        results.reduce((total, row) => total + row.updatedCount, 0),
        2,
      );
      assert.equal(
        results.reduce((total, row) => total + row.hoursAdded, 0),
        3.75,
      );
      const denied = attempted.find((response) => response.status === 429)!;
      assert.ok(Number(denied.headers.get('Retry-After')) > 0);
      assert.equal((await status()).remainingSlots, 0);
      const logs = await owner.db.from('play_logs').select('*').eq('user_game_id', first.id);
      assert.equal(logs.error, null);
      assert.equal(
        logs
          .data!.filter((log) => log.note.startsWith('[Steam lifetime:'))
          .reduce((sum, log) => sum + Number(log.hours_played), 0),
        5,
      );
      assert.equal(
        Number(
          logs.data!.find((log) => log.note === 'Manual session must remain untouched.')!
            .hours_played,
        ),
        1.25,
      );
      assert.equal(
        (
          await owner.db
            .from('play_logs')
            .select('hours_played')
            .eq('user_game_id', second.id)
            .single()
        ).data!.hours_played,
        1.25,
      );
      const unchanged = await owner.db
        .from('user_games')
        .select('status,rating,favorite_position')
        .eq('id', first.id)
        .single();
      assert.deepEqual(unchanged.data, { status: 'platinum', rating: 9.5, favorite_position: 1 });
      assert.equal(
        (
          await owner.db
            .from('user_games')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', owner.id)
        ).count,
        3,
      );
      assert.equal(
        (await owner.db.from('play_logs').select('id').eq('user_game_id', untouched.data!.id)).data!
          .length,
        0,
      );
      assert.equal(
        (
          await admin
            .from('play_logs')
            .select('hours_played')
            .eq('user_game_id', otherEntry.data!.id)
            .single()
        ).data!.hours_played,
        99,
      );
      assert.ok(
        (await owner.db.from('profiles').update({ steam_sync_count: 0 }).eq('id', owner.id)).error,
      );
      assert.ok(
        (
          await owner.db.rpc('apply_steam_sync', {
            p_user_id: owner.id,
            p_steam_id: '76561198000000001',
            p_games: [],
          })
        ).error,
      );
      const newPreview = (
        await (await post('import', { action: 'preview', profile: '76561198000000002' })).json()
      ).data;
      assert.equal(
        (await post('import', { action: 'link', ticket: newPreview.linkTicket })).status,
        200,
      );
      assert.equal((await status()).remainingSlots, 0);
      assert.equal((await post('sync', {})).status, 429);
      const stale = await admin.rpc('apply_steam_sync', {
        p_user_id: owner.id,
        p_steam_id: '76561198000000001',
        p_games: [],
      });
      assert.equal(stale.error?.code, 'P0001');
      assert.equal(
        (
          await admin
            .from('profiles')
            .update({
              steam_id: '76561198000000003',
              steam_sync_count: 3,
              steam_last_sync_at: new Date(Date.now() - 86400000).toISOString(),
            })
            .eq('id', owner.id)
        ).error,
        null,
      );
      assert.equal((await status()).remainingSlots, 3);
      const failed = await post('sync', {});
      assert.equal(failed.status, 503);
      assert.equal((await status()).remainingSlots, 2);
      const actual = await admin
        .from('profiles')
        .select('steam_sync_count,steam_last_sync_at')
        .eq('id', owner.id)
        .single();
      assert.equal(actual.data!.steam_sync_count, 1);
      assert.equal(
        new Date(actual.data!.steam_last_sync_at).toISOString().slice(0, 10),
        new Date().toISOString().slice(0, 10),
      );
      const existing = await owner.db.rpc('import_steam_game', {
        p_game_id: games.data![2]!.id,
        p_status: 'playing',
        p_minutes: 999,
        p_appid: 10002,
      });
      assert.equal(existing.error, null);
      assert.equal(existing.data, 'existing');
      assert.equal(
        (
          await owner.db
            .from('play_logs')
            .select('hours_played')
            .eq('user_game_id', untouched.data!.id)
            .single()
        ).data!.hours_played,
        0,
      );
      assert.equal(
        (await owner.db.from('user_games').select('status').eq('id', untouched.data!.id).single())
          .data!.status,
        'cleared',
      );
    } finally {
      for (const db of clients) await db.auth.signOut();
      for (const id of users) assert.equal((await admin.auth.admin.deleteUser(id)).error, null);
    }
  },
);
