import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

test(
  'QoL real: paginated hours, game-linked community privacy and debate preselection',
  { skip: process.env.TEST_QOL_LIVE !== '1', timeout: 120000 },
  async () => {
    const base = process.env.TEST_APP_URL!;
    assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!,
      key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });
    let userId: string | undefined;
    let client: ReturnType<typeof createServerClient> | undefined;
    try {
      const created = await admin.auth.admin.createUser({
        email: `qol_${randomBytes(8).toString('hex')}@example.com`,
        password: randomBytes(24).toString('base64url'),
        email_confirm: true,
      });
      assert.equal(created.error, null);
      userId = created.data.user!.id;
      const cookies = new Map<string, string>();
      client = createServerClient(url, key, {
        cookies: {
          getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
          setAll: (rows) => rows.forEach(({ name, value }) => cookies.set(name, value)),
        },
      });
      // Admin-generated link provides a disposable test session without changing credentials.
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
      const games = await admin.from('games').select('id,slug,title').order('id').limit(2);
      assert.equal(games.error, null);
      assert.equal(games.data!.length, 2);
      const [game, other] = games.data!;
      const entry = await admin
        .from('user_games')
        .insert({ user_id: userId, game_id: game!.id, status: 'backlog' })
        .select('id')
        .single();
      assert.equal(entry.error, null);
      const logs = await admin.from('play_logs').insert(
        Array.from({ length: 1001 }, () => ({
          user_game_id: entry.data!.id,
          hours_played: 0.1,
          platform_played: 'PC',
          play_method: 'hardware',
        })),
      );
      assert.equal(logs.error, null);
      const titles = [`QoL public ${userId}`, `QoL private ${userId}`, `QoL unrelated ${userId}`];
      const posts = await admin.from('posts').insert(
        titles.map((title, i) => ({
          user_id: userId,
          game_id: i === 2 ? other!.id : game!.id,
          title,
          content: 'Prueba temporal de integración',
          category: 'epic',
          media_type: 'youtube',
          youtube_video_id: 'dQw4w9WgXcQ',
          is_private: i === 1,
        })),
      );
      assert.equal(posts.error, null);
      const library = await fetch(`${base}/library`, { headers: { Cookie: cookie } });
      assert.equal(library.status, 200);
      const libraryHtml = await library.text();
      assert.match(libraryHtml, /100\.1/);
      assert.match(libraryHtml, /h acumuladas en tus partidas/);
      const response = await fetch(`${base}/games/${game!.slug}`);
      assert.equal(response.status, 200);
      const html = await response.text();
      assert.ok(html.includes(titles[0]!));
      assert.ok(!html.includes(titles[1]!));
      assert.ok(!html.includes(titles[2]!));
      assert.match(html, /youtube-nocookie\.com\/embed/);
      const debate = await fetch(`${base}/forum/general-gaming?game=${game!.id}`, {
        headers: { Cookie: cookie },
      });
      assert.equal(debate.status, 200);
      const debateHtml = await debate.text();
      assert.match(debateHtml, /Cerrar editor/);
      assert.match(debateHtml, /Juego: /);
      assert.ok(debateHtml.includes(game!.title.replaceAll('&', '&amp;')));
      const anon = await fetch(`${base}/forum/general-gaming?game=${game!.id}`);
      assert.ok((await anon.text()).includes(encodeURIComponent(`?game=${game!.id}`)));
    } finally {
      await client?.auth.signOut();
      if (userId) assert.equal((await admin.auth.admin.deleteUser(userId)).error, null);
    }
  },
);
