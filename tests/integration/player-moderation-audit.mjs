// Disposable PostgreSQL only: this script never connects to Supabase or R2.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
if (!process.env.SAVESTATE_PGLITE_MODULE) throw new Error('Define SAVESTATE_PGLITE_MODULE.');
const { PGlite } = await import(pathToFileURL(process.env.SAVESTATE_PGLITE_MODULE).href);
const db = new PGlite();
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
  const root = new URL('../../supabase/migrations/', import.meta.url);
  for (const name of (await readdir(root)).filter((name) => name.endsWith('.sql')).sort())
    await db.exec(await readFile(new URL(name, root), 'utf8'));
  await db.exec(await readFile(new URL('202610160036_player_moderation.sql', root), 'utf8'));
  const target = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const other = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  await db.exec(`
    insert into auth.users values ('${target}'),('${other}');
    insert into public.profiles(id,username,level,xp,equipped_title,equipped_frame,terminal_status)
    values ('${target}','moderation_test',50,100000,'Final Boss','boss','reset me'),('${other}','control_test',1,0,'Insert Coin','default','keep me')
    on conflict(id) do update set username=excluded.username,level=excluded.level,xp=excluded.xp,equipped_title=excluded.equipped_title,equipped_frame=excluded.equipped_frame,terminal_status=excluded.terminal_status;
    insert into public.games(id,igdb_id,title,slug) values ('cccccccc-cccc-cccc-cccc-cccccccccccc',1234,'Test game','moderation-game');
    insert into public.user_games(id,user_id,game_id) values
      ('dddddddd-dddd-dddd-dddd-dddddddddddd','${target}','cccccccc-cccc-cccc-cccc-cccccccccccc'),
      ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee','${other}','cccccccc-cccc-cccc-cccc-cccccccccccc');
    insert into public.play_logs(user_game_id,platform_played,play_method) values ('dddddddd-dddd-dddd-dddd-dddddddddddd','PC','hardware');
    insert into public.user_xp_events(user_id,amount,action,reference_id) values ('${target}',300,'platinum','old-achievement');
    insert into public.user_vault_media(user_id,r2_key,file_name,file_size,mime_type) values ('${target}','${target}/test.png','test.png',100,'image/png');
  `);
  assert.equal(
    (await db.query('select public.reset_player_account($1) as ok', [target])).rows[0].ok,
    true,
  );
  assert.deepEqual(
    (
      await db.query(
        'select level,xp,equipped_title,equipped_frame,terminal_status,theme_color,social_links from public.profiles where id=$1',
        [target],
      )
    ).rows[0],
    {
      level: 1,
      xp: 0,
      equipped_title: 'Insert Coin',
      equipped_frame: 'default',
      terminal_status: '',
      theme_color: 'cyan',
      social_links: {},
    },
  );
  for (const table of ['user_games', 'user_badges', 'user_vault_media', 'user_xp_events'])
    assert.equal(
      (await db.query(`select count(*)::int as n from public.${table} where user_id=$1`, [target]))
        .rows[0].n,
      0,
    );
  assert.equal((await db.query('select count(*)::int as n from public.play_logs')).rows[0].n, 0);
  assert.equal(
    (await db.query('select count(*)::int as n from auth.users where id=$1', [target])).rows[0].n,
    1,
  );
  assert.equal(
    (await db.query('select count(*)::int as n from public.user_games where user_id=$1', [other]))
      .rows[0].n,
    1,
  );
  const old = '2026-10-16T10:00:00Z',
    fresh = '2026-10-16T10:00:20Z';
  await db.query('update public.profiles set access_locked=true,access_locked_at=$2 where id=$1', [
    target,
    fresh,
  ]);
  assert.equal(
    (await db.query('select public.acknowledge_player_gate($1,$2) as ok', [target, old])).rows[0]
      .ok,
    false,
  );
  assert.equal(
    (await db.query('select public.acknowledge_player_gate($1,$2) as ok', [target, fresh])).rows[0]
      .ok,
    true,
  );
  assert.equal(
    (await db.query('select access_locked from public.profiles where id=$1', [target])).rows[0]
      .access_locked,
    false,
  );
  assert.ok(
    (await db.query('select access_locked_at from public.profiles where id=$1', [target])).rows[0]
      .access_locked_at,
  );
  for (const fn of ['reset_player_account(uuid)', 'acknowledge_player_gate(uuid,timestamptz)']) {
    for (const role of ['anon', 'authenticated'])
      assert.equal(
        (
          await db.query('select has_function_privilege($1,$2,$3) as ok', [
            role,
            `public.${fn}`,
            'execute',
          ])
        ).rows[0].ok,
        false,
      );
    assert.equal(
      (
        await db.query('select has_function_privilege($1,$2,$3) as ok', [
          'service_role',
          `public.${fn}`,
          'execute',
        ])
      ).rows[0].ok,
      true,
    );
  }
  for (const column of ['access_locked', 'access_locked_at'])
    assert.equal(
      (
        await db.query('select has_column_privilege($1,$2,$3,$4) as ok', [
          'authenticated',
          'public.profiles',
          column,
          'update',
        ])
      ).rows[0].ok,
      false,
    );
  await db.query('delete from auth.users where id=$1', [target]);
  assert.equal(
    (await db.query('select count(*)::int as n from public.profiles where id=$1', [target])).rows[0]
      .n,
    0,
  );
  assert.equal(
    (await db.query('select terminal_status from public.profiles where id=$1', [other])).rows[0]
      .terminal_status,
    'keep me',
  );
  console.log(
    'Moderation SQL passed: full migrations, idempotence, reset/cascades, credentials retained, concurrent lock CAS and service-only permissions.',
  );
  const suiteSql = await readFile(new URL('202610160037_guardian_suite.sql', root), 'utf8');
  await db.exec(suiteSql);
  assert.equal(
    (await db.query("select value from public.system_switches where key='gatekeeper_enabled'"))
      .rows[0].value,
    false,
  );
  const award = await db.query('select * from public.grant_player_xp($1,100)', [other]);
  assert.deepEqual(award.rows[0], { new_xp: 100, new_level: 2 });
  await Promise.all(
    Array.from({ length: 5 }, () =>
      db.query('select * from public.grant_player_xp($1,50)', [other]),
    ),
  );
  assert.equal(
    (await db.query('select xp from public.profiles where id=$1', [other])).rows[0].xp,
    350,
  );
  for (const amount of [0, -1, 100001, null])
    await assert.rejects(db.query('select * from public.grant_player_xp($1,$2)', [other, amount]));
  await Promise.all(
    ['one', 'two', 'three'].map((message) =>
      db.query("select public.guardian_broadcast($1,'info',true,$2)", [message, other]),
    ),
  );
  assert.equal(
    (await db.query('select count(*)::int as n from public.system_broadcasts where active')).rows[0]
      .n,
    1,
  );
  await db.query("select public.guardian_broadcast('','info',false,$1)", [other]);
  assert.equal(
    (await db.query('select count(*)::int as n from public.system_broadcasts where active')).rows[0]
      .n,
    0,
  );
  await db.query("select public.guardian_set_switch('registrations_open','false',$1)", [other]);
  await assert.rejects(
    db.query('insert into auth.users values($1)', ['ffffffff-ffff-ffff-ffff-ffffffffffff']),
    /registro.*cerrado/i,
  );
  await db.query("select public.guardian_set_switch('registrations_open','true',$1)", [other]);
  await db.query('insert into auth.users values($1)', ['ffffffff-ffff-ffff-ffff-ffffffffffff']);
  await assert.rejects(
    db.query("select public.guardian_set_switch('seasonal_theme','true',$1)", [other]),
  );
  await db.query("select public.guardian_set_switch('seasonal_theme','\"classic\"',$1)", [other]);
  await db.exec(suiteSql);
  assert.equal(
    (await db.query("select value from public.system_switches where key='seasonal_theme'")).rows[0]
      .value,
    'classic',
  );
  for (let i = 0; i < 8; i++)
    await db.query('select public.claim_gatekeeper_attempt($1)', ['c'.repeat(64)]);
  assert.equal(
    (
      await db.query(
        "select count(*)::int as n from public.security_audit_logs where event='gatekeeper_rate_limited'",
      )
    ).rows[0].n,
    1,
  );
  for (const table of ['security_audit_logs', 'system_switches', 'system_broadcasts']) {
    for (const role of ['anon', 'authenticated'])
      for (const privilege of ['insert', 'update', 'delete'])
        assert.equal(
          (
            await db.query('select has_table_privilege($1,$2,$3) as ok', [
              role,
              `public.${table}`,
              privilege,
            ])
          ).rows[0].ok,
          false,
        );
  }
  for (const fn of [
    'grant_player_xp(uuid,int)',
    'guardian_telemetry()',
    'guardian_set_switch(text,jsonb,uuid)',
    'guardian_broadcast(text,text,boolean,uuid)',
  ])
    for (const role of ['anon', 'authenticated'])
      assert.equal(
        (
          await db.query('select has_function_privilege($1,$2,$3) as ok', [
            role,
            `public.${fn}`,
            'execute',
          ])
        ).rows[0].ok,
        false,
      );
  const hardwareSql = await readFile(
    new URL('202610160038_guardian_telemetry_hardware.sql', root),
    'utf8',
  );
  await db.exec(hardwareSql);
  await db.exec(hardwareSql);
  const snapshot = (await db.query('select public.guardian_telemetry() as snapshot')).rows[0]
    .snapshot;
  assert.equal(snapshot.users_total, 2);
  assert.equal(typeof snapshot.db_connections_active, 'number');
  assert.ok(snapshot.db_connections_max > 0);
  assert.ok(snapshot.db_size_bytes > 0);
  assert.ok(
    snapshot.db_cache_hit_ratio === null ||
      (snapshot.db_cache_hit_ratio >= 0 && snapshot.db_cache_hit_ratio <= 100),
  );
  for (const role of ['anon', 'authenticated']) {
    assert.equal(
      (
        await db.query(
          "select has_function_privilege($1,'public.guardian_telemetry()','execute') as ok",
          [role],
        )
      ).rows[0].ok,
      false,
    );
  }
  assert.equal(
    (
      await db.query(
        "select has_function_privilege('service_role','public.guardian_telemetry()','execute') as ok",
      )
    ).rows[0].ok,
    true,
  );
  // Tactical suite: isolated users, no signals or XP are sent to the real project.
  const tacticalSql = await readFile(
    new URL('202610160039_guardian_kick_whisper_doublexp.sql', root),
    'utf8',
  );
  await db.exec(tacticalSql);
  await db.query("select public.guardian_set_switch('double_xp','true',$1)", [other]);
  await db.exec(tacticalSql);
  assert.equal(
    (await db.query("select value from public.system_switches where key='double_xp'")).rows[0]
      .value,
    true,
  );
  const xpBefore = (await db.query('select xp from public.profiles where id=$1', [other])).rows[0]
    .xp;
  const doubled = (await db.query('select * from public.grant_player_xp($1,50)', [other])).rows[0];
  assert.equal(doubled.new_xp, xpBefore + 100);
  await db.exec("select set_config('request.jwt.claim.role','service_role',false)");
  const gameplayAward = (
    await db.query("select public.award_xp($1,75,'review','double-xp-review') as award", [other])
  ).rows[0].award;
  assert.equal(gameplayAward.awarded, 150);
  assert.equal(
    (await db.query("select public.award_xp($1,75,'review','double-xp-review') as award", [other]))
      .rows[0].award.reason,
    'already_awarded',
  );
  await db.query("select public.guardian_set_switch('double_xp','false',$1)", [other]);
  const normal = (await db.query('select * from public.grant_player_xp($1,50)', [other])).rows[0];
  assert.equal(normal.new_xp, doubled.new_xp + 150 + 50);
  await assert.rejects(
    db.query("select public.award_xp($1,150,'review','tampered')", [other]),
    /Invalid XP/,
  );
  await db.exec(`
    create table public.test_operator_delivery(payload jsonb, event text, topic text, private boolean);
    create function realtime.send(payload jsonb,event text,topic text,private boolean) returns void language sql as $$
      insert into public.test_operator_delivery values(payload,event,topic,private);
    $$;
  `);
  const recipient = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
  await db.query(
    "insert into public.profiles(id,username) values($1,'signal_recipient') on conflict(id) do nothing",
    [recipient],
  );
  await assert.rejects(
    db.query("select public.guardian_operator_signal($1,$1,'operator_kick',null)", [other]),
    /Inmunidad/,
  );
  await assert.rejects(
    db.query("select public.guardian_operator_signal($1,$2,'operator_whisper','')", [
      recipient,
      other,
    ]),
  );
  await db.query(
    "select public.guardian_operator_signal($1,$2,'operator_whisper','Hola privado')",
    [recipient, other],
  );
  await db.query("select public.guardian_operator_signal($1,$2,'operator_kick',null)", [
    recipient,
    other,
  ]);
  const delivery = (await db.query('select * from public.test_operator_delivery order by event'))
    .rows;
  assert.equal(delivery.length, 2);
  assert.ok(
    delivery.every((row) => row.private && row.topic === `savestate:operator:${recipient}`),
  );
  assert.equal(
    delivery.find((row) => row.event === 'operator_whisper').payload.message,
    'Hola privado',
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from public.security_audit_logs where event='operator_whisper' and metadata ? 'message'",
      )
    ).rows[0].n,
    0,
  );
  for (const role of ['anon', 'authenticated']) {
    assert.equal(
      (
        await db.query(
          "select has_function_privilege($1,'public.guardian_operator_signal(uuid,uuid,text,text)','execute') as ok",
          [role],
        )
      ).rows[0].ok,
      false,
    );
  }
  await db.exec(`
    insert into realtime.messages(extension) values('broadcast');
    create policy test_broad_receive on realtime.messages for select to authenticated using(true);
    create policy test_broad_send on realtime.messages for insert to authenticated with check(true);
  `);
  await db.query("select set_config('realtime.topic',$1,false)", [
    `savestate:operator:${recipient}`,
  ]);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [recipient]);
  await db.exec('set role authenticated');
  assert.equal((await db.query('select count(*)::int n from realtime.messages')).rows[0].n, 1);
  await assert.rejects(
    db.query("insert into realtime.messages(extension) values('broadcast')"),
    /row-level security/,
  );
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [other]);
  await db.exec('set role authenticated');
  assert.equal((await db.query('select count(*)::int n from realtime.messages')).rows[0].n, 0);
  await db.exec('reset role');
  console.log(
    'Tactical SQL passed: double/normal XP, deduplication, idempotence, self-kick immunity, private signals, anti-forgery and recipient isolation.',
  );
  console.log(
    'Guardian suite SQL passed: idempotence, atomic XP/broadcasts, registration guard, validated switches, private logs, limiter audit and telemetry.',
  );
} finally {
  await db.close();
}
