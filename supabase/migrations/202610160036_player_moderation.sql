begin;

alter table public.profiles
  add column if not exists access_locked boolean not null default false,
  add column if not exists access_locked_at timestamptz;

create or replace function public.reset_player_account(p_target_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  -- Serialize progression updates with the reset. Credentials and linked accounts survive.
  perform 1 from public.profiles where id = p_target_id for update;
  if not found then return false; end if;
  update public.profiles set
    level = 1, xp = 0, terminal_status = '', theme_color = 'cyan',
    social_links = '{}'::jsonb, equipped_title = 'Insert Coin', equipped_frame = 'default'
  where id = p_target_id;
  delete from public.user_games where user_id = p_target_id;
  delete from public.user_badges where user_id = p_target_id;
  delete from public.user_vault_media where user_id = p_target_id;
  delete from public.user_xp_events where user_id = p_target_id;
  return true;
end;
$$;

-- Preserve the timestamp after acknowledgement: other devices must still renew their pass.
create or replace function public.acknowledge_player_gate(p_target_id uuid, p_locked_at timestamptz)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set access_locked = false
  where id = p_target_id and access_locked_at = p_locked_at;
  return found;
end;
$$;

revoke all on function public.reset_player_account(uuid) from public, anon, authenticated;
revoke all on function public.acknowledge_player_gate(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.reset_player_account(uuid) to service_role;
grant execute on function public.acknowledge_player_gate(uuid, timestamptz) to service_role;

commit;
