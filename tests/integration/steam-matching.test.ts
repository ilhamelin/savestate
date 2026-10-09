import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
test(
  'Steam manual catalogue match persists the selected game with signed app ID and hours',
  { skip: process.env.TEST_STEAM_MATCH_LIVE !== '1', timeout: 120000 },
  async () => {
    assert.equal(process.env.TEST_STEAM_MATCH_MOCK, '1');
    const base = process.env.TEST_APP_URL!;
    assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });
    const cookies = new Map<string, string>();
    const db = createServerClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: {
        getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
        setAll: (values) => values.forEach(({ name, value }) => cookies.set(name, value)),
      },
    });
    let userId: string | undefined;
    try {
      const email = `steam_match_${randomBytes(8).toString('hex')}@example.com`,
        password = randomBytes(24).toString('base64url');
      const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      assert.equal(created.error, null);
      userId = created.data.user!.id;
      assert.equal(
        (await admin.from('profiles').update({ library_private: true }).eq('id', userId)).error,
        null,
      );
      assert.equal((await db.auth.signInWithPassword({ email, password })).error, null);
      const post = async (data: object) => {
        const response = await fetch(`${base}/api/steam/import`, {
          method: 'POST',
          headers: {
            Origin: base,
            'Content-Type': 'application/json',
            Cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join('; '),
          },
          body: JSON.stringify(data),
        });
        return { status: response.status, body: await response.json() };
      };
      const preview = await post({ action: 'preview', profile: '76561198000000000' });
      assert.equal(preview.status, 200, preview.body.error);
      const source = preview.body.data.games.find((game: { appid: number }) => game.appid === 30);
      assert.ok(source);
      assert.equal(
        (await post({ action: 'match', ticket: source.ticket, title: ' ' })).status,
        400,
      );
      assert.equal(
        (await post({ action: 'match', ticket: source.ticket, title: 'x'.repeat(81) })).status,
        400,
      );
      const matches = await post({
        action: 'match',
        ticket: source.ticket,
        title: 'Grand Theft Auto V',
      });
      assert.equal(matches.status, 200, matches.body.error);
      const game = matches.body.data.find(
        (item: { title: string }) => item.title === 'Grand Theft Auto V',
      );
      assert.ok(game, 'Real catalogue must return GTA V for the manual full-title search');
      const payload = {
        action: 'commit',
        ticket: source.ticket,
        game_id: game.id,
        status: 'playing',
        minutes: 999999,
        appid: 999,
      };
      assert.equal((await post(payload)).status, 200);
      assert.equal((await post(payload)).status, 200);
      const entry = await db
        .from('user_games')
        .select('id')
        .eq('user_id', userId)
        .eq('game_id', game.id)
        .single();
      assert.equal(entry.error, null);
      const logs = await db
        .from('play_logs')
        .select('hours_played,note')
        .eq('user_game_id', entry.data!.id);
      assert.equal(logs.error, null);
      assert.equal(logs.data!.length, 1);
      assert.equal(Number(logs.data![0]!.hours_played), 4);
      assert.ok(logs.data![0]!.note.startsWith('[Steam lifetime:30]'));
    } finally {
      await db.auth.signOut();
      if (userId) assert.equal((await admin.auth.admin.deleteUser(userId)).error, null);
    }
  },
);
