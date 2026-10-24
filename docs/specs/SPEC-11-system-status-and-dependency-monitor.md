# SPEC-11: Monitor de Salud de Dependencias Externas, Uptime y Degradación Elegante

> **Documento:** Especificación Técnica Quirúrgica de Entrega  
> **Rama de Especificación:** `research/antigravity`  
> **Rama Destino de Implementación:** `implementation/chatgpt` (crear rama `feature/dependency-uptime-monitor`)  
> **Destinatario:** OpenAI Codex / Lead Engineer  
> **Estado:** Listo para Implementación  
> **Prioridad:** Alta (Confiabilidad de plataforma, prevención de tickets falsos de soporte, observabilidad DevOps)

---

## 1. Objetivo y Contexto

SaveState actúa como un agregador de entretenimiento y comunidad gamer que interactúa con múltiples proveedores y APIs externas críticas:
1. **Supabase PostgreSQL & Auth:** Base de datos relacional, sesiones y RLS.
2. **Valve Steam Web API:** Sincronización de horas de juego, logros y biblioteca.
3. **Twitch / IGDB v4 API:** Catálogo maestro de juegos, carátulas y fechas.
4. **Atlassian Jira Cloud:** Portal de soporte y tickets de telemetría.
5. **Discord Gateway & Webhooks:** Comunicación comunitaria y verificación de roles.
6. **Vercel Edge Network:** Runtime serverless y distribución global.

Actualmente, cuando un servicio de terceros sufre una degradación o mantenimiento programado (por ejemplo, el mantenimiento semanal de Steam los martes por la tarde), la plataforma no dispone de un mecanismo unificado para detectarlo de manera proactiva. Esto provoca que los usuarios experimenten errores confusos y generen reportes innecesarios en Jira.

El objetivo de **SPEC-11** es construir una solución integral de observabilidad y uptime:
1. **Sondas Sintéticas Livianas (*Heartbeat Probes*):** Monitoreo no destructivo de latencia (ms) y código de respuesta HTTP con caché en memoria (TTL de 30s) para evitar consumo excesivo de cuotas.
2. **Panel de Estado en Guardian Console (`/guardian`):** Pestaña dedicada `status` (`🌐 Uptime`) con semáforos en tiempo real, latencias y botón para ejecutar pruebas manuales.
3. **Página Pública de Estado (`/status`):** Vista transparente y accesible para la comunidad con el estado operativo de cada subsistema y % de disponibilidad.
4. **Degradación Elegante Proactiva (`DependencyAlertBanner`):** Banners preventivos contextuales en la interfaz (por ejemplo, en la biblioteca si Steam está caído) que informan al usuario antes de que intente una acción fallida.
5. **Cortafuegos de Telemetría para Jira:** Evita saturar la cola de soporte con errores genéricos cuando el problema es una caída declarada de un proveedor upstream.

---

## 2. Lista Exacta de Archivos a Crear / Modificar

| Acción | Archivo | Responsabilidad |
|---|---|---|
| **Crear** | `src/domain/dependency-monitor.ts` | Modelos de dominio, tipos TypeScript, umbrales de latencia y funciones puras de evaluación de estado operativo. |
| **Crear** | `src/services/dependency-monitor-service.ts` | Motor de sondas no destructivas para cada upstream con caché en memoria (TTL 30s), cálculo de latencia en milisegundos y reporte global. |
| **Modificar** | `src/app/api/system-status/route.ts` | Extender el endpoint público para devolver el informe consolidado de salud (`health: SystemHealthReport`). |
| **Crear** | `src/app/api/guardian/dependencies/probe/route.ts` | Endpoint autenticado para operadores de Guardian que fuerza un sondeo inmediato sin esperar la expiración de la caché. |
| **Crear** | `src/components/guardian/guardian-status-panel.tsx` | Componente cliente con tarjetas de dependencias, semáforos (`🟢`, `🟡`, `🔴`), barras de latencia y botón de diagnóstico. |
| **Modificar** | `src/components/guardian/guardian-console.tsx` | Registrar la pestaña `'status'` en el estado de pestañas y en la barra de navegación inferior (`['status', '🌐', 'Uptime']`). |
| **Crear** | `src/components/dependency-alert-banner.tsx` | Banner contextual cliente que alerta con elegancia al usuario si una dependencia crítica está degradada. |
| **Crear** | `src/app/status/page.tsx` | Página pública de estado en `/status` para jugadores y visitantes, con diseño retro-cyber. |
| **Crear** | `tests/unit/dependency-monitor.test.ts` | Pruebas unitarias de evaluación de salud, umbrales de latencia, caché con TTL y mitigación de fallos de red. |

---

## 3. Contratos de Tipos Estrictos (TypeScript)

### `src/domain/dependency-monitor.ts`

```typescript
export const DEPENDENCY_SERVICE_IDS = [
  'supabase',
  'steam',
  'igdb',
  'jira',
  'discord',
  'vercel',
] as const;

export type DependencyServiceId = (typeof DEPENDENCY_SERVICE_IDS)[number];

export type DependencyHealthStatus = 'operational' | 'degraded' | 'down' | 'maintenance';

export interface DependencyHealthCheck {
  id: DependencyServiceId;
  name: string;
  category: 'database' | 'gaming' | 'devops' | 'infrastructure';
  status: DependencyHealthStatus;
  latencyMs: number;
  lastCheckedAt: string; // ISO 8601
  message: string;
  endpointPreview: string;
}

export interface SystemHealthReport {
  overall: DependencyHealthStatus;
  services: DependencyHealthCheck[];
  averageLatencyMs: number;
  operationalCount: number;
  degradedCount: number;
  outageCount: number;
  generatedAt: string;
}

export interface DependencyThresholds {
  degradedLatencyMs: number; // Por defecto: 1000ms
  downLatencyMs: number;     // Por defecto: 3500ms (timeout)
}

/** Determina el estado de salud de una sonda en base a latencia y errores */
export function evaluateHealthStatus(
  latencyMs: number,
  isError: boolean,
  isTimeout: boolean,
  thresholds: DependencyThresholds = { degradedLatencyMs: 1000, downLatencyMs: 3500 },
): DependencyHealthStatus {
  if (isTimeout || isError) return 'down';
  if (latencyMs >= thresholds.degradedLatencyMs) return 'degraded';
  return 'operational';
}

/** Calcula el estado global en base a la severidad de las dependencias */
export function computeOverallHealth(services: DependencyHealthCheck[]): DependencyHealthStatus {
  if (services.some((s) => s.status === 'down')) {
    // Si la base de datos principal está caída, el sistema está down; si es un upstream periférico, está degraded
    const dbDown = services.find((s) => s.id === 'supabase')?.status === 'down';
    return dbDown ? 'down' : 'degraded';
  }
  if (services.some((s) => s.status === 'degraded')) return 'degraded';
  return 'operational';
}
```

---

## 4. Algoritmo y Flujo de Lógica Paso a Paso

### 4.1. Motor de Sondas en `src/services/dependency-monitor-service.ts`

El servicio debe mantener un singleton en memoria con una ventana de validez (*TTL*) de **30 segundos**:
```typescript
interface CacheEntry {
  report: SystemHealthReport;
  expiresAt: number;
}
let cachedReport: CacheEntry | null = null;
```

**Sondas Individuales (Ejecutadas en Paralelo mediante `Promise.allSettled`):**

1. **Supabase Database:**
   - Ejecuta una consulta ultraliviana a nivel de cabecera con timeout de 3.000 ms:
     ```typescript
     const start = Date.now();
     const client = createClient(url, key, { auth: { persistSession: false } });
     const { error } = await client.from('system_switches').select('key', { count: 'exact', head: true }).abortSignal(AbortSignal.timeout(3000));
     const latencyMs = Date.now() - start;
     ```
2. **Valve Steam Web API:**
   - Sonda al endpoint de salud público de Steam:
     `https://api.steampowered.com/ISteamWebAPIUtil/GetServerInfo/v1/`
   - O si no hay conexión externa o falta de cuota, ping ligero con `AbortSignal.timeout(3500)`.
3. **Twitch / IGDB:**
   - Comprueba la validez de las credenciales de cliente o realiza una consulta de verificación con `AbortSignal.timeout(3500)`.
4. **Atlassian Jira Cloud:**
   - Verifica el portal configurado (`portalUrl` de `jiraConfig()`) con una petición `HEAD` o `GET` ligero con `AbortSignal.timeout(3000)`.
5. **Discord Gateway:**
   - Consulta rápida al endpoint público de gateway de Discord:
     `https://discord.com/api/v10/gateway` (no requiere token bot, devuelve `{ "url": "wss://..." }` y mide la latencia de Cloudflare/Discord).
6. **Vercel Edge:**
   - Calcula el tiempo de procesamiento local del handler del servidor (típicamente 1 a 15 ms).

**Consolidación y Caché:**
- Si `forceRefresh === false` y `cachedReport && cachedReport.expiresAt > Date.now()`, retornar `cachedReport.report` inmediatamente.
- De lo contrario, calcular el nuevo `SystemHealthReport`, guardarlo con `expiresAt = Date.now() + 30_000` y retornarlo.

---

### 4.2. Ampliación de `src/app/api/system-status/route.ts`

```typescript
import { getSystemSwitches, getActiveSystemBroadcast } from '@/services/system-state';
import { getSystemHealthReport } from '@/services/dependency-monitor-service';
import { errorResponse } from '@/lib/http';

export async function GET() {
  try {
    const [switches, broadcast, health] = await Promise.all([
      getSystemSwitches(),
      getActiveSystemBroadcast(),
      getSystemHealthReport(false),
    ]);
    return Response.json(
      { switches, broadcast, health },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
```

---

### 4.3. Endpoint de Sondeo Manual: `src/app/api/guardian/dependencies/probe/route.ts`

- Requiere autenticación de administrador mediante sesión activa de Guardian (`authenticated()`).
- Llama a `getSystemHealthReport(true)` forzando el bypass de caché.
- Devuelve el nuevo `SystemHealthReport` en tiempo real.

---

### 4.4. Componente Guardian Status Panel (`src/components/guardian/guardian-status-panel.tsx`)

Usa las clases de estilo ya existentes en `src/app/guardian.css` (`.guardian-cloud-card`, `.guardian-cloud-header`, `.status-ready`, etc.):
- **Cabecera de Salud:**
  - Insignia grande con pulso de luz:
    - 🟢 `TODOS LOS SISTEMAS OPERATIVOS`
    - 🟡 `DEGRADACIÓN PARCIAL DE SERVICIOS`
    - 🔴 `INCIDENTE DETECTADO EN DEPENDENCIAS CRÍTICAS`
  - Métricas agregadas: Latencia promedio (ms), conteo de servicios online (ej. 6/6), última lectura.
  - Botón: `⚡ Ejecutar Ping Test Ahora` con spinner durante la petición.
- **Cuadrícula de Servicios (Cards):**
  - Cada tarjeta muestra:
    - Ícono representativo (🗄️ Supabase, 🎮 Steam, 🕹️ IGDB, 🎫 Jira, 🤖 Discord, ☁️ Vercel).
    - Nombre del servicio y categoría.
    - Tag de estado con color semafórico.
    - Barra de progreso de latencia (verde < 300ms, amarillo < 1000ms, rojo > 1000ms).
    - Mensaje de diagnóstico.

---

### 4.5. Página Pública de Estado (`src/app/status/page.tsx`)

- Ruta pública accesible en `/status`.
- Carga `getSystemHealthReport(false)` directamente en el Server Component.
- Título: `SaveState System Status & Dependencias`.
- Diseño limpio y responsive con tema Cyber/Dark característico del proyecto.
- Permite a cualquier usuario verificar si un problema que experimenta es local o proviene de Valve/IGDB/Discord.

---

### 4.6. Componente de Aviso Preventivo (`src/components/dependency-alert-banner.tsx`)

- Recibe prop opcional `service?: DependencyServiceId` (por ejemplo `service="steam"` en la página de biblioteca o importación).
- Monitorea el estado mediante `startSystemStatusPolling` o lectura del reporte.
- Si el servicio indicado está `down` o `maintenance`, despliega una barra de advertencia discreta:
  ```tsx
  <div className="system-alert-strip warning" role="status">
    <span>⚠️ <strong>Aviso de Upstream:</strong> La API de {serviceName} presenta intermitencias temporales. Las operaciones locales continúan funcionando con normalidad.</span>
  </div>
  ```

---

## 5. Criterios de Aceptación Deterministas

1. **Monitoreo y Métricas en Tiempo Real:**
   - La llamada a `GET /api/system-status` devuelve el objeto `health` con la lista de los 6 servicios evaluados y sus latencias en milisegundos.
   - Peticiones consecutivas dentro de los 30 segundos reutilizan la caché en memoria y no generan tráfico repetido a las APIs externas.
2. **Consola Guardian (`/guardian`):**
   - La barra de navegación inferior incluye la pestaña `['status', '🌐', 'Uptime']`.
   - Al pulsar la pestaña, se despliega el panel `GuardianStatusPanel` con los semáforos y latencias en vivo.
   - El botón de reintento manual actualiza las métricas en pantalla.
3. **Página Pública (`/status`):**
   - Visitar `/status` responde con código HTTP 200 y renderiza el tablero de servicios de forma estéticamente integrada.
4. **Resiliencia ante Fallos Externos:**
   - Si una de las APIs externas (por ejemplo, Steam) no responde o arroja timeout (3.500 ms), el servicio captura el fallo elegantemente, marca el estado como `down` con latencia tope y la aplicación continúa funcionando sin arrojar excepciones 500 no controladas.
5. **Calidad y Verificación (0 regresiones):**
   - Ejecutar `npm run check` (ESLint, `next typegen && tsc --noEmit`, suite de pruebas unitarias y Prettier) debe finalizar con 0 errores y código de salida 0.
