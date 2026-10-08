import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

test(
  'badges reales: umbrales, Platinum, permisos y notificación única',
  { skip: process.env.TEST_BADGES_LIVE !== '1', timeout: 120000 },
  async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
      key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
    assert.ok(url && key && secret);
    const admin = createClient(url, secret, { auth: { persistSession: false } });
    const anon = createClient(url, key, { auth: { persistSession: false } });
    const db = createClient(url, key, { auth: { persistSession: false } });
    const users: string[] = [],
      games: string[] = [],
      duels: string[] = [];
    const token = randomBytes(8).toString('hex');
    async function earned(userId: string) {
      const result = await db.from('user_badges').select('badge_id').eq('user_id', userId);
      assert.equal(result.error, null);
      return result.data!.map((row) => row.badge_id as string).sort();
    }
    try {
      const password = randomBytes(24).toString('base64url'),
        email = `badges_${token}@example.com`;
      const user = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      assert.equal(user.error, null);
      const userId = user.data.user!.id;
      users.push(userId);
      assert.equal((await db.auth.signInWithPassword({ email, password })).error, null);
      assert.equal(
        (await db.from('profiles').update({ library_private: true }).eq('id', userId)).error,
        null,
      );
      const seed = await anon.from('badges').select('*');
      assert.equal(seed.error, null);
      assert.equal(seed.data!.length, 7);
      assert.deepEqual(await earned(userId), []);
      assert.ok(
        (await db.from('user_badges').insert({ user_id: userId, badge_id: 'completionist' })).error,
      );
      assert.ok(
        (await db.from('badges').update({ name: 'forged' }).eq('id', 'completionist')).error,
      );
      assert.ok((await db.rpc('award_user_badges', { p_user_id: userId })).error);
      assert.ok(
        (await db.rpc('check_user_badges', { p_user_id: '00000000-0000-0000-0000-000000000001' }))
          .error,
      );
      assert.ok((await anon.rpc('check_user_badges', { p_user_id: userId })).error);
      const inserted = await admin
        .from('games')
        .insert(
          Array.from({ length: 5 }, (_, index) => ({
            igdb_id: -Number.parseInt(token.slice(0, 10), 16) - index,
            title: `Fixture badge ${token} ${index}`,
            slug: `fixture-badge-${token}-${index}`,
            release_year: 1999,
            genres: [index === 0 ? 'JRPG' : index === 1 ? 'Role-playing (RPG)' : 'RPG'],
          })),
        )
        .select('id');
      assert.equal(inserted.error, null);
      games.push(...inserted.data!.map((row) => row.id));
      for (let index = 0; index < 5; index++) {
        assert.equal(
          (
            await db
              .from('user_games')
              .insert({ user_id: userId, game_id: games[index], status: 'cleared' })
          ).error,
          null,
        );
        const ids = await earned(userId);
        assert.ok(ids.includes('first_checkpoint'));
        assert.equal(ids.includes('rpg_master'), index >= 2);
        assert.equal(ids.includes('retro_collector'), index >= 4);
        assert.equal(ids.includes('completionist'), false);
      }
      for (let index = 0; index < 5; index++) {
        assert.equal(
          (
            await db
              .from('user_games')
              .update({ status: 'platinum' })
              .eq('user_id', userId)
              .eq('game_id', games[index]!)
          ).error,
          null,
        );
        assert.equal((await earned(userId)).includes('completionist'), index >= 4);
      }
      assert.equal(
        (
          await db
            .from('posts')
            .insert({ user_id: userId, title: 'Fixture privada de logros', is_private: true })
        ).error,
        null,
      );
      assert.equal(
        (
          await db.from('party_requests').insert({
            user_id: userId,
            game_id: games[0],
            platform: 'PC',
            playstyle: 'casual',
            schedule: 'Solo prueba',
            contact_note: 'Fixture temporal: no contactar',
          })
        ).error,
        null,
      );
      for (let index = 0; index < 5; index++) {
        const duel = await admin
          .from('game_duels')
          .insert({ game_a_id: games[0], game_b_id: games[1], title: `Fixture badge ${token}` })
          .select('id')
          .single();
        assert.equal(duel.error, null);
        duels.push(duel.data.id);
        assert.equal(
          (
            await db
              .from('duel_votes')
              .insert({ duel_id: duel.data.id, user_id: userId, chosen_game_id: games[0] })
          ).error,
          null,
        );
        assert.equal((await earned(userId)).includes('arcade_veteran'), index >= 4);
      }
      const repeats = await Promise.all(
        Array.from({ length: 5 }, () => db.rpc('check_user_badges', { p_user_id: userId })),
      );
      repeats.forEach((result) => assert.equal(result.error, null));
      assert.equal((await earned(userId)).length, 7);
      const notices = await db
        .from('notifications')
        .select('badge_id')
        .eq('user_id', userId)
        .eq('kind', 'badge_unlocked');
      assert.equal(notices.error, null);
      assert.equal(notices.data!.length, 7);
      assert.equal(new Set(notices.data!.map((row) => row.badge_id)).size, 7);
      const publicAwards = await anon.from('user_badges').select('*').eq('user_id', userId);
      assert.equal(publicAwards.error, null);
      assert.equal(publicAwards.data!.length, 7);
      const privateNotices = await anon.from('notifications').select('*').eq('user_id', userId);
      assert.ok(privateNotices.error || privateNotices.data?.length === 0);
      assert.equal((await db.from('user_games').delete().eq('user_id', userId)).error, null);
      assert.equal((await earned(userId)).length, 7, 'Las medallas obtenidas son permanentes');
    } finally {
      await db.auth.signOut();
      for (const id of users) assert.equal((await admin.auth.admin.deleteUser(id)).error, null);
      if (duels.length)
        assert.equal((await admin.from('game_duels').delete().in('id', duels)).error, null);
      if (games.length)
        assert.equal((await admin.from('games').delete().in('id', games)).error, null);
      await Promise.all([admin, anon, db].map((client) => client.removeAllChannels()));
    }
  },
);
