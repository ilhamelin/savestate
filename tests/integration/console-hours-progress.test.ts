import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

test(
  'console imports preserve progress, repeated imports and optimistic hours correction',
  { skip: process.env.TEST_CONSOLE_HOURS_LIVE !== '1', timeout: 90000 },
  async () => {
    const base = process.env.TEST_APP_URL!;
    assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });
    const cookies = new Map<string, string>(),
      ids: string[] = [];
    const db = createServerClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: {
        getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
        setAll: (values) => values.forEach(({ name, value }) => cookies.set(name, value)),
      },
    });
    try {
      const email = `console_hours_${randomBytes(8).toString('hex')}@example.com`,
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
      const owner = ids[0]!;
      assert.equal((await db.auth.signInWithPassword({ email, password })).error, null);
      const post = async (resource: string, data: object) => {
        const response = await fetch(`${base}/api/${resource}`, {
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
      const game = (await admin.from('games').select('id').limit(1).single()).data!.id;
      const input = {
        action: 'commit',
        source: 'Xbox',
        game_id: game,
        platform: 'Xbox One',
        status: 'playing',
        hours: 35.5,
        progress: { kind: 'gamerscore', current: 850, total: 1000 },
      };
      assert.equal((await post('consoles/import', input)).status, 200);
      assert.equal(
        (
          await post('consoles/import', {
            ...input,
            hours: 99,
            progress: { ...input.progress, current: 900 },
          })
        ).status,
        200,
      );
      const entry = (
        await db.from('user_games').select('id').eq('user_id', owner).eq('game_id', game).single()
      ).data!.id;
      const imported = await db.from('play_logs').select('*').eq('user_game_id', entry);
      assert.equal(imported.error, null);
      assert.equal(imported.data!.length, 1);
      const log = imported.data![0]!;
      assert.equal(Number(log.hours_played), 35.5);
      assert.deepEqual(log.console_progress, { kind: 'gamerscore', current: 900, total: 1000 });
      assert.equal(log.note, '[Xbox] Partida importada a la biblioteca.');
      assert.equal(
        (
          await post('library', {
            action: 'set_hours',
            id: log.id,
            hours: 42.25,
            expected_hours: 35.5,
          })
        ).status,
        200,
      );
      assert.equal(
        (
          await post('library', {
            action: 'set_hours',
            id: log.id,
            hours: 50,
            expected_hours: 35.5,
          })
        ).status,
        409,
      );
      assert.equal(
        (
          await post('library', {
            action: 'set_hours',
            id: log.id,
            hours: -1,
            expected_hours: 42.25,
          })
        ).status,
        400,
      );
      const stored = (await db.from('play_logs').select('*').eq('id', log.id).single()).data!;
      assert.equal(Number(stored.hours_played), 42.25);
      assert.equal(stored.note, log.note);
      assert.equal(stored.start_date, log.start_date);
      assert.equal(stored.finish_date, log.finish_date);
      assert.deepEqual(stored.console_progress, log.console_progress);
      assert.equal((await db.from('profiles').select('xp').eq('id', owner).single()).data!.xp, 0);
      assert.equal(
        (
          await post('consoles/import', {
            ...input,
            progress: { kind: 'trophies', current: 1, total: 2 },
          })
        ).status,
        400,
      );
      const otherEntry = (
        await admin
          .from('user_games')
          .insert({ user_id: ids[1], game_id: game, status: 'playing' })
          .select('id')
          .single()
      ).data!.id;
      const otherLog = (
        await admin
          .from('play_logs')
          .insert({
            user_game_id: otherEntry,
            platform_played: 'PC',
            play_method: 'other',
            hours_played: 0,
          })
          .select('id')
          .single()
      ).data!.id;
      assert.equal(
        (await post('library', { action: 'set_hours', id: otherLog, hours: 10, expected_hours: 0 }))
          .status,
        404,
      );
    } finally {
      await db.auth.signOut();
      for (const id of ids) assert.equal((await admin.auth.admin.deleteUser(id)).error, null);
    }
  },
);
