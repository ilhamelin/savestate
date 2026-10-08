import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
test(
  'Wallpaper and Top 4: authenticated storage, independent slots, preserved data and RLS',
  { skip: process.env.TEST_PROFILE_EXTRAS_LIVE !== '1', timeout: 120000 },
  async () => {
    const base = process.env.TEST_APP_URL!;
    assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });
    let id: string | undefined;
    let client: ReturnType<typeof createServerClient> | undefined;
    try {
      const created = await admin.auth.admin.createUser({
        email: `profile_extras_${randomBytes(8).toString('hex')}@example.com`,
        password: randomBytes(24).toString('base64url'),
        email_confirm: true,
      });
      assert.equal(created.error, null);
      id = created.data.user!.id;
      const cookies = new Map<string, string>();
      client = createServerClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        cookies: {
          getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
          setAll: (rows) => rows.forEach(({ name, value }) => cookies.set(name, value)),
        },
      });
      const link = await admin.auth.admin.generateLink({
        type: 'magiclink',
        email: created.data.user!.email!,
      });
      assert.equal(link.error, null);
      assert.equal(
        (
          await client.auth.verifyOtp({
            token_hash: link.data.properties!.hashed_token,
            type: 'email',
          })
        ).error,
        null,
      );
      const cookie = [...cookies].map(([name, value]) => `${name}=${value}`).join('; ');
      const headers = { Cookie: cookie, Origin: base, 'Content-Type': 'application/json' };
      const post = (resource: string, input: unknown) =>
        fetch(`${base}/api/${resource}`, { method: 'POST', headers, body: JSON.stringify(input) });
      const profile = await admin.from('profiles').select('*').eq('id', id).single();
      assert.equal(profile.error, null);
      let payload = { ...profile.data, wallpaper_url: '/wallpapers/deep_space.svg' };
      const preset = await post('profile', payload);
      assert.equal(preset.status, 200, await preset.clone().text());
      assert.equal((await preset.json()).data.wallpaper_url, payload.wallpaper_url);
      assert.equal((await post('profile', { ...payload, wallpaper_url: 'not-a-url' })).status, 400);
      assert.equal(
        (await post('profile', { ...payload, wallpaper_url: 'https://outside.test/image.webp' }))
          .status,
        400,
      );
      const bytes = Buffer.from(
        'UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA',
        'base64',
      );
      const stored = await client.storage
        .from('profiles')
        .upload(`${id}/wallpaper.webp`, bytes, { contentType: 'image/webp' });
      assert.equal(stored.error, null);
      payload = {
        ...payload,
        wallpaper_url: client.storage.from('profiles').getPublicUrl(`${id}/wallpaper.webp`).data
          .publicUrl,
      };
      const custom = await post('profile', payload);
      assert.equal(custom.status, 200, await custom.clone().text());
      const media = await fetch(payload.wallpaper_url);
      assert.equal(media.status, 200);
      const ownPage = await fetch(`${base}/players/${profile.data!.username}`, {
        headers: { Cookie: cookie },
      });
      const ownHtml = await ownPage.text();
      assert.equal(ownPage.status, 200);
      assert.match(ownHtml, /wallpaper-image/);
      assert.match(ownHtml, /Fijar slot 4/);
      const games = await admin.from('games').select('id,title').order('id').limit(30);
      assert.equal(games.error, null);
      assert.equal(games.data!.length, 30);
      const ids = games.data!.map((g) => g.id);
      const entries = await admin
        .from('user_games')
        .insert(
          ids.slice(0, 29).map((game_id, i) => ({
            user_id: id,
            game_id,
            status: 'playing',
            rating: 8.5,
            favorite_position: i < 4 ? i + 1 : null,
          })),
        )
        .select('id,game_id');
      assert.equal(entries.error, null);
      const log = await admin.from('play_logs').insert({
        user_game_id: entries.data![0]!.id,
        hours_played: 123,
        platform_played: 'Steam',
        play_method: 'other',
      });
      assert.equal(log.error, null);
      const pick = (slot: number, game_id: string | null) =>
        post('library', { action: 'favorite_slot', slot, game_id });
      assert.equal((await pick(4, ids[0])).status, 200);
      let favorite = await admin
        .from('user_games')
        .select('game_id,favorite_position,status,rating')
        .eq('user_id', id)
        .order('game_id');
      assert.equal(favorite.data!.find((e) => e.game_id === ids[0])!.favorite_position, 4);
      assert.equal(favorite.data!.find((e) => e.game_id === ids[3])!.favorite_position, 1);
      assert.equal(favorite.data!.find((e) => e.game_id === ids[0])!.status, 'playing');
      assert.equal(favorite.data!.find((e) => e.game_id === ids[0])!.rating, 8.5);
      assert.equal(
        (
          await admin
            .from('play_logs')
            .select('hours_played')
            .eq('user_game_id', entries.data![0]!.id)
            .single()
        ).data!.hours_played,
        123,
      );
      assert.equal((await pick(2, null)).status, 200);
      assert.equal((await pick(2, ids[29])).status, 200);
      favorite = await admin
        .from('user_games')
        .select('game_id,favorite_position,status,rating')
        .eq('user_id', id)
        .order('game_id');
      assert.equal(favorite.data!.find((e) => e.game_id === ids[29])!.status, 'backlog');
      assert.equal(favorite.data!.find((e) => e.game_id === ids[2])!.favorite_position, 3);
      assert.equal((await pick(5, ids[0])).status, 400);
      assert.equal((await pick(4, '00000000-0000-0000-0000-000000000000')).status, 400);
      assert.equal(
        (
          await admin
            .from('user_games')
            .select('favorite_position')
            .eq('user_id', id)
            .eq('game_id', ids[0])
            .single()
        ).data!.favorite_position,
        4,
      );
      const page1 = await fetch(`${base}/api/favorites`, { headers: { Cookie: cookie } });
      assert.equal(page1.status, 200, await page1.clone().text());
      const first = await page1.json();
      assert.equal(first.games.length, 24);
      assert.equal(typeof first.games[0].id, 'string');
      const second = await (
        await fetch(`${base}/api/favorites?offset=${first.nextOffset}`, {
          headers: { Cookie: cookie },
        })
      ).json();
      assert.equal(second.games.length, 6);
      assert.equal(
        new Set([...first.games, ...second.games].map((g: { id: string }) => g.id)).size,
        30,
      );
      const search = await (
        await fetch(`${base}/api/favorites?q=${encodeURIComponent(games.data![0]!.title)}`, {
          headers: { Cookie: cookie },
        })
      ).json();
      assert.ok(search.games.some((game: { id: string }) => game.id === ids[0]));
      assert.equal((await fetch(`${base}/api/favorites`)).status, 401);
      const other = await admin.from('profiles').select('id').neq('id', id).limit(1).single();
      assert.equal(other.error, null);
      const foreign = await client.storage
        .from('profiles')
        .upload(`${other.data!.id}/wallpaper.webp`, bytes, {
          contentType: 'image/webp',
          upsert: true,
        });
      assert.ok(foreign.error);
      const foreignProfile = await client
        .from('profiles')
        .update({ wallpaper_url: payload.wallpaper_url })
        .eq('id', other.data!.id)
        .select('id');
      assert.equal(foreignProfile.error, null);
      assert.deepEqual(foreignProfile.data, []);
      const publicHtml = await (await fetch(`${base}/players/${profile.data!.username}`)).text();
      assert.ok(!publicHtml.includes('Editar Top 4'));
    } finally {
      if (id) await admin.storage.from('profiles').remove([`${id}/wallpaper.webp`]);
      await client?.auth.signOut();
      if (id) assert.equal((await admin.auth.admin.deleteUser(id)).error, null);
    }
  },
);
