-- Run only on an isolated Supabase test database after applying migrations.
-- Every fixture and mutation rolls back. UUIDs are reserved for this suite.
begin;
insert into auth.users(id) values
('11111111-1111-4111-8111-111111111111'),
('22222222-2222-4222-8222-222222222222'),
('33333333-3333-4333-8333-333333333333');
update public.profiles set library_private = true where id = '11111111-1111-4111-8111-111111111111';
insert into public.games(id,igdb_id,title,slug) values
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',900000001,'Test game 1','savestate-test-1'),
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',900000002,'Test game 2','savestate-test-2'),
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',900000003,'Test game 3','savestate-test-3'),
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4',900000004,'Test game 4','savestate-test-4'),
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5',900000005,'Test game 5','savestate-test-5');
insert into public.user_games(id,user_id,game_id,status,rating) values
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','cleared',9.5),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2','22222222-2222-4222-8222-222222222222','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','playing',7.5);
insert into public.reviews(id,user_game_id,content,content_markdown,has_spoilers) values
('cccccccc-cccc-4ccc-8ccc-ccccccccccc1','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1','<p>Private review</p>','Private review',true);

set local role anon;
do $$ begin
  if exists(select 1 from public.user_games where user_id = '11111111-1111-4111-8111-111111111111') then raise exception 'Private library exposed to guest'; end if;
  if exists(select 1 from public.reviews where id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1') then raise exception 'Private review exposed to guest'; end if;
  if (select total from public.community_rating('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1')) <> 1 then raise exception 'Private score included in public aggregate'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
set local role authenticated;
insert into public.follows(follower_id,followed_id) values('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111');
do $$ begin
  if public.can_view_library('11111111-1111-4111-8111-111111111111') then raise exception 'Following grants private access'; end if;
  begin
    insert into public.friendships(sender_id,receiver_id,status) values('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111','accepted');
    raise exception 'Forged friendship accepted';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.play_logs(user_game_id,platform_played,play_method) values('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1','PC','hardware');
    raise exception 'Foreign log write succeeded';
  exception when insufficient_privilege then null; end;
end $$;
insert into public.friendships(id,sender_id,receiver_id) values('dddddddd-dddd-4ddd-8ddd-ddddddddddd1','22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111');
update public.friendships set status = 'accepted' where id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1';
do $$ begin
  if public.can_view_library('11111111-1111-4111-8111-111111111111') then raise exception 'Sender self-accepted friendship'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
set local role authenticated;
update public.friendships set status = 'accepted' where id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1';
select public.save_review('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',9,'<p>Updated</p>','Updated',false);
do $$ begin
  if (select rating from public.user_games where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1') <> 9 then raise exception 'Review score not synchronized'; end if;
  if (select status from public.user_games where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1') <> 'cleared' then raise exception 'Review changed library status'; end if;
  begin
    perform public.save_review('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',8.25,'<p>Invalid</p>','Invalid',false);
    raise exception 'Invalid score accepted';
  exception when check_violation then null; end;
  if (select content_markdown from public.reviews where id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1') <> 'Updated' then raise exception 'Failed review save was not atomic'; end if;
end $$;
select public.set_favorites(array['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4']::uuid[]);
do $$ begin
  if (select count(*) from public.user_games where favorite_position is not null and user_id = auth.uid()) <> 4 then raise exception 'Top 4 not saved'; end if;
  begin
    perform public.set_favorites(array['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1']::uuid[]);
    raise exception 'Duplicate favorite accepted';
  exception when raise_exception then if sqlerrm = 'Duplicate favorite accepted' then raise; end if; end;
  begin
    perform public.set_favorites(array['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5']::uuid[]);
    raise exception 'Fifth favorite accepted';
  exception when raise_exception then if sqlerrm = 'Fifth favorite accepted' then raise; end if; end;
end $$;
insert into public.play_logs(user_game_id,platform_played,play_method,hours_played,start_date,finish_date) values
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1','SNES','hardware',20,'2015-01-01','2015-01-30'),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1','SNES','emulator',15,'2024-01-01','2024-01-30');
do $$ begin
  if (select count(*) from public.play_logs where user_game_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1') <> 2 then raise exception 'Multiple play logs not supported'; end if;
  begin
    insert into public.play_logs(user_game_id,platform_played,play_method,start_date,finish_date) values('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1','PC','hardware','2024-02-01','2024-01-01');
    raise exception 'Reversed dates accepted';
  exception when check_violation then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
set local role authenticated;
do $$ begin
  if not public.can_view_library('11111111-1111-4111-8111-111111111111') then raise exception 'Accepted friend lacks access'; end if;
  if not exists(select 1 from public.reviews where id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1') then raise exception 'Accepted friend cannot read review'; end if;
  if exists(select 1 from public.notifications where user_id <> auth.uid()) then raise exception 'Foreign notifications exposed'; end if;
  update public.user_games set rating = 1 where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
  if (select rating from public.user_games where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1') <> 9 then raise exception 'Foreign library edited'; end if;
end $$;
delete from public.friendships where id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1';
do $$ begin
  if public.can_view_library('11111111-1111-4111-8111-111111111111') then raise exception 'Revoked friendship retains access'; end if;
  if exists(select 1 from public.play_logs where user_game_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1') then raise exception 'Private play log exposed after revocation'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
set local role authenticated;
insert into storage.objects(bucket_id,name) values('profiles','11111111-1111-4111-8111-111111111111/avatar.webp');
do $$ begin
  begin
    update public.user_games set rating = null where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
    raise exception 'Review rating was cleared';
  exception when check_violation then null; end;
  begin
    update public.user_games set rating = 9.49 where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
    raise exception 'Invalid fractional score was rounded';
  exception when check_violation then null; end;
  begin
    insert into storage.objects(bucket_id,name) values('profiles','22222222-2222-4222-8222-222222222222/avatar.webp');
    raise exception 'Foreign media write accepted';
  exception when insufficient_privilege then null; end;
  begin
    insert into storage.objects(bucket_id,name) values('profiles','11111111-1111-4111-8111-111111111111/unbounded.webp');
    raise exception 'Unbounded media file accepted';
  exception when insufficient_privilege then null; end;
end $$;
update public.user_games set rating = 8 where user_id = auth.uid() and game_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
insert into public.reviews(user_game_id,content,content_markdown,has_spoilers)
select id,'Private unreported review','Private unreported review',false from public.user_games where user_id = auth.uid() and game_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
insert into public.reports(user_id,review_id,reason) values(auth.uid(),'cccccccc-cccc-4ccc-8ccc-ccccccccccc1','Test moderation scope');
reset role;
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
select set_config('request.jwt.claims','{"app_metadata":{"role":"moderator"}}',true);
set local role authenticated;
do $$ begin
  if (select count(*) from public.reviews) <> 1 then raise exception 'Moderator access is not scoped to reported private content'; end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"user_metadata":{"role":"admin"}}',true);
set local role authenticated;
do $$ begin
  if exists(select 1 from public.reviews) then raise exception 'User metadata forged a moderator role'; end if;
end $$;
reset role;
rollback;
