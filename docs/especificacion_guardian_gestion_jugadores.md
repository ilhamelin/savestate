# Especificación Técnica: Gestión de Cuentas en Guardian Móvil (Bloqueo, Reinicio y Borrado)

## 1. Visión General
Esta especificación define los métodos de administración y moderación directa desde la app móvil **SaveState Guardian** para gestionar las cuentas de jugadores en la base de datos:
1. **Bloquear Acceso (Forzar Nueva Clave de 20s)**: Revoca inmediatamente el acceso web del usuario seleccionado, invalidando sus cookies y expulsándolo al Checkpoint de `/gatekeeper`. Para volver a navegar, debe solicitar e ingresar la clave activa de 20 segundos.
2. **Reiniciar Cuenta (Reset a Nivel 1)**: Restablece el progreso del jugador a estado inicial (Nivel 1, 0 XP, biblioteca de juegos vacía, badges eliminados y estado de terminal limpio), conservando sus credenciales de acceso.
3. **Borrar Cuenta (Eliminación Definitiva)**: Elimina en cascada al usuario de `auth.users` y de todas las tablas relacionadas (`profiles`, `user_games`, `friendships`, `vault`, etc.) de manera irreversible.

---

## 2. Seguridad y Reglas de Negocio

- **Exclusividad**: Solo el Operador Supremo autenticado (`@ilhamelin_v2` / `benjaigancioreyes56@gmail.com`) puede ejecutar estas acciones.
- **Inmunidad del Administrador**: La interfaz y la API impiden estrictamente que el operador se bloquee, reinicie o elimine a sí mismo (`targetUserId !== adminUserId`).
- **Confirmación Táctil**: Cada acción destructiva (reiniciar o borrar) exige confirmación explícita en la UI para evitar toques accidentales en la pantalla táctil.

---

## 3. Modelo de Datos y Migración (`supabase/migrations/202610160036_player_moderation.sql`)

```sql
begin;

-- Columna para registrar el estado de bloqueo / revocación
alter table public.profiles 
  add column if not exists access_locked boolean not null default false,
  add column if not exists access_locked_at timestamptz;

-- Función segura para reiniciar progreso de cuenta
create or replace function public.reset_player_account(p_target_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  -- 1. Restablecer perfil
  update public.profiles set
    level = 1,
    xp = 0,
    terminal_status = '',
    theme_color = 'cyan',
    social_links = '{}'::jsonb
  where id = p_target_id;

  -- 2. Limpiar registros de juego y badges
  delete from public.user_games where user_id = p_target_id;
  delete from public.user_badges where user_id = p_target_id;
  delete from public.user_vault_media where user_id = p_target_id;

  return true;
end;
$$;

revoke all on function public.reset_player_account(uuid) from public, anon, authenticated;
grant execute on function public.reset_player_account(uuid) to service_role;

commit;
```

---

## 4. Endpoints Administrativos (`/api/guardian/players/[id]`)

### 4.1 Endpoint `POST /api/guardian/players/[id]/action`
Recibe `{ action: 'lock' | 'unlock' | 'reset' | 'delete' }`:

1. **`lock` / `unlock`**:
   - Actualiza `access_locked = true` y `access_locked_at = now()`.
   - En el middleware `src/proxy.ts`, si el usuario autenticado tiene `access_locked = true`, se borra su cookie `savestate_gate_pass` y se le redirige a `/gatekeeper`.
2. **`reset`**:
   - Ejecuta `supabase.rpc('reset_player_account', { p_target_id: id })` con cliente `service_role`.
3. **`delete`**:
   - Ejecuta `supabase.auth.admin.deleteUser(id)` con cliente `service_role`, disparando la eliminación en cascada de todas sus tablas asociadas.

---

## 5. Interfaz de Usuario en Guardian Móvil (`src/components/guardian/guardian-console.tsx`)

En la pestaña **👥 Jugadores**:
- Cada tarjeta de jugador incorpora un botón de acción rápida `[ ⚙️ Administrar ]` (o al tocar la tarjeta).
- Se abre una bandeja modal táctil con:
  - **Estado actual**: `🟢 Acceso Normal` o `🔒 Acceso Bloqueado`.
  - **Botón 1**: `🔒 Bloquear acceso (Obligar a pedir código)` / `🔓 Desbloquear acceso`.
  - **Botón 2**: `🔄 Reiniciar cuenta a Nivel 1` (con advertencia de reset).
  - **Botón 3**: `🗑️ Eliminar cuenta definitivamente` (botón rojo con alerta).
- Feedback inmediato y actualización de la lista sin recargas de página.
