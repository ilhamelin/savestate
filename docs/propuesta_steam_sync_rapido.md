# Propuesta Técnica: Sincronización Rápida de Steam con Seguro Diario (3 usos/día)
**Fecha:** 8 de octubre de 2026  
**Origen:** Auditoría e Investigación (`research/antigravity`)  
**Destino:** Equipo de Implementación (`implementation/chatgpt` / Codex)  
**Propósito:** Especificar el mecanismo de actualización de horas de Steam con 1 solo clic para juegos previamente importados, blindado con un límite estricto de seguridad de 3 sincronizaciones al día por usuario.

---

## 1. Alcance Funcional y Justificación

Actualmente, para actualizar horas jugadas en Steam, el usuario debe abrir el importador completo y revisar la lista de juegos.  
Esta mejora introduce:
1. **Sincronización Rápida con 1 Clic:** Un botón directo en la biblioteca (`/library`) o en el perfil para refrescar las horas de los juegos que el usuario ya tiene registrados desde Steam, sin abrir selectores ni marcar casillas.
2. **Seguro Anti-Abuso (Rate Limit Estricto):**
   - Límite máximo de **3 sincronizaciones cada 24 horas (o por día calendario)** por usuario.
   - Protege la cuota de la API de Valve (Steam Web API) y previene spam o ataques de denegación de servicio.
   - **Feedback visual transparente:** Muestra cuántos intentos le quedan en el día: `[ 🔄 Sincronizar horas · 2 de 3 disponibles hoy ]`. Si se agotan, el botón se deshabilita hasta el día siguiente.

---

## 2. Nueva Migración SQL: `202610080014_steam_sync_ratelimit.sql`

```sql
begin;

-- 1. Columnas de control de cuota en profiles
alter table public.profiles
  add column if not exists steam_id text,
  add column if not exists steam_sync_count int not null default 0,
  add column if not exists steam_last_sync_at timestamptz;

-- 2. Función atómica para reclamar y validar el intento de sincronización
create or replace function public.claim_steam_sync_slot()
returns table(allowed boolean, remaining_slots integer, message text)
language plpgsql security definer set search_path = '' as $$
declare
  current_count int;
  last_sync timestamptz;
  v_steam_id text;
begin
  if auth.uid() is null then
    return query select false, 0, 'Autenticación requerida';
    return;
  end if;

  -- Bloqueo de fila para evitar race conditions en clicks concurrentes
  select p.steam_sync_count, p.steam_last_sync_at, p.steam_id
  into current_count, last_sync, v_steam_id
  from public.profiles p
  where p.id = auth.uid()
  for update;

  if v_steam_id is null or length(v_steam_id) = 0 then
    return query select false, 0, 'No tienes una cuenta de Steam enlazada';
    return;
  end if;

  -- Si es un nuevo día calendario (o nunca ha sincronizado), reiniciar contador a 0
  if last_sync is null or (last_sync::date < current_date) then
    current_count := 0;
  end if;

  -- Validar cuota diaria de 3 intentos
  if current_count >= 3 then
    return query select false, 0, 'Has alcanzado el límite diario (3/3 sincronizaciones usadas hoy). Inténtalo mañana.';
    return;
  end if;

  -- Consumir un intento
  current_count := current_count + 1;
  update public.profiles
  set steam_sync_count = current_count,
      steam_last_sync_at = now()
  where id = auth.uid();

  return query select true, (3 - current_count), 'Slot concedido';
end;
$$;

revoke all on function public.claim_steam_sync_slot() from public, anon;
grant execute on function public.claim_steam_sync_slot() to authenticated;

commit;
```

---

## 3. Lógica del Endpoint `POST /api/steam/sync`

1. **Paso 1: Reclamar slot con la RPC:**
   - Llama a `db.rpc('claim_steam_sync_slot')`.
   - Si `allowed === false`, responde inmediatamente con código HTTP `429 Too Many Requests` y el mensaje de error para mostrar al usuario.
2. **Paso 2: Consultar Steam Web API:**
   - Llama a `IPlayerService/GetOwnedGames/v0001/` para el `steam_id` guardado.
3. **Paso 3: Actualizar solo juegos enlazados:**
   - Cruza los `appid` devueltos con los juegos que el usuario **ya tiene en su biblioteca** (`user_games` que tienen registros con `[Steam lifetime:APPID]` en `play_logs`).
   - Si las horas de Steam son mayores que las registradas, actualiza o añade el diferencial en `play_logs`.
4. **Paso 4: Respuesta amigable:**
   - Devuelve: `{ success: true, updatedCount: 3, hoursAdded: 12.4, remainingSlots: 2 }`.

---

## 4. Componente Visual en `/library` (`<SteamQuickSync />`)

* **Ubicación:** En la cabecera de la biblioteca, junto al botón de la ruleta o en la tarjeta de importación.
* **Diseño:**
  - Si le quedan intentos:
    ```
    [ 🔄 Sincronizar Steam (3/3 hoy) ]
    ```
  - Al hacer clic: Estado de carga retro (*"Sincronizando con Valve..."*).
  - Al completar: Toast / Notificación:  
    `"✓ Sincronización exitosa: 3 juegos actualizados (+8.2 hrs). Te quedan 2 intentos hoy."`
  - Si agotó los 3 intentos:  
    Botón deshabilitado: `[ 🔒 Límite diario alcanzado (0/3) · Vuelve mañana ]`.

---

## 5. Criterios de Aceptación y Calidad

1. El límite de 3 sincronizaciones por día se ejecuta en la base de datos con bloqueo de fila (`FOR UPDATE`), imposibilitando saltarse la cuota mediante peticiones simultáneas.
2. El contador se reinicia automáticamente al cambiar de fecha (`current_date`) sin necesidad de cron jobs.
3. No se agregan juegos nuevos no deseados; solo se actualizan las horas de los títulos que el usuario ya aprobó previamente.
4. Cobertura estricta con `npm run check` y `npm run build`.
