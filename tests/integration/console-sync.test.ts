import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
test(
  'console sync: SDK transport, exact profile, preview, privacy and redacted failures',
  { skip: process.env.TEST_CONSOLE_SYNC_LIVE !== '1', timeout: 90000 },
  async () => {
    const base = process.env.TEST_APP_URL!;
    assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
    assert.equal(process.env.TEST_CONSOLE_SYNC_MOCK, '1');
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });
    const email = `console_sync_${randomBytes(8).toString('hex')}@example.com`,
      password = randomBytes(24).toString('base64url');
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    assert.equal(created.error, null);
    const id = created.data.user!.id;
    const cookies = new Map<string, string>();
    const db = createServerClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: {
        getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
        setAll: (rows) => rows.forEach(({ name, value }) => cookies.set(name, value)),
      },
    });
    try {
      assert.equal((await db.auth.signInWithPassword({ email, password })).error, null);
      const cookie = [...cookies].map(([name, value]) => `${name}=${value}`).join('; ');
      const game = (await admin.from('games').select('id,title').order('id').limit(1).single())
        .data!;
      assert.equal(process.env.TEST_CONSOLE_SYNC_TITLE, game.title);
      const entry = (
        await db
          .from('user_games')
          .insert({
            user_id: id,
            game_id: game.id,
            status: 'playing',
            rating: 9,
            favorite_position: 1,
          })
          .select()
          .single()
      ).data!;
      const logs = await db
        .from('play_logs')
        .insert([
          {
            user_game_id: entry.id,
            platform_played: 'Xbox One',
            play_method: 'hardware',
            hours_played: 12.5,
            note: '[Xbox] Partida importada a la biblioteca.',
          },
          {
            user_game_id: entry.id,
            platform_played: 'Xbox One',
            play_method: 'other',
            hours_played: 3,
            note: 'Partida manual personal',
          },
        ])
        .select();
      assert.equal(logs.error, null);
      const imported = logs.data!.find((log) => log.play_method === 'hardware')!;
      const post = (source: string, identity: string, session = cookie) =>
        fetch(`${base}/api/consoles/import`, {
          method: 'POST',
          headers: { Cookie: session, Origin: base, 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'sync', source, identity }),
        });
      assert.equal((await post('Xbox', 'Fixture', '')).status, 401);
      assert.equal((await post('Xbox', '')).status, 400);
      for (const source of ['PlayStation', 'Xbox']) {
        const response = await post(source, 'Fixture');
        assert.equal(response.status, 200);
        const preview = (await response.json()).data;
        assert.equal(preview.length, 1);
        assert.equal(preview[0].hours, source === 'PlayStation' ? 72.39 : 0);
        assert.equal(preview[0].status, source === 'PlayStation' ? 'cleared' : 'playing');
        assert.equal((await post(source, 'Missing')).status, 404);
        const privateProfile = await post(source, 'Private');
        assert.equal(privateProfile.status, 404);
        assert.ok(!(await privateProfile.text()).includes('fixture-token'));
      }
      const failed = await post('Xbox', 'Broken');
      assert.equal(failed.status, 502);
      assert.ok(!(await failed.text()).includes('fixture-xbox-key'));
      const profile = await db
        .from('profiles')
        .select('psn_id,xbox_gamertag')
        .eq('id', id)
        .single();
      assert.equal(profile.data!.psn_id, 'Private');
      assert.equal(profile.data!.xbox_gamertag, 'Broken');
      const noHours = await post('PlayStation', 'NoHours');
      assert.equal(noHours.status, 200);
      assert.equal((await noHours.json()).data[0].hours, 0);
      const otherGame = (
        await admin.from('games').select('id').neq('id', game.id).limit(1).single()
      ).data!;
      const psnImport = await fetch(`${base}/api/consoles/import`, {
        method: 'POST',
        headers: { Cookie: cookie, Origin: base, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'commit',
          source: 'PlayStation',
          game_id: otherGame.id,
          platform: 'PlayStation 4',
          status: 'playing',
          hours: 72.39,
        }),
      });
      assert.equal(psnImport.status, 200);
      const psnEntry = (
        await db
          .from('user_games')
          .select('id')
          .eq('user_id', id)
          .eq('game_id', otherGame.id)
          .single()
      ).data!;
      const psnLog = await db
        .from('play_logs')
        .select('hours_played')
        .eq('user_game_id', psnEntry.id)
        .single();
      assert.equal(psnLog.error, null);
      assert.equal(Number(psnLog.data!.hours_played), 72.39);
      assert.equal((await post('Xbox', 'Fixture')).status, 200);
      const stored = await db.from('play_logs').select('*').eq('user_game_id', entry.id);
      assert.equal(stored.data!.length, 2);
      const refreshed = stored.data!.find((log) => log.id === imported.id)!;
      assert.deepEqual(refreshed.console_progress, {
        kind: 'gamerscore',
        current: 500,
        total: 1000,
        source_title: game.title,
      });
      assert.equal(Number(refreshed.hours_played), 12.5);
      assert.equal(refreshed.note, imported.note);
      assert.equal(stored.data!.find((log) => log.id !== imported.id)!.console_progress, null);
      const preserved = (await db.from('user_games').select('*').eq('id', entry.id).single()).data!;
      assert.equal(preserved.status, 'playing');
      assert.equal(preserved.rating, 9);
      assert.equal(preserved.favorite_position, 1);
    } finally {
      await db.auth.signOut();
      assert.equal((await admin.auth.admin.deleteUser(id)).error, null);
    }
  },
);
