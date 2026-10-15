import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

test(
  'friends RPC respects library privacy and request RLS protects responses and cancellation',
  { skip: process.env.TEST_PLAYER_FRIENDS_LIVE !== '1', timeout: 90000 },
  async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const options = { auth: { persistSession: false, autoRefreshToken: false } };
    const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, options);
    const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, options);
    const clients = Array.from({ length: 3 }, () =>
      createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, options),
    );
    const ids: string[] = [];
    try {
      for (const client of clients) {
        const email = `friends_${randomBytes(8).toString('hex')}@example.com`;
        const password = randomBytes(24).toString('base64url');
        const result = await admin.auth.admin.createUser({ email, password, email_confirm: true });
        assert.equal(result.error, null);
        ids.push(result.data.user!.id);
        assert.equal((await client.auth.signInWithPassword({ email, password })).error, null);
      }
      const [owner, friend, stranger] = ids;
      assert.equal(
        (await admin.from('profiles').update({ library_private: true }).in('id', ids)).error,
        null,
      );
      const game = await admin.from('games').select('id,title').limit(1).single();
      assert.equal(game.error, null);
      const entry = await admin
        .from('user_games')
        .insert({ user_id: friend, game_id: game.data!.id, status: 'playing' })
        .select('id,updated_at')
        .single();
      assert.equal(entry.error, null);
      const registered = await admin
        .from('profiles')
        .select('created_at')
        .eq('id', friend!)
        .single();
      assert.equal(registered.error, null);
      const loggedAt = new Date(Date.now() + 10000).toISOString();
      assert.equal(
        (
          await admin.from('play_logs').insert({
            user_game_id: entry.data!.id,
            platform_played: 'PC',
            play_method: 'hardware',
            hours_played: 1,
            created_at: loggedAt,
          })
        ).error,
        null,
      );
      const accepted = await admin
        .from('friendships')
        .insert({ sender_id: owner, receiver_id: friend, status: 'accepted' })
        .select('id')
        .single();
      assert.equal(accepted.error, null);
      const request = await clients[2]!
        .from('friendships')
        .insert({ sender_id: stranger, receiver_id: owner, status: 'pending' })
        .select('id')
        .single();
      assert.equal(request.error, null);

      for (const visitor of [anon, clients[2]!]) {
        const friends = await visitor.rpc('get_player_friends', { p_user_id: owner });
        assert.equal(friends.error, null);
        assert.equal(friends.data.length, 1);
        assert.equal(friends.data[0].id, friend);
        assert.equal(friends.data[0].current_game, null);
        assert.equal(
          Date.parse(friends.data[0].last_seen_at),
          Date.parse(registered.data!.created_at),
        );
      }
      const visible = await clients[0]!.rpc('get_player_friends', { p_user_id: owner });
      assert.equal(visible.error, null);
      assert.equal(visible.data[0].current_game, game.data!.title);
      assert.equal(Date.parse(visible.data[0].last_seen_at), Date.parse(loggedAt));
      assert.equal(
        (await anon.from('friendships').select('id').eq('id', request.data!.id)).data!.length,
        0,
      );
      assert.equal(
        (await clients[1]!.from('friendships').select('id').eq('id', request.data!.id)).data!
          .length,
        0,
      );
      const forbidden = await clients[2]!
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('id', request.data!.id)
        .select('id');
      assert.equal(forbidden.error, null);
      assert.equal(forbidden.data!.length, 0);
      const response = await clients[0]!
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('id', request.data!.id)
        .select('id');
      assert.equal(response.error, null);
      assert.equal(response.data!.length, 1);
      assert.equal((await anon.rpc('get_player_friends', { p_user_id: owner })).data.length, 2);
      assert.equal(
        (await clients[2]!.from('friendships').delete().eq('id', request.data!.id)).error,
        null,
      );
      const sent = await clients[0]!
        .from('friendships')
        .insert({ sender_id: owner, receiver_id: stranger, status: 'pending' })
        .select('id')
        .single();
      assert.equal(sent.error, null);
      assert.equal(
        (await clients[1]!.from('friendships').delete().eq('id', sent.data!.id).select('id')).data!
          .length,
        0,
      );
      const rejected = await clients[2]!
        .from('friendships')
        .update({ status: 'rejected' })
        .eq('id', sent.data!.id)
        .select('id');
      assert.equal(rejected.error, null);
      assert.equal(rejected.data!.length, 1);
      assert.equal(
        (await anon.from('friendships').select('id').eq('id', sent.data!.id)).data!.length,
        0,
      );
      const cancel = await clients[0]!
        .from('friendships')
        .delete()
        .eq('id', sent.data!.id)
        .select('id');
      assert.equal(cancel.error, null);
      assert.equal(cancel.data!.length, 1);
    } finally {
      for (const id of ids) assert.equal((await admin.auth.admin.deleteUser(id)).error, null);
    }
  },
);
