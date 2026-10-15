import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { S3Client, HeadObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

test(
  'Vault live: session, signed direct upload, confirmation, RLS and atomic quota',
  { skip: process.env.TEST_VAULT_LIVE !== '1', timeout: 180000 },
  async () => {
    const base = process.env.TEST_APP_URL!;
    assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });
    const r2 = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
      requestChecksumCalculation: 'WHEN_REQUIRED',
    });
    const users: string[] = [],
      keys: string[] = [];
    const sessions: { db: ReturnType<typeof createServerClient>; cookie: string }[] = [];
    async function request(index: number, method: string, data?: unknown) {
      return fetch(`${base}/api/vault`, {
        method,
        headers: {
          Cookie: sessions[index]!.cookie,
          Origin: base,
          'Content-Type': 'application/json',
        },
        body: data ? JSON.stringify(data) : undefined,
      });
    }
    try {
      for (let i = 0; i < 2; i++) {
        const email = `qa_vault_${randomBytes(8).toString('hex')}@example.com`;
        const created = await admin.auth.admin.createUser({
          email,
          password: randomBytes(32).toString('base64url'),
          email_confirm: true,
        });
        assert.equal(created.error, null);
        users.push(created.data.user!.id);
        const cookies = new Map<string, string>();
        const db = createServerClient(url, anon, {
          cookies: {
            getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
            setAll: (rows) => rows.forEach(({ name, value }) => cookies.set(name, value)),
          },
        });
        const link = await admin.auth.admin.generateLink({ type: 'magiclink', email });
        assert.equal(link.error, null);
        assert.equal(
          (
            await db.auth.verifyOtp({
              token_hash: link.data.properties!.hashed_token,
              type: 'email',
            })
          ).error,
          null,
        );
        sessions.push({
          db,
          cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join('; '),
        });
      }
      assert.equal((await fetch(`${base}/api/vault`)).status, 401);
      assert.equal(
        (await request(0, 'POST', { fileName: 'x.svg', fileSize: 10, mimeType: 'image/svg+xml' }))
          .status,
        400,
      );
      const foreignOrigin = await fetch(`${base}/api/vault`, {
        method: 'POST',
        headers: {
          Cookie: sessions[0]!.cookie,
          Origin: 'https://evil.test',
          'Content-Type': 'application/json',
        },
        body: '{}',
      });
      assert.equal(foreignOrigin.status, 403);
      const image = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jq1sAAAAASUVORK5CYII=',
        'base64',
      );
      const preparedResponse = await request(0, 'POST', {
        fileName: 'qa.png',
        fileSize: image.length,
        mimeType: 'image/png',
      });
      assert.equal(preparedResponse.status, 200, await preparedResponse.clone().text());
      const prepared = (await preparedResponse.json()).data;
      keys.push(prepared.r2Key);
      assert.ok(prepared.r2Key.startsWith(users[0] + '/'));
      assert.equal((await request(1, 'PUT', { id: prepared.id })).status, 404);
      assert.equal((await request(0, 'PUT', { id: prepared.id })).status, 409);
      const upload = await fetch(prepared.presignedUrl, {
        method: 'PUT',
        headers: prepared.headers,
        body: image,
      });
      assert.equal(upload.status, 200);
      assert.equal(
        (
          await fetch(prepared.presignedUrl, {
            method: 'PUT',
            headers: prepared.headers,
            body: image,
          })
        ).status,
        412,
      );
      const confirmed = await request(0, 'PUT', { id: prepared.id });
      assert.equal(confirmed.status, 200, await confirmed.clone().text());
      const snapshot = (await confirmed.json()).data;
      assert.equal(snapshot.items.length, 1);
      assert.equal(snapshot.storage.used_bytes, image.length);
      assert.equal(snapshot.storage.reserved_bytes, 0);
      assert.equal((await request(0, 'PUT', { id: prepared.id })).status, 200);
      assert.equal((await request(1, 'GET')).status, 200);
      assert.deepEqual((await (await request(1, 'GET')).json()).items, []);
      assert.equal((await request(1, 'DELETE', { id: prepared.id })).status, 404);
      const deniedInsert = await sessions[0]!.db.from('user_vault_media').insert({
        user_id: users[0],
        r2_key: `${users[0]}/fake.png`,
        file_name: 'fake.png',
        file_size: 1,
        mime_type: 'image/png',
      });
      assert.ok(deniedInsert.error);
      assert.ok(
        (await sessions[1]!.db.rpc('get_user_vault_storage', { p_user_id: users[0] })).error,
      );
      assert.ok(
        (
          await sessions[0]!.db.rpc('reserve_vault_upload', {
            p_user_id: users[0],
            p_key: 'fake',
            p_name: 'fake',
            p_size: 1,
            p_mime: 'image/png',
          })
        ).error,
      );
      const concurrent = await Promise.all(
        [0, 1].map(() =>
          request(0, 'POST', {
            fileName: 'large.mp4',
            fileSize: 60 * 1024 * 1024,
            mimeType: 'video/mp4',
          }),
        ),
      );
      assert.deepEqual(concurrent.map((result) => result.status).sort(), [200, 403]);
      const reserved = (await (await request(0, 'GET')).json()).storage;
      assert.equal(reserved.reserved_bytes, 60 * 1024 * 1024);
      // QA only: expire our own upload authorization so the deletion endpoint can be tested now.
      assert.equal(
        (
          await admin
            .from('user_vault_media')
            .update({ created_at: new Date(Date.now() - 600000).toISOString() })
            .eq('id', prepared.id)
            .eq('user_id', users[0])
        ).error,
        null,
      );
      const deleted = await request(0, 'DELETE', { id: prepared.id });
      assert.equal(deleted.status, 200, await deleted.clone().text());
      assert.equal((await deleted.json()).data.storage.used_bytes, 0);
      await assert.rejects(() =>
        r2.send(new HeadObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: prepared.r2Key })),
      );
    } finally {
      for (const key of keys)
        await r2.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key }));
      for (const id of users) assert.equal((await admin.auth.admin.deleteUser(id)).error, null);
    }
  },
);
