import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

test(
  'Steam achievements preserve log data, reject foreign logs and keep previous progress on unavailable stats',
  { skip: process.env.TEST_STEAM_ACHIEVEMENTS_LIVE !== '1', timeout: 90000 },
  async () => {
    assert.equal(process.env.TEST_STEAM_ACHIEVEMENTS_MOCK, '1');
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
    const ids: string[] = [];
    try {
      const email = `steam_ach_${randomBytes(8).toString('hex')}@example.com`,
        password = randomBytes(24).toString('base64url');
      for (const address of [email, `other_${email}`]) {
        const result = await admin.auth.admin.createUser({
          email: address,
          password,
          email_confirm: true,
        });
        assert.equal(result.error, null);
        ids.push(result.data.user!.id);
      }
      assert.equal((await db.auth.signInWithPassword({ email, password })).error, null);
      assert.equal(
        (
          await admin
            .from('profiles')
            .update({ steam_id: '76561198000000000', library_private: true })
            .in('id', ids)
        ).error,
        null,
      );
      const game = (await admin.from('games').select('id').limit(1).single()).data!.id;
      const logs: string[] = [];
      for (const owner of ids) {
        const entry = await admin
          .from('user_games')
          .insert({ user_id: owner, game_id: game, status: 'playing' })
          .select('id')
          .single();
        assert.equal(entry.error, null);
        const log = await admin
          .from('play_logs')
          .insert({
            user_game_id: entry.data!.id,
            platform_played: 'PC / Steam',
            play_method: 'other',
            hours_played: 42.25,
            note: '[Steam lifetime:10] Partida importada',
            start_date: '2026-01-01',
          })
          .select('id')
          .single();
        assert.equal(log.error, null);
        logs.push(log.data!.id);
      }
      const post = async (id: string, authenticated = true) => {
        const response = await fetch(`${base}/api/library`, {
          method: 'POST',
          headers: {
            Origin: base,
            'Content-Type': 'application/json',
            ...(authenticated
              ? { Cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join('; ') }
              : {}),
          },
          body: JSON.stringify({ action: 'steam_achievements', id }),
        });
        return { status: response.status, body: await response.json() };
      };
      assert.equal((await post(logs[0]!, false)).status, 401);
      assert.equal((await post(logs[1]!)).status, 404);
      for (let attempt = 0; attempt < 2; attempt++) {
        const result = await post(logs[0]!);
        assert.equal(result.status, 200, result.body.error);
        assert.deepEqual(result.body.data.progress, { kind: 'achievements', current: 2, total: 3 });
      }
      const stored = await db.from('play_logs').select('*').eq('id', logs[0]!).single();
      assert.equal(stored.error, null);
      assert.equal(Number(stored.data!.hours_played), 42.25);
      assert.equal(stored.data!.note, '[Steam lifetime:10] Partida importada');
      assert.equal(stored.data!.start_date, '2026-01-01');
      assert.equal(
        (await db.from('play_logs').select('id').eq('user_game_id', stored.data!.user_game_id))
          .data!.length,
        1,
      );
      for (const appid of [20, 30]) {
        assert.equal(
          (
            await db
              .from('play_logs')
              .update({ note: `[Steam lifetime:${appid}] Partida importada` })
              .eq('id', logs[0]!)
          ).error,
          null,
        );
        const result = await post(logs[0]!);
        assert.equal(result.status, appid === 20 ? 200 : 503);
        if (appid === 20) assert.equal(result.body.data.progress, null);
        assert.deepEqual(
          (await db.from('play_logs').select('console_progress').eq('id', logs[0]!).single()).data!
            .console_progress,
          { kind: 'achievements', current: 2, total: 3 },
        );
      }
      assert.equal(
        (await db.from('play_logs').update({ platform_played: 'PC' }).eq('id', logs[0]!)).error,
        null,
      );
      assert.equal((await post(logs[0]!)).status, 400);
    } finally {
      await db.auth.signOut();
      for (const id of ids) assert.equal((await admin.auth.admin.deleteUser(id)).error, null);
    }
  },
);
