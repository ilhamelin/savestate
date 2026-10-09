import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { levelFromXp } from '../../src/domain/progression.ts';

test(
  'progression: real permissions, atomic duplicate awards, cooldown, limits and server flows',
  { skip: process.env.TEST_PLAYER_PROGRESSION_LIVE !== '1', timeout: 120000 },
  async () => {
    const base = process.env.TEST_APP_URL!;
    assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });
    const ids: string[] = [];
    const cookies = new Map<string, string>();
    const db = createServerClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: {
        getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
        setAll: (items) => items.forEach(({ name, value }) => cookies.set(name, value)),
      },
    });
    try {
      const password = randomBytes(24).toString('base64url');
      const email = `progression_${randomBytes(8).toString('hex')}@example.com`;
      for (const address of [email, `other_${email}`]) {
        const created = await admin.auth.admin.createUser({
          email: address,
          password,
          email_confirm: true,
        });
        assert.equal(created.error, null);
        ids.push(created.data.user!.id);
      }
      const id = ids[0]!;
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
      const award = (action: string, amount: number, reference: string) =>
        admin.rpc('award_xp', {
          p_user_id: id,
          p_amount: amount,
          p_action: action,
          p_reference_id: reference,
        });
      const denied = await db.rpc('award_xp', {
        p_user_id: id,
        p_amount: 150,
        p_action: 'cleared',
        p_reference_id: game,
      });
      assert.equal(denied.error?.code, '42501');
      assert.equal(
        (await db.from('profiles').update({ xp: 99999, level: 50 }).eq('id', id)).error?.code,
        '42501',
      );
      assert.equal(
        (await db.from('profiles').update({ equipped_frame: 'boss' }).eq('id', id)).error?.code,
        '23514',
      );
      const concurrent = await Promise.all(
        Array.from({ length: 8 }, () => award('cleared', 150, game)),
      );
      assert.ok(concurrent.every((result) => !result.error));
      assert.equal(concurrent.filter((result) => result.data.success).length, 1);
      assert.equal(concurrent.find((result) => result.data.success)!.data.leveled_up, true);
      assert.equal((await award('cleared', 99999, game)).error?.code, '22023');
      const xp = async () => {
        const profile = await db.from('profiles').select('*').eq('id', id).single();
        assert.equal(profile.error, null);
        assert.equal(profile.data!.level, levelFromXp(profile.data!.xp));
        return profile.data!;
      };
      assert.equal((await xp()).xp, 150);
      for (const status of ['cleared', 'platinum', 'cleared', 'platinum'])
        assert.equal(
          (await post('library', { action: 'save', game_id: game, status, rating: 9 })).status,
          200,
        );
      assert.equal((await xp()).xp, 450);
      const entry = (
        await db.from('user_games').select('id').eq('user_id', id).eq('game_id', game).single()
      ).data!.id;
      const log = await post('library', {
        action: 'log',
        user_game_id: entry,
        platform_played: 'PC',
        play_method: 'other',
        hours_played: 1,
        note: 'Disposable QA session',
      });
      assert.equal(log.status, 200);
      assert.equal(
        (await post('library', { action: 'quick_session', id: log.body.data.id, minutes: 30 }))
          .status,
        200,
      );
      assert.equal((await xp()).xp, 460);
      assert.equal(
        (
          await post('library', {
            action: 'review',
            game_id: game,
            rating: 9,
            content: 'Reseña corta',
            has_spoilers: false,
          })
        ).status,
        200,
      );
      assert.equal((await xp()).xp, 460);
      for (let attempt = 0; attempt < 2; attempt++)
        assert.equal(
          (
            await post('library', {
              action: 'review',
              game_id: game,
              rating: 9,
              content: 'Una aventura con personajes memorables y decisiones interesantes. '.repeat(
                3,
              ),
              has_spoilers: false,
            })
          ).status,
          200,
        );
      assert.equal((await xp()).xp, 535);
      const moments = await Promise.all(
        Array.from({ length: 4 }, (_, index) =>
          post('highlights', {
            action: 'create',
            id: randomUUID(),
            title: `Disposable QA ${index}`,
            content: 'Prueba privada de progresión',
            category: 'other',
            is_private: true,
          }),
        ),
      );
      assert.ok(moments.every((result) => result.status === 200));
      assert.equal((await xp()).xp, 655);
      for (const action of ['steam_connected', 'psn_connected', 'xbox_connected']) {
        assert.equal((await award(action, 200, 'provider')).error, null);
        assert.equal((await award(action, 200, 'other_provider')).data.reason, 'already_awarded');
      }
      assert.equal((await xp()).xp, 1255);
      const baseline = await xp();
      assert.equal(
        (
          await post('profile', {
            ...baseline,
            equipped_frame: 'boss',
            equipped_title: 'Final Boss',
            level: 99,
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await post('profile', {
            ...baseline,
            equipped_frame: 'bronze',
            equipped_title: 'Button Masher',
          })
        ).status,
        200,
      );
      assert.equal((await xp()).equipped_frame, 'bronze');
      assert.equal(
        (await db.from('user_xp_events').insert({ user_id: id, amount: 1000, action: 'cleared' }))
          .error?.code,
        '42501',
      );
      await admin.rpc('award_xp', {
        p_user_id: ids[1],
        p_amount: 150,
        p_action: 'cleared',
        p_reference_id: game,
      });
      assert.deepEqual(
        (await db.from('user_xp_events').select('*').eq('user_id', ids[1]!)).data,
        [],
      );
      const events = await db.from('user_xp_events').select('amount').eq('user_id', id);
      assert.equal(
        events.data!.reduce((sum, event) => sum + event.amount, 0),
        1255,
      );
      const shifted = await admin
        .from('user_xp_events')
        .update({ created_at: new Date(Date.now() - 31 * 60000).toISOString() })
        .eq('user_id', id)
        .eq('action', 'session');
      assert.equal(shifted.error, null);
      assert.equal(
        (await post('library', { action: 'quick_session', id: log.body.data.id, minutes: 30 }))
          .status,
        200,
      );
      assert.equal((await xp()).xp, 1265);
    } finally {
      await db.auth.signOut();
      for (const id of ids) assert.equal((await admin.auth.admin.deleteUser(id)).error, null);
    }
  },
);
