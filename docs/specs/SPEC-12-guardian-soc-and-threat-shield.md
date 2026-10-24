# SPEC-12: Guardian Security Operations Center (SOC) & Threat Shield

> **Documento:** Especificación Técnica Quirúrgica de Entrega  
> **Rama de Especificación:** `research/antigravity`  
> **Rama Destino de Implementación:** `implementation/chatgpt` (crear rama `feature/guardian-soc-threat-shield`)  
> **Destinatario:** OpenAI Codex / Lead Engineer  
> **Estado:** Listo para Implementación  
> **Prioridad:** Alta (Ciberseguridad activa, mitigación de fuerza bruta y protocolo de respuesta ante crisis)

---

## 1. Objetivo y Contexto

SaveState cuenta con el mecanismo perimetral `Gatekeeper` (`src/domain/gatekeeper.ts`), generación de códigos criptográficos TOTP y un registro básico de eventos en `security_audit_logs`. Sin embargo, la seguridad actual opera de manera pasiva: no existe mitigación automática en tiempo real contra ataques de fuerza bruta en endpoints sensibles (login o verificación del Gatekeeper), ni un mecanismo de respuesta ante incidentes para aislar la plataforma en caliente durante un ataque o fuga de datos.

El objetivo de **SPEC-12** es construir el **Security Operations Center (SOC) & Threat Shield** dentro de la consola administrativa de Guardian (`/guardian`):

1. **Threat Shield (WAF Perimetral Ligero):**
   - Detección y bloqueo automático de fuerza bruta mediante algoritmo de ventana deslizante (*Sliding Window*). Si una IP acumula más de 5 fallos en 60 segundos, se aísla automáticamente en **Cuarentena Perimetral** por 15 minutos, respondiendo `HTTP 429 Too Many Requests` en `< 5 ms` sin consumir recursos de base de datos.
2. **Protocolo de Respuesta ante Crisis DEFCON (Niveles 5 a 1):**
   - Un conmutador maestro en Guardian Console que permite escalar dinámicamente la postura defensiva de la plataforma:
     - **DEFCON 5 (Normal):** Operación verde estándar.
     - **DEFCON 4 (Elevated):** Rate-limiting estricto en autenticación (5 req/min).
     - **DEFCON 3 (Substantial):** Registros de nuevos usuarios congelados; APIs de mutación restringidas.
     - **DEFCON 2 (Critical):** Plataforma en modo **Solo Lectura (*Read-Only*)**; subidas a Vault desactivadas.
     - **DEFCON 1 (Lockdown):** Web sellada completamente tras el Gatekeeper; acceso exclusivo para operadores con llave TOTP/FIDO2.
3. **SOC Dashboard & Radar de Amenazas (`GuardianSocPanel`):**
   - Panel en `/guardian` con telemetría de eventos de seguridad en vivo, métricas de ataques bloqueados, lista de IPs en cuarentena y controles manuales de desbloqueo/bloqueo.
4. **Auditoría Inmutable Zero-Trust:**
   - Registro sellado en `security_audit_logs` para cada escalamiento de nivel DEFCON, IP aislada o acción administrativa.

---

## 2. Lista Exacta de Archivos a Crear / Modificar

| Acción | Archivo | Responsabilidad |
|---|---|---|
| **Crear** | `src/domain/threat-shield.ts` | Modelos de dominio, niveles DEFCON, tipos de eventos de amenaza, algoritmos puros de ventana deslizante y cálculo de severidad. |
| **Crear** | `src/services/threat-shield-service.ts` | Servicio de gestión de cuarentena en memoria, escalamiento de DEFCON, persistencia de auditoría y telemetría SOC. |
| **Crear** | `src/app/api/guardian/soc/telemetry/route.ts` | Endpoint autenticado para administradores que devuelve el estado DEFCON, IPs en cuarentena y eventos recientes. |
| **Crear** | `src/app/api/guardian/soc/defcon/route.ts` | Endpoint autenticado para conmutar el nivel DEFCON con registro de auditoría y motivo obligatorio. |
| **Crear** | `src/app/api/guardian/soc/quarantine/route.ts` | Endpoint autenticado para agregar o retirar IPs de la cuarentena perimetral manualmente. |
| **Crear** | `src/components/guardian/guardian-soc-panel.tsx` | Panel interactivo para Guardian Console con selector militar de niveles DEFCON, radar de eventos en vivo y gestión de IPs. |
| **Modificar** | `src/components/guardian/guardian-console.tsx` | Registrar pestaña `'soc'` en el estado de pestañas y en la barra de navegación (`['soc', '🛡️', 'SOC Shield']`). |
| **Modificar** | `src/domain/guardian-suite.ts` | Extender `SystemSwitches` con `defcon_level: DefconLevel` (por defecto `5`). |
| **Crear** | `tests/unit/threat-shield.test.ts` | Pruebas unitarias completas: ventana deslizante, transición de niveles DEFCON, aislamiento de IPs y expiración de cuarentena. |

---

## 3. Contratos de Tipos Estrictos (TypeScript)

### `src/domain/threat-shield.ts`

```typescript
export const DEFCON_LEVELS = [5, 4, 3, 2, 1] as const;
export type DefconLevel = (typeof DEFCON_LEVELS)[number];

export const DEFCON_LABELS: Record<DefconLevel, { label: string; color: string; desc: string }> = {
  5: { label: 'DEFCON 5 · NORMAL', color: '#10b981', desc: 'Operación estándar sin restricciones.' },
  4: { label: 'DEFCON 4 · ELEVATED', color: '#f59e0b', desc: 'Rate-limiting agresivo en auth. Alerta preventiva.' },
  3: { label: 'DEFCON 3 · SUBSTANTIAL', color: '#f97316', desc: 'Nuevos registros congelados. Solo usuarios verificados.' },
  2: { label: 'DEFCON 2 · CRITICAL', color: '#ef4444', desc: 'Modo Solo Lectura en toda la web. Vault pausado.' },
  1: { label: 'DEFCON 1 · LOCKDOWN', color: '#881337', desc: 'Acceso público sellado tras el Gatekeeper.' },
};

export type ThreatSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface ThreatSecurityEvent {
  id: string;
  event: string;
  severity: ThreatSeverity;
  ip: string;
  actor_id?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface QuarantinedIpEntry {
  ip: string;
  reason: string;
  attempts: number;
  quarantinedAt: number; // Timestamp ms
  expiresAt: number;     // Timestamp ms
}

export interface SocTelemetryReport {
  defconLevel: DefconLevel;
  defconMetadata: {
    updatedAt: string;
    updatedBy: string;
    reason: string;
  };
  quarantinedCount: number;
  quarantinedIps: QuarantinedIpEntry[];
  attacksBlockedToday: number;
  recentThreats: ThreatSecurityEvent[];
  generatedAt: string;
}

export interface RateLimitConfig {
  windowMs: number;     // Ventana de evaluación (ej. 60_000 ms)
  maxAttempts: number;  // Intentos permitidos antes de cuarentena (ej. 5)
  quarantineMs: number; // Duración del bloqueo (ej. 900_000 ms = 15 min)
}

export const DEFAULT_AUTH_RATE_LIMIT: RateLimitConfig = {
  windowMs: 60_000,
  maxAttempts: 5,
  quarantineMs: 15 * 60_000,
};

/** Valida si una IP debe ser bloqueada en base a su historial reciente de fallos */
export function recordIpAttempt(
  attempts: number[],
  nowMs = Date.now(),
  config: RateLimitConfig = DEFAULT_AUTH_RATE_LIMIT,
): { quarantined: boolean; recentCount: number } {
  const windowStart = nowMs - config.windowMs;
  const recent = attempts.filter((t) => t > windowStart);
  recent.push(nowMs);
  return {
    quarantined: recent.length >= config.maxAttempts,
    recentCount: recent.length,
  };
}
```

---

## 4. Algoritmo y Flujo de Lógica Paso a Paso

### 4.1. Servicio de Amenazas en `src/services/threat-shield-service.ts`

El servicio mantiene el estado perimetral en memoria con respaldo determinista:
1. **Mapas en Memoria:**
   - `ipAttemptsMap = new Map<string, number[]>()`: Registra timestamps de intentos fallidos por IP.
   - `quarantinedIpsMap = new Map<string, QuarantinedIpEntry>()`: Almacena IPs aisladas con su expiración.
2. **Función `registerFailedAuthAttempt(ip: string, reason: string)`:**
   - Limpia intentos anteriores a la ventana de 60 segundos.
   - Si la IP alcanza 5 intentos, genera una entrada en `quarantinedIpsMap` con `expiresAt = Date.now() + 15 * 60 * 1000`.
   - Registra de forma asíncrona un evento en `security_audit_logs`:
     ```typescript
     await auditSecurityEvent('threat_ip_quarantined', { ip, reason, durationMinutes: 15 });
     ```
3. **Función `isIpBlocked(ip: string)`:**
   - Comprueba si la IP está en `quarantinedIpsMap`.
   - Si existe y `expiresAt > Date.now()`, retorna `true`.
   - Si expiró, elimina la entrada del mapa y retorna `false`.
4. **Función `setDefconLevel(level: DefconLevel, operatorId: string, reason: string)`:**
   - Valida que `level` sea 1, 2, 3, 4 o 5.
   - Actualiza el switch en base de datos (`system_switches.defcon_level`).
   - Si se escala a `DEFCON 1`, habilita automáticamente `gatekeeper_enabled = true`.
   - Si se escala a `DEFCON 3`, `2` o `1`, deshabilita `registrations_open = false`.
   - Registra auditoría obligatoria:
     ```typescript
     await auditSecurityEvent('defcon_escalation', { level, operatorId, reason });
     ```

---

### 4.2. Endpoints de API

1. **`GET /api/guardian/soc/telemetry`:**
   - Requiere autenticación de administrador de Guardian (`authenticatedAdmin()`).
   - Retorna `SocTelemetryReport` consolidando:
     - Nivel DEFCON actual.
     - Lista de IPs en cuarentena activa.
     - Últimos 20 registros de `security_audit_logs`.
     - Contador de bloqueos.
2. **`POST /api/guardian/soc/defcon`:**
   - Body: `{ level: DefconLevel, reason: string }`.
   - Valida sesión de operador y longitud mínima de `reason` (mínimo 5 caracteres).
   - Ejecuta `setDefconLevel` y retorna `{ success: true, level }`.
3. **`POST /api/guardian/soc/quarantine`:**
   - Body: `{ action: 'block' | 'unblock', ip: string, reason?: string }`.
   - Permite al operador liberar una IP erróneamente bloqueada o bloquear preventivamente una IP hostil.

---

### 4.3. Componente Guardian SOC Panel (`src/components/guardian/guardian-soc-panel.tsx`)

Diseño visual Cyber-Defense integrado con `guardian.css`:
1. **Selector de Nivel DEFCON:**
   - Botones horizontales de 5 a 1 con colores representativos (Verde, Ámbar, Naranja, Rojo, Púrpura oscuro).
   - Al pulsar un nivel crítico (3, 2 o 1), solicita confirmación con diálogo de advertencia e ingreso obligatorio del motivo.
2. **Métricas en Vivo:**
   - 🛡️ *Ataques Bloqueados Hoy*
   - 🚫 *IPs en Cuarentena Activa*
   - ⚡ *Tiempo de Decisión WAF (< 5 ms)*
   - 🔐 *Estado de Registro (Abierto / Congelado)*
3. **Radar de Amenazas (Threat Feed):**
   - Tabla interactiva con badge de severidad, IP, evento y marca de tiempo.
4. **Gestor de Cuarentena:**
   - Lista de IPs bloqueadas con tiempo restante y botón para "Levantar Cuarentena" con un click.

---

### 4.4. Integración en `src/components/guardian/guardian-console.tsx`

- Añadir `'soc'` al tipo del estado `tab`:
  `'token' | 'players' | 'alert' | 'switches' | 'hud' | 'jira' | 'cloud' | 'status' | 'soc'`
- Registrar en la barra de navegación inferior `.guardian-bottom-nav`:
  `['soc', '🛡️', 'SOC Shield']`
- Renderizar `<GuardianSocPanel />` cuando `tab === 'soc'`.

---

## 5. Criterios de Aceptación Deterministas

1. **Mitigación Perimetral Automática:**
   - Simular 5 peticiones erróneas consecutivas desde una misma IP debe provocar que la 5ta petición aísle la IP y la 6ta sea rechazada con `HTTP 429` sin tocar la base de datos.
   - Pasados los 15 minutos (o forzando el desbloqueo manual), la IP debe poder operar nuevamente con normalidad.
2. **Escalamiento DEFCON Funcional:**
   - Conmutar a `DEFCON 3` congela `registrations_open` automáticamente.
   - Conmutar a `DEFCON 1` activa el modo `gatekeeper_enabled` automáticamente.
   - Cada cambio de DEFCON debe persistir en `security_audit_logs` con el ID del operador y el motivo.
3. **Consola Guardian (`/guardian`):**
   - La nueva pestaña `🛡️ SOC Shield` debe cargar las métricas en tiempo real.
   - Los botones de cambio de DEFCON y desbloqueo de IPs deben responder en menos de 500 ms con retroalimentación visual inmediata.
4. **Calidad y Verificación (0 regresiones):**
   - Ejecutar `npm run check` (ESLint, `next typegen && tsc --noEmit`, suite completa de pruebas unitarias y Prettier) debe finalizar con 0 errores y código de salida 0.
