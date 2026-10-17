import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const modulePath = process.env.SAVESTATE_PGLITE_MODULE;
if (!modulePath)
  throw new Error('Define SAVESTATE_PGLITE_MODULE para la prueba PostgreSQL aislada.');
const { PGlite } = await import(pathToFileURL(modulePath).href);
const db = new PGlite();
try {
  await db.exec('create role anon; create role authenticated; create role service_role;');
  const sql = await readFile('supabase/migrations/202610160035_gatekeeper_attempts.sql', 'utf8');
  await db.exec(sql);
  await db.exec(sql);
  const hash = 'a'.repeat(64);
  for (let i = 1; i <= 7; i++) {
    const result = await db.query('select public.claim_gatekeeper_attempt($1) as allowed', [hash]);
    assert.equal(result.rows[0].allowed, i <= 5);
  }
  await db.query(
    "update public.gatekeeper_attempts set window_start = now() - interval '61 seconds' where key_hash=$1",
    [hash],
  );
  assert.equal(
    (await db.query('select public.claim_gatekeeper_attempt($1) as allowed', [hash])).rows[0]
      .allowed,
    true,
  );
  const parallel = await Promise.all(
    Array.from({ length: 8 }, () =>
      db.query('select public.claim_gatekeeper_attempt($1) as allowed', ['b'.repeat(64)]),
    ),
  );
  assert.equal(parallel.filter((result) => result.rows[0].allowed).length, 5);
  const privileges = await db.query(
    "select has_function_privilege('anon','public.claim_gatekeeper_attempt(text)','execute') as anon, has_function_privilege('authenticated','public.claim_gatekeeper_attempt(text)','execute') as authenticated, has_function_privilege('service_role','public.claim_gatekeeper_attempt(text)','execute') as service",
  );
  assert.deepEqual(privileges.rows[0], { anon: false, authenticated: false, service: true });
  await assert.rejects(db.query('select public.claim_gatekeeper_attempt($1)', ['fake']));
  console.log(
    'Guardian SQL: idempotence, atomic attempt limit, reset and service-only permissions passed.',
  );
} finally {
  await db.close();
}
