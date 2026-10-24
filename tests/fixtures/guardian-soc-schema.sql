-- SCRATCH DATABASE ONLY: CREATE SCHEMA fails if pointed at an existing Supabase instance.
create schema auth;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create function auth.role() returns text language sql stable as $$ select coalesce(current_setting('request.jwt.claim.role',true),'') $$;
create table auth.users(id uuid primary key);
create table public.system_switches(key text primary key, value jsonb not null,updated_at timestamptz default now(),updated_by uuid references auth.users(id));
insert into public.system_switches(key,value) values('gatekeeper_enabled','false'),('registrations_open','true'),('double_xp','false'),('seasonal_theme','"classic"');
create table public.security_audit_logs(id uuid primary key default gen_random_uuid(),event text not null,key_hash text,metadata jsonb not null default '{}',created_at timestamptz not null default now());
create table public.profiles(id uuid primary key);
create function public.guardian_registration_guard() returns trigger language plpgsql as $$ begin return new; end; $$;
create trigger guardian_registration_guard before insert on auth.users for each row execute function public.guardian_registration_guard();
insert into auth.users(id) values('11111111-1111-4111-8111-111111111111');
