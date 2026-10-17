# Especificación Técnica: SaveState Guardian Móvil (Kick en Vivo, Susurro Holográfico, Doble XP y Auto-Premio Admin)

## 1. Visión General
Esta especificación define 4 capacidades tácticas para el Operador Supremo (`@ilhamelin_v2` / `benjaigancioreyes56@gmail.com`) en **Guardian Móvil**:
1. **⚡ Kick en Vivo Táctico**: Desconexión instantánea de un jugador conectado en tiempo real vía Supabase Realtime Broadcast.
2. **💬 Susurro Holográfico de Operador**: Envío de mensajes directos in-game que aparecen como un toast cyberpunk en la pantalla del jugador destinatario.
3. **⚡ Interruptor "Evento Doble XP" (Cyber-Multiplier)**: Nuevo switch maestro `double_xp` en la consola táctica que duplica automáticamente la XP y muestra un aura dorada en la web.
4. **🎖️ Desbloqueo de Auto-Premios para la Cuenta Admin**: Permitir al Operador Supremo otorgarse XP (+50, +100, +500) e insignias a su propia cuenta desde el móvil, manteniendo bloqueadas únicamente las acciones destructivas (bloqueo, reseteo, borrado).

---

## 2. Base de Datos y Migración (`supabase/migrations/202610160039_guardian_kick_whisper_doublexp.sql`)

```sql
begin;

-- 1. Actualizar restricción de system_switches para incluir 'double_xp'
alter table public.system_switches drop constraint if exists system_switch_value;
alter table public.system_switches add constraint system_switch_value check (
  (key in ('gatekeeper_enabled', 'registrations_open', 'double_xp') and jsonb_typeof(value) = 'boolean') or
  (key = 'seasonal_theme' and value in ('"halloween"'::jsonb, '"classic"'::jsonb))
);

insert into public.system_switches (key, value) values
  ('double_xp', 'false'::jsonb)
on conflict (key) do nothing;

-- 2. Modificar grant_player_xp para aplicar multiplicador x2 si double_xp está activo
create or replace function public.grant_player_xp(p_target_id uuid, p_amount int)
returns table(new_xp int, new_level int) language plpgsql security definer set search_path = '' as $$
declare
  v_xp int;
  v_level int;
  v_effective_amount int;
  v_is_double boolean;
begin
  if p_amount is null or p_amount <= 0 or p_amount > 100000 then
    raise exception 'Cantidad de XP no válida';
  end if;

  select coalesce((value)::boolean, false) into v_is_double
  from public.system_switches where key = 'double_xp';

  if v_is_double then
    v_effective_amount := least(p_amount * 2, 200000);
  else
    v_effective_amount := p_amount;
  end if;

  select xp into v_xp from public.profiles where id = p_target_id for update;
  if not found then
    raise exception 'Jugador no encontrado';
  end if;

  if v_xp > 2147483647 - v_effective_amount then
    raise exception 'Límite de XP excedido';
  end if;

  v_xp := v_xp + v_effective_amount;
  v_level := greatest(1, floor(power(v_xp::numeric / 100.0, 1.0 / 1.65))::int + 1);

  update public.profiles set xp = v_xp, level = v_level where id = p_target_id;
  insert into public.security_audit_logs(event, metadata)
  values('player_xp_granted', jsonb_build_object('target_id', p_target_id, 'xp', v_effective_amount, 'double_xp', v_is_double));

  return query select v_xp, v_level;
end;
$$;

revoke all on function public.grant_player_xp(uuid, int) from public, anon, authenticated;
grant execute on function public.grant_player_xp(uuid, int) to service_role;

commit;
```

---

## 3. Endpoints Backend de Guardian

### 3.1 Kick en Vivo (`POST /api/guardian/players/[id]/kick`)
- Requiere `authenticatedAdmin()`.
- Valida que `targetId !== admin.id` (el operador no puede auto-desconectarse).
- Emite un broadcast por el canal `savestate:presence`:
  ```typescript
  await db.channel('savestate:presence').send({
    type: 'broadcast',
    event: 'operator_kick',
    payload: { user_id: targetId },
  });
  ```
- Registra el evento en `security_audit_logs`.

### 3.2 Susurro de Operador (`POST /api/guardian/players/[id]/whisper`)
- Requiere `authenticatedAdmin()`. Recibe `{ message: string }` (1-140 caracteres).
- Emite un broadcast por el canal `savestate:presence`:
  ```typescript
  await db.channel('savestate:presence').send({
    type: 'broadcast',
    event: 'operator_whisper',
    payload: {
      user_id: targetId,
      message: input.message,
      sender: admin.username ?? '@ilhamelin_v2',
      sent_at: new Date().toISOString(),
    },
  });
  ```
- Registra el evento en `security_audit_logs`.

---

## 4. Receptor en el Cliente Web (`src/components/operator-signals-listener.tsx`)
- Componente montado en el layout principal (`src/app/layout.tsx`):
  - Se suscribe a los eventos broadcast del canal `savestate:presence`:
    - Evento `operator_kick`: Si `payload.user_id === currentUserId`, invoca `signOut()` y redirige a `/` mostrando un diálogo/toast: *"Has sido desconectado por el Operador del Sistema."*
    - Evento `operator_whisper`: Si `payload.user_id === currentUserId`, muestra una notificación holográfica flotante en el centro-superior de la pantalla con sonido sutil chiptune o borde de neón cian y botón de cierre.

---

## 5. Modificaciones en Guardian Móvil (`src/components/guardian/`)

### 5.1 En `guardian-console.tsx`:
- Permitir abrir la administración de la propia cuenta del admin:
  - Cambia `disabled={!online || player.id === adminId}` por `disabled={!online}`.
  - El botón muestra: `{player.id === adminId ? '🛡️ Tu cuenta (Operador)' : '⚙️ Administrar'}`.

### 5.2 En `player-management-dialog.tsx`:
- Si `player.id === adminId`:
  - Los botones de premios (`🎁 Premiar XP`, `🎖️ Asignar Badge`) permanecen **TOTALMENTE HABILITADOS**.
  - Las acciones destructivas (`Bloquear`, `Reiniciar`, `Eliminar`, `Kick`) se reemplazan por un aviso visual:
    *`🛡️ Inmunidad de Operador: Acciones destructivas bloqueadas en tu propia cuenta.`*
- Si `player.id !== adminId`:
  - Se agrega el botón `[ ⚡ Kick en Vivo (Desconectar) ]`.
  - Se agrega el botón `[ 💬 Enviar Susurro ]` con un campo de texto y botón `Enviar`.

### 5.3 En `operator-panels.tsx` (`GuardianSwitchPanel`):
- Se agrega el nuevo interruptor maestro:
  ```tsx
  <button
    type="button"
    className="guardian-switch"
    role="switch"
    aria-checked={switches.double_xp}
    disabled={busy}
    onClick={() => void update('double_xp', !switches.double_xp)}
  >
    ⚡ Evento Doble XP (Multiplicador x2){' '}
    <strong>{switches.double_xp ? 'ACTIVO (x2 XP)' : 'NORMAL (x1)'}</strong>
  </button>
  ```
