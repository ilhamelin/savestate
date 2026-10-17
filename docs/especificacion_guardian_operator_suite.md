# Especificación Técnica: SaveState Guardian Operator Suite (5 Herramientas de Mando Móvil)

## 1. Visión General
Esta especificación define la expansión de **SaveState Guardian** para dotar al Operador Supremo (`@ilhamelin_v2` / `benjaigancioreyes56@gmail.com`) de un Centro de Comando completo en el celular compuesto por 5 herramientas:
1. **🚨 Transmisión de Alerta Global (Live Broadcast)**: Envío de alertas y anuncios urgentes que aparecen como un banner holográfico en la web en tiempo real y opcionalmente en Discord.
2. **🎛️ Cyber-Killswitch (Interruptores Maestros)**: Interruptores táctiles para activar/desactivar en vivo el Gatekeeper, las inscripciones de nuevos usuarios y los temas estacionales (Halloween/Clásico).
3. **📊 Radar de Salud y Servidores (Telemetry HUD)**: Métricas en vivo del estado de la base de datos Supabase, almacenamiento de Cloudflare R2, jugadores en línea y latencia de Vercel Edge.
4. **🛡️ Registro de Auditoría y Seguridad (Security Log)**: Bitácora de intentos fallidos al Gatekeeper, bloqueos del limitador anti-fuerza bruta e IPs sospechosas.
5. **🎖️ Asignador Rápido de XP y Badges (Premios de Operador)**: Posibilidad de otorgar XP (+50, +100, +500) o asignar insignias de honor directamente a los jugadores desde su tarjeta.

---

## 2. Base de Datos y Migración (`supabase/migrations/202610160037_guardian_suite.sql`)

```sql
begin;

-- 1. Tabla de Broadcasts Globales
create table if not exists public.system_broadcasts (
  id uuid primary key default gen_random_uuid(),
  message text not null check (length(message) <= 240),
  category text not null check (category in ('info', 'warning', 'event')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
alter table public.system_broadcasts enable row level security;
create policy "Cualquiera puede leer el broadcast activo"
  on public.system_broadcasts for select using (active = true);

-- 2. Tabla de Interruptores Maestros (Killswitch)
create table if not exists public.system_switches (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
alter table public.system_switches enable row level security;
create policy "Lectura pública de interruptores"
  on public.system_switches for select using (true);

-- Valores iniciales por defecto
insert into public.system_switches (key, value) values
  ('gatekeeper_enabled', 'false'::jsonb),
  ('registrations_open', 'true'::jsonb),
  ('seasonal_theme', '"halloween"'::jsonb)
on conflict (key) do nothing;

-- 3. Registro de Auditoría de Seguridad
create table if not exists public.security_audit_logs (
  id uuid primary key default gen_random_uuid(),
  event text not null,
  key_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.security_audit_logs enable row level security;
revoke all on public.security_audit_logs from anon, authenticated;
grant select, insert on public.security_audit_logs to service_role;

-- 4. Función de Otorgamiento de XP por Operador
create or replace function public.grant_player_xp(p_target_id uuid, p_amount int)
returns table(new_xp int, new_level int) language plpgsql security definer set search_path = '' as $$
declare
  current_xp int;
  calculated_level int;
begin
  if p_amount <= 0 or p_amount > 100000 then
    raise exception 'Cantidad de XP no válida';
  end if;
  
  select xp into current_xp from public.profiles where id = p_target_id for update;
  if not found then
    raise exception 'Jugador no encontrado';
  end if;

  current_xp := current_xp + p_amount;
  -- level = floor((xp / 100)^(1/1.65)) + 1
  calculated_level := greatest(1, floor(power(current_xp::numeric / 100.0, 1.0 / 1.65))::int + 1);

  update public.profiles set
    xp = current_xp,
    level = calculated_level
  where id = p_target_id;

  return query select current_xp, calculated_level;
end;
$$;
revoke all on function public.grant_player_xp(uuid, int) from public, anon, authenticated;
grant execute on function public.grant_player_xp(uuid, int) to service_role;

commit;
```

---

## 3. Endpoints Administrativos de Guardian

Todos los endpoints exigen `authenticatedAdmin()` (`@ilhamelin_v2` / `benjaigancioreyes56@gmail.com`):

### 3.1 Broadcast (`/api/guardian/broadcast`)
- `POST`: Crea o desactiva el anuncio activo. Recibe `{ message: string, category: 'info' | 'warning' | 'event', active: boolean, notifyDiscord?: boolean }`.
  - Si `notifyDiscord` es true, envía un embed llamativo al canal de anuncios de Discord.
- `GET`: Retorna el broadcast activo.

### 3.2 Killswitch (`/api/guardian/switches`)
- `GET`: Retorna los estados actuales `{ gatekeeper_enabled, registrations_open, seasonal_theme }`.
- `POST`: Actualiza un switch `{ key, value }`. El middleware `src/proxy.ts` consulta el estado de `gatekeeper_enabled` en memoria caché (revalidada cada 10s) para aplicar el bloqueo al vuelo.

### 3.3 Telemetría en Vivo (`/api/guardian/telemetry`)
- `GET`: Retorna en paralelo:
  - `database`: Latencia de consulta a Supabase en milisegundos (`status: 'ok'`).
  - `storage`: Total de bytes ocupados en Cloudflare R2 sumando `user_vault_media.file_size`.
  - `users`: Total de usuarios registrados y activos recientes en los últimos 15 min.
  - `discord`: Estado del bot de Discord.

### 3.4 Logs de Seguridad (`/api/guardian/security-logs`)
- `GET`: Retorna los últimos 50 eventos de `security_audit_logs` e intentos registrados en `gatekeeper_attempts`.

### 3.5 Otorgar XP y Badges (`/api/guardian/players/[id]/rewards`)
- `POST`: `{ xp: number }` -> Llama a `grant_player_xp`.
- `{ badge_id: string, action: 'grant' | 'revoke' }` -> Inserta o borra en `user_badges`.

---

## 4. Banner Holográfico en la Web Pública (`src/components/system-broadcast-banner.tsx`)
- Renderiza un banner superior animado con estética Cyberpunk en el encabezado de la web cuando hay un broadcast activo.
- Colores según categoría:
  - `info`: Neón cian `#00f0ff`
  - `warning`: Naranja ámbar `#ff9900`
  - `event`: Púrpura neón `#a855f7`

---

## 5. Nueva Navegación en Guardian Móvil (5 Pestañas Táctiles)
En el menú inferior de `src/components/guardian/guardian-console.tsx`:
1. `[ 🔐 Token ]`: Generador de 20 segundos.
2. `[ 👥 Jugadores ]`: Lista de jugadores con botones de moderación (`Bloquear`, `Reset`, `Borrar`) y botón `[ 🎁 Premiar XP/Badges ]`.
3. `[ 🚨 Alerta ]`: Creador de Broadcast con 1 tap para la web y Discord.
4. `[ 🎛️ Swiches ]`: Toggles de Gatekeeper, Registros y Temas.
5. `[ 📊 HUD ]`: Monitor de salud de servidores y registro de seguridad.
