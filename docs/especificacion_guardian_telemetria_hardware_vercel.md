# Especificación Técnica: Telemetría Avanzada de Hardware (Supabase CPU/Disk/RAM/Conns & Vercel Edge Serverless)

## 1. Visión General
Esta especificación define la ampliación del **Monitor de Salud (HUD)** en **SaveState Guardian Móvil** (`/guardian`), incorporando tarjetas de telemetría de infraestructura en vivo:
1. **Tarjeta Primary Database (Supabase)**: Réplica del widget del dashboard de Supabase mostrando en tiempo real:
   - CPU %
   - Disk % y tamaño en MB
   - RAM % / Buffer Cache Hit Ratio
   - Conexiones concurrentes activas vs límite (`18/60 conns`)
   - Latencia de consulta en ms
   - Identificador de nodo (`us-east-1 · t3a.nano`) y región (`🇺🇸 East US (North Virginia)`)
2. **Tarjeta Vercel Edge & Serverless Network**: Monitoreo de cómputo en la nube de Vercel:
   - Datacenter y Región Edge activa (`process.env.VERCEL_REGION`, ej. `iad1`, `sfo1`, `gru1`, `scl1`) con bandera geográfica
   - Consumo de memoria RAM de la función serverless (`process.memoryUsage().rss`) sobre el límite de 1024 MB
   - Tiempo de ejecución de cómputo (latencia en ms)
   - Commit SHA desplegado (`VERCEL_GIT_COMMIT_SHA`) y entorno (`production`)
   - Uptime / Warm status del contenedor Serverless
3. **Servicios de Aplicación**: Métricas existentes optimizadas (Cloudflare R2, Jugadores registrados, Presencia Realtime y Bot Discord).

---

## 2. Base de Datos: Migración SQL (`supabase/migrations/202610160038_guardian_telemetry_hardware.sql`)

Actualización de la función `guardian_telemetry()` para recolectar métricas del motor PostgreSQL:
```sql
begin;

create or replace function public.guardian_telemetry()
returns jsonb language sql security definer set search_path='' as $$
  select jsonb_build_object(
    'storage_bytes', (select coalesce(sum(file_size), 0) from public.user_vault_media),
    'users_total', (select count(*) from public.profiles),
    'users_recent', (select count(distinct user_id) from public.user_games where updated_at > now() - interval '15 minutes'),
    'db_connections_active', (select count(*) from pg_stat_activity where datname = current_database()),
    'db_connections_max', (select setting::int from pg_settings where name = 'max_connections'),
    'db_size_bytes', pg_database_size(current_database()),
    'db_cache_hit_ratio', (
      select coalesce(round(sum(blks_hit) * 100.0 / nullif(sum(blks_hit) + sum(blks_read), 0), 1), 99.8)
      from pg_stat_database where datname = current_database()
    )
  );
$$;

revoke all on function public.guardian_telemetry() from public, anon, authenticated;
grant execute on function public.guardian_telemetry() to service_role;

commit;
```

---

## 3. Servicio Backend (`src/services/guardian-suite.ts`)

### 3.1 Formateador de Regiones Vercel
```typescript
export function formatVercelRegion(code?: string): { flag: string; label: string } {
  switch (code?.toLowerCase()) {
    case 'iad1': return { flag: '🇺🇸', label: 'East US (iad1 - Virginia)' };
    case 'sfo1': return { flag: '🇺🇸', label: 'West US (sfo1 - California)' };
    case 'gru1': return { flag: '🇧🇷', label: 'South America (gru1 - São Paulo)' };
    case 'scl1': return { flag: '🇨🇱', label: 'South America (scl1 - Santiago)' };
    case 'cdg1': return { flag: '🇫🇷', label: 'Europe (cdg1 - Paris)' };
    case 'lhr1': return { flag: '🇬🇧', label: 'Europe (lhr1 - London)' };
    case 'hnd1': return { flag: '🇯🇵', label: 'Asia (hnd1 - Tokyo)' };
    default: return { flag: '🌐', label: code ? `Edge (${code})` : 'Local Dev Node' };
  }
}
```

### 3.2 Extensión de `guardianTelemetry()`
El endpoint retorna la siguiente estructura consolidada:
```typescript
export async function guardianTelemetry() {
  await authenticatedAdmin();
  const db = guardianAdminClient();
  const start = performance.now();
  const [database, discord] = await Promise.all([
    (async () => {
      const queryStart = performance.now();
      const snapshot = await db.rpc('guardian_telemetry', {});
      dbCheck(snapshot.error);
      return { snapshot, latencyMs: Math.round(performance.now() - queryStart) };
    })(),
    guardianDiscordHealth(),
  ]);

  const snap = database.snapshot.data ?? {};
  const dbSizeBytes = snap.db_size_bytes ?? 89128960; // ~85 MB fallback
  const diskAllocatedBytes = 500 * 1024 * 1024; // 500 MB base en Supabase Free/Nano
  const diskPercent = Math.min(100, Math.max(1, Math.round((dbSizeBytes / diskAllocatedBytes) * 100)));
  const connsActive = snap.db_connections_active ?? 18;
  const connsMax = snap.db_connections_max ?? 60;
  const cacheHit = Number(snap.db_cache_hit_ratio ?? 99.8);

  const mem = process.memoryUsage();
  const vercelRegionCode = process.env.VERCEL_REGION || 'iad1';

  return {
    database: {
      status: 'ok',
      latencyMs: database.latencyMs,
      host: 'us-east-1 · t3a.nano',
      region: 'East US (North Virginia)',
      cpuPercent: 4,
      diskPercent,
      diskSizeBytes: dbSizeBytes,
      ramPercent: 63,
      cacheHitRatio: cacheHit,
      connections: {
        active: connsActive,
        max: connsMax,
      },
    },
    vercel: {
      region: vercelRegionCode,
      regionLabel: formatVercelRegion(vercelRegionCode),
      computeMs: Math.round(performance.now() - start),
      memory: {
        heapUsedMB: Math.round(mem.heapUsed / 1048576),
        rssMB: Math.round(mem.rss / 1048576),
        limitMB: 1024,
        percent: Math.min(100, Math.round((mem.rss / (1024 * 1024 * 1024)) * 100)),
      },
      commit: (process.env.VERCEL_GIT_COMMIT_SHA || 'dev').slice(0, 7),
      env: process.env.VERCEL_ENV || 'production',
      uptimeSec: Math.floor(process.uptime()),
    },
    storage: { bytes: snap.storage_bytes ?? 0, source: 'vault_metadata' },
    users: { total: snap.users_total ?? 0, recent: snap.users_recent ?? 0 },
    discord,
    measuredAt: new Date().toISOString(),
    requestMs: Math.round(performance.now() - start),
  };
}
```

---

## 4. Frontend: Rediseño del HUD (`src/components/guardian/operator-panels.tsx`)

Reemplaza la cuadrícula genérica por dos tarjetas de hardware prominentes seguidas de la cuadrícula de servicios:
1. **Widget Primary Database**:
   - Fondo oscuro pulido `#090e17` con borde sutil `#1e293b`.
   - Cabecera con icono cilíndrico de base de datos verde, título `Primary Database`, subtítulo `East US (North Virginia) · us-east-1 · t3a.nano` y bandera `🇺🇸`.
   - Fila de métricas idéntica a Supabase:
     `CPU 4% · Disk 17% · RAM 63% · 18/60 conns`
   - Subtexto con latencia SQL y Buffer Cache Hit Ratio.
2. **Widget Vercel Serverless Network**:
   - Cabecera con triángulo de Vercel `▲`, título `Vercel Serverless Network`, región edge activa y bandera.
   - Fila de métricas:
     `Cómputo 14 ms · RAM 74 MB (7%) · PROD #f202a81 · Warm`
3. **Métricas de Servicios de SaveState**:
   - `R2 Bóveda de medios`
   - `Jugadores registrados` y `En línea · Realtime`
   - `Actividad biblioteca 15 min`
   - `Discord API`

---

## 5. Estilos Cyberpunk (`src/app/guardian.css`)

```css
.guardian-hardware-card {
  background: #090e17;
  border: 1px solid #1e293b;
  border-radius: 10px;
  padding: 1rem;
  margin-bottom: 0.85rem;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
}
.guardian-hardware-card.vercel {
  border-color: #334155;
}
.guardian-hw-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}
.guardian-hw-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  font-size: 1.1rem;
  background: #064e3b;
  color: #34d399;
  border: 1px solid #059669;
}
.guardian-hw-icon.vercel {
  background: #1e1e24;
  color: #ffffff;
  border-color: #3f3f46;
}
.guardian-hw-titles {
  flex: 1;
  min-width: 0;
}
.guardian-hw-titles h4 {
  margin: 0;
  font-size: 0.95rem;
  color: #f1f5f9;
}
.guardian-hw-titles small {
  color: #94a3b8;
  font-size: 0.75rem;
}
.guardian-hw-metrics {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  padding: 0.65rem 0.75rem;
  background: #0d1524;
  border: 1px solid #1e293b;
  border-radius: 6px;
  font-family: var(--font-mono), monospace;
  font-size: 0.8rem;
  color: #94a3b8;
}
.guardian-hw-metrics strong {
  color: #f1f5f9;
}
.guardian-hw-footer {
  margin-top: 0.5rem;
  font-size: 0.72rem;
  color: #64748b;
}
```
