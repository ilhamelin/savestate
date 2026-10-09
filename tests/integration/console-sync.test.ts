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
        assert.equal(preview[0].hours, 0);
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
      assert.deepEqual((await db.from('user_games').select('id').eq('user_id', id)).data, []);
    } finally {
      await db.auth.signOut();
      assert.equal((await admin.auth.admin.deleteUser(id)).error, null);
    }
  },
);
