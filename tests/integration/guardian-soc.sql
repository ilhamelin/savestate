-- Run only against the disposable database created by tests/fixtures/guardian-soc-schema.sql.
do $$ declare a jsonb; n int;
begin
  if (select value from public.system_switches where key='defcon_level')<>'5'::jsonb then raise exception 'Initial posture changed'; end if;
  for n in 1..5 loop
    a:=public.guardian_soc_fail('192.0.2.1','Invalid TOTP');
    if (a->>'quarantined')::boolean<>(n=5) then raise exception 'Sliding window mismatch at %',n; end if;
  end loop;
  a:=public.guardian_soc_fail('192.0.2.1','Invalid TOTP');
  if (a->>'recentCount')::int<>5 then raise exception 'Blocked attempts extended quarantine'; end if;
  if (select count(*) from public.security_audit_logs where event='threat_ip_quarantined')<>1 then raise exception 'Audit duplicated'; end if;
  update public.guardian_threat_ips set expires_at=now()-interval '1 second' where ip='192.0.2.1';
  update public.guardian_threat_ips set attempts=array[now()-interval '61 seconds'] where ip='192.0.2.1';
  a:=public.guardian_soc_fail('192.0.2.1','Expired window');
  if (a->>'recentCount')::int<>1 or (a->>'quarantined')::boolean then raise exception 'Window did not expire'; end if;
  perform public.guardian_soc_quarantine('2001:db8::1','block','Operator verified threat','11111111-1111-4111-8111-111111111111');
  if jsonb_array_length(public.guardian_soc_snapshot()->'quarantinedIps')<>1 then raise exception 'Manual IPv6 block missing'; end if;
  perform public.guardian_soc_quarantine('2001:db8::1','unblock','Operator verified recovery','11111111-1111-4111-8111-111111111111');
  if jsonb_array_length(public.guardian_soc_snapshot()->'quarantinedIps')<>0 then raise exception 'Unblock missing'; end if;
  perform public.guardian_soc_defcon(3,'11111111-1111-4111-8111-111111111111','Incident response test');
  if (select value from public.system_switches where key='registrations_open')<>'false'::jsonb then raise exception 'Registrations remained open'; end if;
  begin
    perform public.guardian_set_switch('registrations_open','true','11111111-1111-4111-8111-111111111111');
    raise exception 'Switch bypass accepted';
  exception when others then if SQLERRM='Switch bypass accepted' then raise; end if; end;
  begin
    insert into auth.users(id) values(gen_random_uuid());
    raise exception 'Direct registration bypass accepted';
  exception when others then if SQLERRM='Direct registration bypass accepted' then raise; end if; end;
  perform public.guardian_soc_defcon(2,'11111111-1111-4111-8111-111111111111','Read only response test');
  perform set_config('request.jwt.claim.role','authenticated',true);
  begin
    insert into public.profiles(id) values(gen_random_uuid());
    raise exception 'Direct DML bypass accepted';
  exception when others then if SQLERRM='Direct DML bypass accepted' then raise; end if; end;
  perform set_config('request.jwt.claim.role','service_role',true);
  insert into public.profiles(id) values(gen_random_uuid());
  perform public.guardian_soc_defcon(1,'11111111-1111-4111-8111-111111111111','Lockdown response test');
  if (select value from public.system_switches where key='gatekeeper_enabled')<>'true'::jsonb then raise exception 'Gatekeeper not enabled'; end if;
  perform public.guardian_soc_defcon(5,'11111111-1111-4111-8111-111111111111','Incident recovery test');
  if (select value from public.system_switches where key='gatekeeper_enabled')<>'false'::jsonb or
     (select value from public.system_switches where key='registrations_open')<>'true'::jsonb then raise exception 'Previous settings not restored'; end if;
  if (select count(*) from public.security_audit_logs where event='defcon_escalation' and metadata->>'actor_id'='11111111-1111-4111-8111-111111111111')<>4 then raise exception 'Audit missing actor'; end if;
  begin
    update public.security_audit_logs set metadata='{}';
    raise exception 'Mutable audit accepted';
  exception when others then if SQLERRM='Mutable audit accepted' then raise; end if; end;
  if has_function_privilege('anon','public.guardian_soc_defcon(integer,uuid,text)','EXECUTE') or
    has_table_privilege('authenticated','public.guardian_threat_ips','SELECT') then raise exception 'Privilege leak'; end if;
  raise notice 'PASS: thresholds, expiry, IPv6 quarantine, atomic DEFCON, direct signup/DML guards, restoration and immutable audit';
end; $$;
