# SPEC-06: Monitor DevOps y Telemetría de Nube (GitHub & Vercel) en Guardian

> **Documento:** Especificación Técnica Quirúrgica de Entrega  
> **Rama de Especificación:** `research/antigravity`  
> **Rama Destino de Implementación:** `implementation/chatgpt` (crear `feature/guardian-cloud-monitor`)  
> **Destinatario:** OpenAI Codex / Lead Engineer  
> **Prioridad:** Alta (Observabilidad de Infraestructura Full-Cloud, Operación Móvil)

---

## 1. Objetivo y Contexto

SaveState se gestiona y opera bajo un paradigma 100% en la nube:
* **Repositorio y CI/CD:** GitHub (`ilhamelin/savestate`) + GitHub Actions (`.github/workflows/ci.yml`).
* **Hosting y Despliegue:** Vercel Serverless Lambdas (`savestate-eight.vercel.app`).
* **Base de Datos y Auth:** Supabase PostgreSQL 17 (`us-east-1`).
* **Consola de Operador Móvil:** SaveState Guardian PWA (`/guardian`), reservada al operador supremo (`benjaigancioreyes56@gmail.com` / `@ilhamelin_v2`).

El objetivo de esta especificación es **incorporar un Centro de Control DevOps en tiempo real dentro de Guardian**, permitiendo al operador supervisar desde su teléfono móvil:
1. **Despliegues de Vercel en vivo:** Estado de producción y preview (`BUILDING` 🟡 con animación de pulso, `READY` 🟢, `ERROR` 🔴), duración de la compilación, commit disparador y enlace directo al inspector de Vercel.
2. **Actividad de GitHub:** Últimos commits incorporados en `main` e `implementation/chatgpt`, autor, mensaje y enlaces.
3. **Estado de GitHub Actions (CI/CD Runner):** Resultado de las suites de prueba y linters (`npm run check`) con enlace directo a los logs del runner.
4. **Pull Requests Activos:** Monitor de PRs pendientes de revisión o integración.

---

## 2. Lista Exacta de Archivos a Crear / Modificar

| Acción | Archivo | Responsabilidad |
|---|---|---|
| **Crear** | `src/domain/cloud-observer.ts` | Modelos de dominio y contratos TypeScript (`VercelDeploymentSummary`, `GitHubCommitSummary`, `GitHubWorkflowRunSummary`, `GitHubPullRequestSummary`, `CloudObserverFeed`), utilidades de formateo de duración y estados. |
| **Crear** | `src/services/cloud-observer-service.ts` | Servicio de servidor Next.js que consulta las APIs REST de GitHub y Vercel en paralelo, con caché en memoria (TTL 30s) y tolerancia a fallos/falta de credenciales. |
| **Crear** | `src/app/api/guardian/cloud-feed/route.ts` | Endpoint API `GET` protegido exclusivamente con `authenticatedAdmin()` que suministra el feed consolidado de nube. |
| **Crear** | `src/components/guardian/guardian-cloud-panel.tsx` | Componente de UI para Guardian con estética Cyberpunk: radar de despliegues Vercel, timeline de commits, monitor de CI/CD y PRs, auto-refresco y recarga manual. |
| **Modificar** | `src/components/guardian/guardian-console.tsx` | Añadir la pestaña `['cloud', '☁️', 'Cloud / CI']` al menú de navegación inferior y renderizar `GuardianCloudPanel`. |
| **Modificar** | `.env.example` | Documentar variables opcionales de integración: `VERCEL_TOKEN`, `VERCEL_PROJECT_ID` y `GITHUB_TOKEN`. |
| **Crear** | `tests/unit/cloud-observer.test.ts` | Pruebas unitarias deterministas: normalizadores de Vercel y GitHub, cálculo de duraciones, caché en memoria y resiliencia ante errores de red o cuotas. |

---

## 3. Contratos de Tipos Estrictos (TypeScript)

En `src/domain/cloud-observer.ts`:

```typescript
export type VercelDeploymentState = 'BUILDING' | 'READY' | 'ERROR' | 'CANCELED' | 'INITIALIZING';
export type CiRunConclusion = 'success' | 'failure' | 'cancelled' | 'timed_out' | 'in_progress' | 'queued' | 'unknown';

export interface VercelDeploymentSummary {
  id: string;
  url: string;
  inspectorUrl: string | null;
  state: VercelDeploymentState;
  target: 'production' | 'preview' | null;
  commitSha: string | null;
  shortSha: string | null;
  commitMessage: string | null;
  commitAuthor: string | null;
  createdAt: number;
  buildingAt: number | null;
  readyAt: number | null;
  durationSec: number | null;
}

export interface GitHubCommitSummary {
  sha: string;
  shortSha: string;
  message: string;
  author: string;
  avatarUrl: string | null;
  date: string;
  url: string;
  branch: string;
}

export interface GitHubWorkflowRunSummary {
  id: number;
  name: string;
  status: 'completed' | 'in_progress' | 'queued';
  conclusion: CiRunConclusion;
  htmlUrl: string;
  event: string;
  headBranch: string;
  headSha: string;
  shortSha: string;
  createdAt: string;
  updatedAt: string;
  runDurationSec: number | null;
}

export interface GitHubPullRequestSummary {
  number: number;
  title: string;
  state: 'open' | 'closed';
  htmlUrl: string;
  author: string;
  avatarUrl: string | null;
  createdAt: string;
  draft: boolean;
  headBranch: string;
  baseBranch: string;
}

export interface CloudObserverFeed {
  vercel: {
    configured: boolean;
    latestProduction: VercelDeploymentSummary | null;
    recentDeployments: VercelDeploymentSummary[];
  };
  github: {
    configured: boolean;
    recentCommits: GitHubCommitSummary[];
    latestWorkflowRun: GitHubWorkflowRunSummary | null;
    openPullRequests: GitHubPullRequestSummary[];
  };
  measuredAt: string;
}
```

---

## 4. Algoritmo y Flujo de Lógica Paso a Paso

### 4.1. Servicio de Backend (`cloud-observer-service.ts`)

1. **Gestión de Caché en Memoria (Serverless Instance):**
   * Variable en memoria `cachedFeed: { data: CloudObserverFeed; expiresAt: number } | null`.
   * Si `Date.now() < cachedFeed.expiresAt`, retornar inmediatamente la copia en caché (TTL: 30.000 ms).
2. **Consulta a la API de Vercel:**
   * Token: `process.env.VERCEL_TOKEN`.
   * Project ID: `process.env.VERCEL_PROJECT_ID` (opcional: si no existe, filtrar por `app=savestate` o consultar `/v9/projects/savestate`).
   * Endpoint: `https://api.vercel.com/v6/deployments?limit=6&projectId=${projectId}`.
   * Header: `Authorization: Bearer ${VERCEL_TOKEN}`.
   * Si no hay token o la petición responde con error (`401`, `403`, `500`), capturar silenciosamente y devolver `{ configured: false, latestProduction: null, recentDeployments: [] }`.
3. **Consulta a la API de GitHub:**
   * Repositorio canónico: `ilhamelin/savestate`.
   * Headers: `Accept: application/vnd.github.v3+json`, `User-Agent: SaveState-Guardian``.
   * Si `process.env.GITHUB_TOKEN` está configurado, añadir `Authorization: Bearer ${GITHUB_TOKEN}` (aumenta el límite de 60 req/h a 5.000 req/h). Si no está configurado, consultar en modo público de solo lectura.
   * Consultas concurrentes vía `Promise.allSettled`:
     * Commits en `main`: `/repos/ilhamelin/savestate/commits?sha=main&per_page=4`
     * Commits en `implementation/chatgpt`: `/repos/ilhamelin/savestate/commits?sha=implementation/chatgpt&per_page=3`
     * Workflow runs: `/repos/ilhamelin/savestate/actions/runs?per_page=3`
     * Pull requests abiertos: `/repos/ilhamelin/savestate/pulls?state=open&per_page=5`
4. **Consolidación y Mapeo Seguro:**
   * Desduplicar commits que aparezcan en ambas ramas, ordenándolos por fecha descendente.
   * Calcular la duración del último run de CI y la duración del build de Vercel en segundos.
   * Almacenar en la caché en memoria y retornar el objeto `CloudObserverFeed`.

### 4.2. Endpoint API (`/api/guardian/cloud-feed/route.ts`)

1. Valida la sesión llamando a `await authenticatedAdmin()`. Si no es admin, lanza `AppError('Acceso restringido al operador supremo.', 403)`.
2. Llama a `fetchCloudObserverFeed()`.
3. Retorna `Response.json(feed, { headers: { 'Cache-Control': 'private, no-store' } })`.

### 4.3. Componente Móvil (`guardian-cloud-panel.tsx`)

1. **Ciclo de Vida y Auto-Polling:**
   * Realiza un fetch inicial al montar el componente.
   * Escucha eventos `visibilitychange` y `online`. Solo ejecuta polling de 30 segundos si la pestaña está activa (`document.visibilityState === 'visible'`) y hay conexión (`navigator.onLine`).
   * Limpia timers y aborta controladores al desmontarse.
2. **Diseño Visual Cyberpunk:**
   * **Tarjeta Vercel Production:**
     * Píldora de estado:
       * `🟢 READY` (Verde esmeralda neón)
       * `🟡 BUILDING` (Ámbar pulsante con animación CSS `pulse`)
       * `🔴 ERROR` (Rojo carmesí)
     * Resumen: SHA corto del commit, mensaje truncado, tiempo de compilación (`42s`), entorno (`Producción`).
     * Enlace con 1-clic a la web desplegada y al inspector de Vercel.
   * **Tarjeta CI/CD Runner (GitHub Actions):**
     * Indicador de suite: `✓ PASS (check)` o `✕ FAIL`.
     * Rama evaluada, tiempo de ejecución del workflow y enlace directo a los logs del runner en GitHub.
   * **Tarjeta Historial de Commits:**
     * Lista de los últimos 5 commits con badges de rama (`main` en cian `#00f0ff`, `chatgpt` en verde `#00ff88`), hora local y autor.
   * **Tarjeta Pull Requests Activos:**
     * Muestra PRs abiertos (ej. PR #5) con su número, título y enlace para revisar o fusionar.
   * Botón superior `↻ Refrescar ahora` con indicador de estado ocupado (`busy`).

---

## 5. Criterios de Aceptación Deterministas y Casos Borde

1. **Seguridad Absoluta:**
   * La ruta `/api/guardian/cloud-feed` requiere estrictamente `authenticatedAdmin()`. No es accesible por usuarios comunes ni por visitantes no autenticados.
   * Ningún token sensible (`VERCEL_TOKEN`, `GITHUB_TOKEN`) es enviado al navegador; el cliente solo recibe la información normalizada y sanitizada.
2. **Resiliencia ante Ausencia de Credenciales:**
   * Si no se configuran `VERCEL_TOKEN` o `GITHUB_TOKEN`, la interfaz **nunca debe romperse ni arrojar errores 500**. Mostrará un mensaje informativo discreto indicando cómo activarlos.
3. **Control de Cuota de API:**
   * La caché serverless de 30 segundos garantiza que múltiples refrescos rápidos desde el móvil no agoten el límite de peticiones de GitHub ni de Vercel.
4. **Verificación de Suite:**
   * Pruebas unitarias en `tests/unit/cloud-observer.test.ts` que validen:
     * Transformación de payloads JSON de GitHub y Vercel en los tipos del dominio.
     * Funcionamiento de la caché en memoria y expiración tras 30s.
     * Fallback cuando los proveedores devuelven 401, 404 o 500.
   * `npm run check` (ESLint, TypeScript, 380+ tests) en verde.
   * 0 dependencias npm añadidas.
