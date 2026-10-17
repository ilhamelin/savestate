// Runs against disposable, in-memory PostgreSQL; never connects to Supabase.
// Install PGlite outside the repo and point SAVESTATE_PGLITE_MODULE at its ESM entry.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

if (!process.env.SAVESTATE_PGLITE_MODULE)
  throw new Error('Set SAVESTATE_PGLITE_MODULE to an isolated PGlite runtime.');
const { PGlite } = await import(pathToFileURL(process.env.SAVESTATE_PGLITE_MODULE).href);
const db = new PGlite();
const root = new URL('../../supabase/migrations/', import.meta.url);
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage; create schema realtime;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    create function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.role',true),''),current_user::text) $$;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;
    create function storage.foldername(text) returns text[] language sql as $$ select string_to_array($1,'/') $$;
    create table realtime.messages(extension text);
    alter table realtime.messages enable row level security;
    create function realtime.topic() returns text language sql stable as $$ select current_setting('realtime.topic',true) $$;
    grant usage on schema auth,storage,realtime to anon,authenticated,service_role;
    grant select,insert,update,delete on storage.objects,realtime.messages to anon,authenticated;
    create publication supabase_realtime;
  `);
  const files = (await readdir(root)).filter((name) => name.endsWith('.sql')).sort();
  let existingData;
  for (const name of files) {
    if (name === '202610150034_database_audit_and_optimizations.sql') {
      await db.exec(`
        insert into auth.users(id) values ('44444444-4444-4444-8444-444444444444');
        insert into public.games(id,igdb_id,title,slug) values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd',998,'Existing audit game','existing-audit-game');
        insert into public.user_games(id,user_id,game_id) values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','44444444-4444-4444-8444-444444444444','dddddddd-dddd-4ddd-8ddd-dddddddddddd');
        insert into public.play_logs(user_game_id,platform_played,play_method,console_progress)
        select 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','PC','hardware',jsonb_build_object('kind',kind,'current',2,'total',10)
        from unnest(array['gamerscore','trophies','achievements']) as kind;
      `);
      existingData = await db.query('select id,console_progress from public.play_logs order by id');
    }
    await db.exec(await readFile(new URL(name, root), 'utf8'));
    console.log(`PASS migration ${name}`);
  }
  const migration = await readFile(
    new URL('202610150034_database_audit_and_optimizations.sql', root),
    'utf8',
  );
  const before = await db.query(
    "select indexname from pg_indexes where schemaname='public' order by indexname",
  );
  await db.exec(migration);
  const after = await db.query(
    "select indexname from pg_indexes where schemaname='public' order by indexname",
  );
  assert.deepEqual(after.rows, before.rows);
  assert.deepEqual(
    (await db.query('select id,console_progress from public.play_logs order by id')).rows,
    existingData.rows,
  );
  console.log('PASS migration 034 is repeatable without duplicate indexes');
  console.log('PASS existing progress records are preserved');

  const indexes = (
    await db.query("select indexname,indexdef from pg_indexes where schemaname='public'")
  ).rows;
  const unread = indexes.find((row) => row.indexname === 'idx_notifications_unread');
  assert.match(unread.indexdef, /\(user_id, created_at DESC\).*WHERE \(read_at IS NULL\)/);
  assert.ok(indexes.some((row) => row.indexname === 'idx_party_requests_user'));
  // Every FK on the audited tables must have a valid, non-expression leading index.
  const missing = await db.query(`
    select c.conrelid::regclass::text as table_name, c.conname
    from pg_constraint c join pg_class t on t.oid=c.conrelid
    where c.contype='f' and t.relname = any(array['follows','friendships','friend_messages','notifications','review_comments','review_reactions','list_items','activity_logs','post_reactions','post_comments','forum_replies','forum_reactions','user_badges','duel_votes','party_requests','user_xp_events','user_screen_entries','user_vault_media'])
    and not exists (select 1 from pg_index i where i.indrelid=c.conrelid and i.indisvalid and i.indisready and i.indnkeyatts >= cardinality(c.conkey)
      and array(select k from unnest(i.indkey::smallint[]) with ordinality u(k,n) where n <= cardinality(c.conkey) order by n) = c.conkey);
  `);
  assert.deepEqual(missing.rows, []);
  const policies = (
    await db.query(
      "select tablename,policyname,cmd,qual,with_check from pg_policies where schemaname='public' and tablename in ('notifications','profiles','user_games','user_screen_entries','friend_messages','global_chat_messages')",
    )
  ).rows;
  assert.equal(policies.find((p) => p.policyname === 'library_add').cmd, 'INSERT');
  assert.equal(policies.find((p) => p.policyname === 'library_edit').cmd, 'UPDATE');
  for (const policy of policies.filter((p) =>
    [
      'notifications_read',
      'notifications_mark',
      'profiles_edit',
      'library_add',
      'library_edit',
      'library_remove',
      'screen_owner_select',
      'screen_owner_insert',
      'screen_owner_update',
      'screen_owner_delete',
      'friend_messages_select',
      'friend_messages_insert',
      'global_chat_insert',
    ].includes(p.policyname),
  )) {
    for (const expression of [policy.qual, policy.with_check].filter(Boolean))
      assert.match(expression, /SELECT auth\.uid\(\)/);
  }
  console.log('PASS foreign-key coverage, unread predicate and scalar RLS expressions');
  await db.exec(await readFile(new URL('./database-audit.sql', import.meta.url), 'utf8'));
  console.log(
    'PASS library UPDATE, cross-user denials, accepted-friend messaging, private Screen, notifications, global-chat ownership and all three progress kinds',
  );
} finally {
  await db.close();
}
