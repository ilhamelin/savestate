import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

test(
  'console import: authenticated preview, identity, atomic concurrency and preservation',
  { skip: process.env.TEST_CONSOLE_IMPORT_LIVE !== '1', timeout: 90000 },
  async () => {
    const base = process.env.TEST_APP_URL!;
    assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });
    const users: string[] = [],
      clients: ReturnType<typeof createServerClient>[] = [];
    try {
      async function identity() {
        const email = `console_import_${randomBytes(8).toString('hex')}@example.com`,
          password = randomBytes(24).toString('base64url');
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
      const post = (input: unknown, cookie = owner.cookie, origin = base) =>
        fetch(`${base}/api/consoles/import`, {
          method: 'POST',
          headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });
      assert.equal((await post({ action: 'preview', source: 'Xbox' }, '')).status, 401);
      assert.equal((await post({}, owner.cookie, 'https://outside.test')).status, 403);
      assert.equal(
        (await post({ action: 'identity', source: 'PlayStation', identity: 'ab' })).status,
        400,
      );
      for (const source of ['PlayStation', 'Xbox'])
        assert.equal(
          (await post({ action: 'identity', source, identity: `Console_${source}` })).status,
          200,
        );
      const profile = await owner.db
        .from('profiles')
        .select('psn_id,xbox_gamertag')
        .eq('id', owner.id)
        .single();
      assert.equal(profile.data!.psn_id, 'Console_PlayStation');
      assert.equal(profile.data!.xbox_gamertag, 'Console_Xbox');
      const preview = await post({
        action: 'preview',
        source: 'PlayStation',
        platform: 'PS5',
        format: 'csv',
        content: 'title,hours,status\nChrono Trigger,12.5,completed',
      });
      assert.equal(preview.status, 200);
      assert.equal((await preview.json()).data[0].status, 'cleared');
      assert.equal(
        (
          await post({
            action: 'preview',
            source: 'Xbox',
            platform: 'PS5',
            format: 'text',
            content: 'Halo',
          })
        ).status,
        400,
      );
      const matching = await post({
        action: 'match',
        source: 'PlayStation',
        title: 'Chrono Trigger',
      });
      assert.equal(matching.status, 200);
      assert.ok((await matching.json()).data.games.length > 0);
      const games = await admin.from('games').select('id').order('id').limit(3);
      assert.equal(games.error, null);
      assert.equal(games.data!.length, 3);
      const input = {
        action: 'commit',
        source: 'PlayStation',
        game_id: games.data![0]!.id,
        platform: 'PS5',
        hours: 12.5,
        status: 'cleared',
        user_id: other.id,
      };
      const results = await Promise.all(
        Array.from({ length: 6 }, async () => {
          const response = await post(input);
          assert.equal(response.status, 200);
          return (await response.json()).data.state;
        }),
      );
      assert.equal(results.filter((state) => state === 'imported').length, 1);
      const entry = await owner.db
        .from('user_games')
        .select('*')
        .eq('user_id', owner.id)
        .eq('game_id', input.game_id)
        .single();
      assert.equal(entry.data!.status, 'cleared');
      const logs = await owner.db.from('play_logs').select('*').eq('user_game_id', entry.data!.id);
      assert.equal(logs.data!.length, 1);
      assert.equal(logs.data![0].hours_played, 12.5);
      assert.equal(logs.data![0].platform_played, 'PlayStation 5');
      assert.equal(logs.data![0].play_method, 'hardware');
      const unrelated = await other.db.from('user_games').select('id').eq('user_id', other.id);
      assert.deepEqual(unrelated.data, []);
      const manual = await owner.db
        .from('user_games')
        .insert({
          user_id: owner.id,
          game_id: games.data![1]!.id,
          status: 'platinum',
          rating: 9.5,
          favorite_position: 1,
        })
        .select('id')
        .single();
      assert.equal(manual.error, null);
      assert.equal(
        (
          await owner.db.from('play_logs').insert({
            user_game_id: manual.data!.id,
            platform_played: 'PC',
            play_method: 'emulator',
            hours_played: 2,
            note: 'Manual',
          })
        ).error,
        null,
      );
      assert.equal(
        (
          await post({
            ...input,
            game_id: games.data![1]!.id,
            source: 'Xbox',
            platform: 'Xbox One',
            hours: 99,
            status: 'backlog',
          })
        ).status,
        200,
      );
      const saved = await owner.db
        .from('user_games')
        .select('status,rating,favorite_position')
        .eq('id', manual.data!.id)
        .single();
      assert.deepEqual(saved.data, { status: 'platinum', rating: 9.5, favorite_position: 1 });
      const preserved = await owner.db
        .from('play_logs')
        .select('hours_played,platform_played')
        .eq('user_game_id', manual.data!.id);
      assert.equal(
        preserved.data!.reduce((sum, log) => sum + Number(log.hours_played), 0),
        2,
      );
      assert.ok(
        preserved.data!.some(
          (log) => log.platform_played === 'Xbox One' && Number(log.hours_played) === 0,
        ),
      );
      const invalid = await owner.db.rpc('import_console_game', {
        p_game_id: games.data![2]!.id,
        p_status: 'playing',
        p_platform: 'PC',
        p_hours: 1,
        p_source: 'Xbox',
      });
      assert.ok(invalid.error);
      assert.equal(
        (
          await owner.db
            .from('user_games')
            .select('id')
            .eq('user_id', owner.id)
            .eq('game_id', games.data![2]!.id)
        ).data!.length,
        0,
      );
      assert.equal(
        (
          await post({
            ...input,
            game_id: games.data![2]!.id,
            source: 'Xbox',
            platform: 'Xbox Series S',
            hours: 0,
            status: 'backlog',
          })
        ).status,
        200,
      );
      assert.equal(
        (await post({ action: 'identity', source: 'PlayStation', identity: '' })).status,
        200,
      );
      assert.equal(
        (await owner.db.from('profiles').select('psn_id').eq('id', owner.id).single()).data!.psn_id,
        null,
      );
    } finally {
      for (const db of clients) await db.auth.signOut();
      for (const id of users) assert.equal((await admin.auth.admin.deleteUser(id)).error, null);
    }
  },
);
