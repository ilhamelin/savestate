// Optional verification tool; not an application dependency.
// SAVESTATE_PGLITE_MODULE points to an externally installed PGlite ESM module.
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
if (!process.env.SAVESTATE_PGLITE_MODULE)
  throw new Error('Set SAVESTATE_PGLITE_MODULE to a temporary PostgreSQL verification runtime.');
const { PGlite } = await import(pathToFileURL(process.env.SAVESTATE_PGLITE_MODULE).href);
const db = new PGlite();
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;
    create function storage.foldername(text) returns text[] language sql as $$ select string_to_array($1,'/') $$;
    grant usage on schema auth,storage to anon,authenticated,service_role;
    grant select,insert,update,delete on storage.objects to anon,authenticated;
    create publication supabase_realtime;
  `);
  for (const file of [
    '202610070001_initial.sql',
    '202610070002_notifications_moderation.sql',
    '202610070003_hardening.sql',
  ]) {
    await db.exec(
      await readFile(new URL(`../../supabase/migrations/${file}`, import.meta.url), 'utf8'),
    );
    console.log(`PASS migration ${file}`);
  }
  await db.exec(await readFile(new URL('./rls.sql', import.meta.url), 'utf8'));
  console.log(
    'PASS SQL privacy, follow vs friendship, revocation, atomic rating, Top 4, Play Logs, ownership and notifications',
  );
} finally {
  await db.close();
}
