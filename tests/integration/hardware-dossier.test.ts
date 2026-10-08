import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
test(
  'Hardware and dossier live: profile save, all logs, RLS and private card access',
  { skip: process.env.TEST_HARDWARE_LIVE !== '1', timeout: 120000 },
  async () => {
    const base = process.env.TEST_APP_URL!;
    assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!,
      key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });
    let id: string | undefined;
    let client: ReturnType<typeof createServerClient> | undefined;
    try {
      const created = await admin.auth.admin.createUser({
        email: `hardware_${randomBytes(8).toString('hex')}@example.com`,
        password: randomBytes(24).toString('base64url'),
        email_confirm: true,
      });
      assert.equal(created.error, null);
      id = created.data.user!.id;
      const cookies = new Map<string, string>();
      client = createServerClient(url, key, {
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
      const p = await admin.from('profiles').select('*').eq('id', id).single();
      assert.equal(p.error, null);
      const payload = {
        ...p.data,
        owned_platforms: [' PC / Steam ', 'PS2', 'ps2', 'Sega Dreamcast'],
      };
      async function save(data: unknown) {
        return fetch(`${base}/api/profile`, {
          method: 'POST',
          headers: { Cookie: cookie, Origin: base, 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      }
      const saved = await save(payload);
      assert.equal(saved.status, 200, await saved.clone().text());
      assert.deepEqual(
        (await admin.from('profiles').select('owned_platforms').eq('id', id).single()).data
          ?.owned_platforms,
        ['PC / Steam', 'PS2', 'Sega Dreamcast'],
      );
      assert.equal((await save({ ...payload, owned_platforms: ['x'.repeat(49)] })).status, 400);
      const games = await admin.from('games').select('id').order('id').limit(6);
      assert.equal(games.error, null);
      assert.equal(games.data!.length, 6);
      const statuses = ['cleared', 'platinum', 'playing', 'dropped', 'backlog', 'wishlist'];
      const entries = await admin
        .from('user_games')
        .insert(
          games.data!.map((game, i) => ({
            user_id: id,
            game_id: game.id,
            status: statuses[i],
            favorite_position: i < 4 ? i + 1 : null,
          })),
        )
        .select('id,status');
      assert.equal(entries.error, null);
      const cleared = entries.data!.find((e) => e.status === 'cleared')!;
      const logs = await admin.from('play_logs').insert(
        Array.from({ length: 1001 }, () => ({
          user_game_id: cleared.id,
          hours_played: 0.1,
          platform_played: 'PS2',
          play_method: 'hardware',
        })),
      );
      assert.equal(logs.error, null);
      const publicPage = await fetch(`${base}/players/${p.data!.username}`);
      assert.equal(publicPage.status, 200);
      const html = await publicPage.text();
      assert.match(html, /Dossier de métricas/);
      assert.match(html, /100\.1/);
      assert.match(html, /50\.0/);
      assert.match(html, /Descargar Memory Card/);
      assert.match(html, /Sega Dreamcast/);
      // Direct writes still use per-owner RLS despite the new column grant.
      const other = await admin
        .from('profiles')
        .select('id,owned_platforms')
        .neq('id', id)
        .limit(1)
        .single();
      assert.equal(other.error, null);
      const foreign = await client
        .from('profiles')
        .update({ owned_platforms: ['UNAUTHORIZED'] })
        .eq('id', other.data!.id)
        .select('id');
      assert.equal(foreign.error, null);
      assert.deepEqual(foreign.data, []);
      assert.deepEqual(
        (await admin.from('profiles').select('owned_platforms').eq('id', other.data!.id).single())
          .data?.owned_platforms,
        other.data!.owned_platforms,
      );
      assert.equal((await save({ ...payload, library_private: true })).status, 200);
      const hidden = await fetch(`${base}/players/${p.data!.username}`);
      const hiddenHtml = await hidden.text();
      assert.equal(hidden.status, 200);
      assert.ok(!hiddenHtml.includes('Dossier de métricas'));
      assert.ok(!hiddenHtml.includes('Descargar Memory Card'));
      assert.match(hiddenHtml, /Sega Dreamcast/);
      const own = await fetch(`${base}/players/${p.data!.username}`, {
        headers: { Cookie: cookie },
      });
      assert.equal(own.status, 200);
      assert.match(await own.text(), /Descargar Memory Card/);
    } finally {
      await client?.auth.signOut();
      if (id) assert.equal((await admin.auth.admin.deleteUser(id)).error, null);
    }
  },
);
