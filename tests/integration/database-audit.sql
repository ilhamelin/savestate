begin;
insert into auth.users(id) values ('11111111-1111-4111-8111-111111111111'), ('22222222-2222-4222-8222-222222222222'), ('33333333-3333-4333-8333-333333333333');
insert into public.games(id,igdb_id,title,slug) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',991,'Audit game','audit-game'),('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',992,'Other game','other-game');
insert into public.friendships(sender_id,receiver_id,status) values ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','accepted');
insert into public.notifications(id,user_id,actor_id,kind) values ('ffffffff-ffff-4fff-8fff-ffffffffffff','11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','follow');
insert into public.user_games(id,user_id,game_id) values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1');
insert into public.play_logs(id,user_game_id,platform_played,play_method) values ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1','PC','hardware');
do $$
declare kind text; invalid jsonb;
begin
  foreach kind in array array['gamerscore','trophies','achievements'] loop
    update public.play_logs set console_progress=jsonb_build_object('kind',kind,'current',0,'total',10);
  end loop;
  foreach invalid in array array[
    '{"kind":null,"current":1,"total":2}'::jsonb,
    '{"kind":"other","current":1,"total":2}'::jsonb,
    '{"kind":"achievements","current":"invalid","total":2}'::jsonb,
    '{"kind":"achievements","current":1.5,"total":2}'::jsonb,
    '{"kind":"achievements","current":-1,"total":2}'::jsonb,
    '{"kind":"trophies","current":1,"total":0}'::jsonb,
    '{"kind":"gamerscore","current":10000001,"total":2}'::jsonb,
    '{"current":1,"total":2}'::jsonb, 'null'::jsonb, '[]'::jsonb
  ] loop
    begin
      update public.play_logs set console_progress=invalid;
      raise exception 'Invalid progress accepted: %',invalid;
    exception when check_violation then null;
    end;
  end loop;
end $$;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
set local role authenticated;
update public.profiles set terminal_status='Owner audit update' where id=auth.uid();
update public.notifications set read_at=now() where id='ffffffff-ffff-4fff-8fff-ffffffffffff';
do $$ begin
  if not exists(select 1 from public.profiles where id=auth.uid() and terminal_status='Owner audit update') then raise exception 'Own profile UPDATE lost'; end if;
  if not exists(select 1 from public.notifications where id='ffffffff-ffff-4fff-8fff-ffffffffffff' and read_at is not null) then raise exception 'Own notification UPDATE lost'; end if;
end $$;
update public.user_games set status='cleared',rating=9 where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
do $$ begin
  if not exists(select 1 from public.user_games where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1' and status='cleared') then raise exception 'Owner lost UPDATE permission'; end if;
end $$;
insert into public.user_games(user_id,game_id) values (auth.uid(),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2');
insert into public.friend_messages(sender_id,receiver_id,content) values (auth.uid(),'22222222-2222-4222-8222-222222222222','Accepted friends only');
do $$ begin
  begin
    insert into public.friend_messages(sender_id,receiver_id,content) values(auth.uid(),'33333333-3333-4333-8333-333333333333','Should fail');
    raise exception 'Messaging without friendship accepted';
  exception when insufficient_privilege then null; end;
end $$;
insert into public.user_screen_entries(user_id,tmdb_id,media_type,title) values(auth.uid(),1,'movie','Private audit entry');
update public.user_screen_entries set title='Updated private audit entry' where user_id=auth.uid();
do $$ begin
  if not exists(select 1 from public.user_screen_entries where user_id=auth.uid() and title='Updated private audit entry') then raise exception 'Own Screen UPDATE lost'; end if;
end $$;
insert into public.global_chat_messages(user_id,content) values(auth.uid(),'Audit chat message');
do $$ begin
  begin
    insert into public.global_chat_messages(user_id,content) values('22222222-2222-4222-8222-222222222222','Impersonation');
    raise exception 'Chat impersonation accepted';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
set local role authenticated;
do $$ declare n integer; begin
  update public.profiles set terminal_status='Cross-user audit update' where id='11111111-1111-4111-8111-111111111111';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'Cross-user profile update allowed'; end if;
  update public.notifications set read_at=null where id='ffffffff-ffff-4fff-8fff-ffffffffffff';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'Cross-user notification update allowed'; end if;
  update public.user_games set status='playing' where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'Cross-user library update allowed'; end if;
  if exists(select 1 from public.friend_messages) then raise exception 'Private messages leaked'; end if;
  if exists(select 1 from public.user_screen_entries) then raise exception 'Private Screen leaked'; end if;
  if exists(select 1 from public.notifications) then raise exception 'Private notifications leaked'; end if;
  begin
    insert into public.user_games(user_id,game_id) values('22222222-2222-4222-8222-222222222222','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2');
    raise exception 'Cross-user library insert allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
