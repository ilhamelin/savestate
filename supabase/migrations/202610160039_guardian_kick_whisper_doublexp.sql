begin;

alter table public.system_switches drop constraint if exists system_switches_key_check;
alter table public.system_switches add constraint system_switches_key_check
  check (key in ('gatekeeper_enabled', 'registrations_open', 'seasonal_theme', 'double_xp'));
alter table public.system_switches drop constraint if exists system_switch_value;
alter table public.system_switches add constraint system_switch_value check (
  (key in ('gatekeeper_enabled', 'registrations_open', 'double_xp') and jsonb_typeof(value) = 'boolean') or
  (key = 'seasonal_theme' and value in ('"halloween"'::jsonb, '"classic"'::jsonb))
);
insert into public.system_switches(key, value) values ('double_xp', 'false'::jsonb)
on conflict (key) do nothing;

create or replace function public.grant_player_xp(p_target_id uuid, p_amount int)
returns table(new_xp int, new_level int) language plpgsql security definer set search_path = '' as $$
declare v_xp int; v_level int; v_effective_amount int; v_is_double boolean;
begin
  if p_amount is null or p_amount <= 0 or p_amount > 100000 then
    raise exception 'Cantidad de XP no válida';
  end if;
  v_is_double := exists(select 1 from public.system_switches where key = 'double_xp' and value = 'true'::jsonb);
  v_effective_amount := p_amount * case when v_is_double then 2 else 1 end;
  select xp into v_xp from public.profiles where id = p_target_id for update;
  if not found then raise exception 'Jugador no encontrado'; end if;
  if v_xp > 2147483647 - v_effective_amount then raise exception 'Límite de XP excedido'; end if;
  v_xp := v_xp + v_effective_amount;
  v_level := greatest(1, floor(power(v_xp::numeric / 100.0, 1.0 / 1.65))::int + 1);
  update public.profiles set xp = v_xp, level = v_level where id = p_target_id;
  insert into public.security_audit_logs(event, metadata)
    values ('player_xp_granted', jsonb_build_object('target_id', p_target_id, 'xp', v_effective_amount, 'double_xp', v_is_double));
  return query select v_xp, v_level;
end; $$;
revoke all on function public.grant_player_xp(uuid, int) from public, anon, authenticated;
grant execute on function public.grant_player_xp(uuid, int) to service_role;

-- Apply the event to ordinary gameplay XP too, retaining deduplication and abuse limits.
create or replace function public.award_xp(p_user_id uuid, p_amount integer, p_action text, p_reference_id text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_old_xp integer; v_old_level integer; v_new_xp integer; v_new_level integer; v_expected integer;
  v_effective integer; v_is_double boolean;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'XP awards require the server role' using errcode = '42501';
  end if;
  v_expected := case p_action when 'cleared' then 150 when 'platinum' then 300 when 'session' then 10
    when 'review' then 75 when 'highlight' then 40 when 'steam_connected' then 200
    when 'psn_connected' then 200 when 'xbox_connected' then 200 else null end;
  if v_expected is null or p_amount is distinct from v_expected or p_reference_id is null
    or length(btrim(p_reference_id)) = 0 or length(p_reference_id) > 200 then
    raise exception 'Invalid XP event' using errcode = '22023';
  end if;
  select xp, level into v_old_xp, v_old_level from public.profiles where id = p_user_id for update;
  if not found then raise exception 'Player not found' using errcode = 'P0002'; end if;
  if exists(select 1 from public.user_xp_events where user_id = p_user_id and action = p_action and reference_id = p_reference_id) then
    return jsonb_build_object('success', false, 'reason', 'already_awarded');
  end if;
  if p_action = 'session' and exists(select 1 from public.user_xp_events where user_id = p_user_id and action = 'session'
    and split_part(reference_id, ':', 1) = split_part(p_reference_id, ':', 1) and created_at > now() - interval '30 minutes') then
    return jsonb_build_object('success', false, 'reason', 'session_cooldown');
  end if;
  if p_action = 'highlight' and (select count(*) from public.user_xp_events where user_id = p_user_id and action = 'highlight'
    and created_at >= (date_trunc('day', now() at time zone 'UTC') at time zone 'UTC')) >= 3 then
    return jsonb_build_object('success', false, 'reason', 'daily_limit');
  end if;
  if p_action in ('steam_connected', 'psn_connected', 'xbox_connected') and exists(
    select 1 from public.user_xp_events where user_id = p_user_id and action = p_action) then
    return jsonb_build_object('success', false, 'reason', 'already_awarded');
  end if;
  v_is_double := exists(select 1 from public.system_switches where key = 'double_xp' and value = 'true'::jsonb);
  v_effective := p_amount * case when v_is_double then 2 else 1 end;
  if v_old_xp > 2147483647 - v_effective then raise exception 'Límite de XP excedido'; end if;
  v_new_xp := v_old_xp + v_effective;
  v_new_level := greatest(1, floor(power(v_new_xp::numeric / 100.0, 1.0 / 1.65))::integer + 1);
  insert into public.user_xp_events(user_id, amount, action, reference_id) values(p_user_id, v_effective, p_action, p_reference_id);
  update public.profiles set xp = v_new_xp, level = v_new_level where id = p_user_id;
  return jsonb_build_object('success', true, 'awarded', v_effective, 'total_xp', v_new_xp, 'level', v_new_level, 'leveled_up', v_new_level > v_old_level, 'double_xp', v_is_double);
end; $$;
revoke all on function public.award_xp(uuid, integer, text, text) from public, anon, authenticated;
grant execute on function public.award_xp(uuid, integer, text, text) to service_role;

-- Operator signals are private and server-originated, unlike the public presence channel.
drop policy if exists operator_signal_receive on realtime.messages;
create policy operator_signal_receive on realtime.messages for select to authenticated
  using (extension = 'broadcast' and realtime.topic() = 'savestate:operator:' || (select auth.uid())::text);
drop policy if exists operator_signal_receive_guard on realtime.messages;
create policy operator_signal_receive_guard on realtime.messages as restrictive for select to anon, authenticated
  using (realtime.topic() not like 'savestate:operator:%' or
    (extension = 'broadcast' and realtime.topic() = 'savestate:operator:' || (select auth.uid())::text));
drop policy if exists operator_signal_send_guard on realtime.messages;
create policy operator_signal_send_guard on realtime.messages as restrictive for insert to anon, authenticated
  with check (realtime.topic() not like 'savestate:operator:%');

create or replace function public.guardian_operator_signal(p_target_id uuid, p_actor uuid, p_event text, p_message text default null)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_sender text; v_payload jsonb;
begin
  if p_event not in ('operator_kick', 'operator_whisper') or p_event is null then raise exception 'Señal no válida'; end if;
  if p_event = 'operator_kick' and p_target_id = p_actor then raise exception 'Inmunidad de Operador'; end if;
  if not exists(select 1 from public.profiles where id = p_target_id) then raise exception 'Jugador no encontrado'; end if;
  select username into v_sender from public.profiles where id = p_actor;
  if not found then raise exception 'Operador no encontrado'; end if;
  if p_event = 'operator_whisper' and (p_message is null or char_length(btrim(p_message)) not between 1 and 140) then
    raise exception 'El susurro debe tener entre 1 y 140 caracteres';
  end if;
  v_payload := jsonb_build_object('id', gen_random_uuid(), 'user_id', p_target_id, 'sender', v_sender, 'sent_at', now());
  if p_event = 'operator_whisper' then v_payload := v_payload || jsonb_build_object('message', btrim(p_message)); end if;
  perform realtime.send(v_payload, p_event, 'savestate:operator:' || p_target_id::text, true);
  insert into public.security_audit_logs(event, metadata) values(p_event, jsonb_build_object(
    'actor_id', p_actor, 'target_id', p_target_id, 'message_length', case when p_event = 'operator_whisper' then char_length(btrim(p_message)) else 0 end));
  return true;
end; $$;
revoke all on function public.guardian_operator_signal(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.guardian_operator_signal(uuid, uuid, text, text) to service_role;

commit;
