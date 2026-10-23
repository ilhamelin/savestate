# SPEC-05: Integración SaveState x Jira Cloud & Sistema de Telemetría e Incidentes

> **Documento:** Especificación Técnica Quirúrgica de Entrega  
> **Rama de Especificación:** `research/antigravity`  
> **Rama Destino de Implementación:** `implementation/chatgpt` (crear `feature/jira-cloud-integration`)  
> **Destinatario:** OpenAI Codex / Lead Engineer  
> **Prioridad:** Alta (Arquitectura Conectada, Soporte de Comunidad, Observabilidad en Producción)

---

## 1. Objetivo y Contexto

El ecosistema de desarrollo cuenta con dos plataformas en producción:
1. **SaveState:** Plataforma gamer social y biblioteca interactiva en Next.js 16 + Supabase ([savestate-eight.vercel.app](https://savestate-eight.vercel.app)).
2. **Portal de Solicitudes Jira:** Sistema empresarial de gestión de tickets conectado con Atlassian Jira Cloud REST API v3 en FastAPI + PostgreSQL ([portal-solicitudes-jira.vercel.app](https://portal-solicitudes-jira.vercel.app) / API en Render).

Esta especificación formaliza la **conexión bidireccional entre ambos mundos**, dotando a SaveState de:
1. **Canal de Soporte & Feedback para Usuarios (Bugs / Sugerencias de Juegos):**
   * Modal accesible desde el pie de página de SaveState: `[ 👾 Reportar Bug / Sugerir Juego ]`.
   * Permite a cualquier jugador reportar fallos técnicos o pedir títulos para el catálogo.
   * Transmite el requerimiento automáticamente al backend de Jira (`jira-portal-solicitudes.onrender.com/api/v1/solicitudes`) y devuelve un código de ticket real (ej. `SOL-149`).
2. **Centro de Control Jira en `/guardian` para el Administrador:**
   * La consola exclusiva del operador supremo (`/guardian` en [`src/components/guardian/guardian-console.tsx`](file:///src/components/guardian/guardian-console.tsx)) suma una nueva pestaña: `[ 🎫 Jira & Tickets ]`.
   * **Botón 1-Click a Atlassian Jira Cloud:** Enlace directo a `https://portal-solicitudes-dev.atlassian.net` para gestionar el backlog y los tableros Kanban del proyecto `SOL``.
   * **Botón 1-Click al Portal Web:** Enlace directo a `https://portal-solicitudes-jira.vercel.app`.
   * Visor en tiempo real de los tickets recibidos desde SaveState.
3. **Telemetría y Auto-Reporte de Errores (Error Tracking):**
   * Capturador de excepciones no controladas en el cliente (`error.tsx` y listeners globales) que reporta a `/api/telemetry/errors`.
   * Registro de los últimos incidentes en Guardian con opción de **escalar a ticket de Jira en 1 clic** adjuntando el stacktrace y los metadatos de sesión.

---

## 2. Lista Exacta de Archivos a Crear / Modificar

| Acción | Archivo | Responsabilidad |
|---|---|---|
| **Crear** | `src/domain/support-ticket.ts` | Definición de tipos TypeScript (`SupportTicketInput`, `SupportTicketCreated`, `TelemetryErrorEvent`, `JiraLinkConfig`), constantes y esquemas de validación. |
| **Crear** | `src/services/jira-support-service.ts` | Servicio de servidor Next.js que procesa y retransmite reportes al backend de Jira Cloud en Render o directo a Jira REST v3. |
| **Crear** | `src/components/support/feedback-modal.tsx` | Modal interactivo Cyberpunk para reportar bugs o sugerencias desde el frontend con feedback del ticket `SOL-XXX`. |
| **Crear** | `src/components/guardian/guardian-jira-panel.tsx` | Pestaña de gestión de Jira dentro de `/guardian`: accesos directos 1-click, visor de tickets y registro de errores con escalado a Jira. |
| **Modificar** | `src/components/guardian/guardian-console.tsx` | Incorporar la pestaña `['jira', '🎫', 'Jira / Tickets']` en el menú de navegación inferior y el renderizado del panel. |
| **Crear** | `src/app/api/support/tickets/route.ts` | Endpoint API `POST` seguro para recibir feedback público con rate-limiting y sanitización. |
| **Crear** | `src/app/api/telemetry/errors/route.ts` | Endpoint API `POST` y `GET` para almacenar y consultar errores capturados para el panel de Guardian. |
| **Modificar** | `src/app/layout.tsx` | Añadir botón/enlace en el pie de página de SaveState para abrir el modal de feedback. |
| **Modificar** | `.env.example` | Documentar variables de entorno de integración (`JIRA_INSTANCE_URL`, `JIRA_PORTAL_URL`, `JIRA_API_URL`, `JIRA_PROJECT_KEY`). |
| **Crear** | `tests/unit/jira-support.test.ts` | Pruebas unitarias para validación de tickets, sanitización XSS, resiliencia ante caídas de red y mapeo de errores. |

---

## 3. Contratos de Tipos Estrictos (TypeScript)

En `src/domain/support-ticket.ts`:

```typescript
export type SupportTicketType = 'bug' | 'game_suggestion' | 'feature_request';
export type SupportTicketPriority = 'baja' | 'media' | 'alta' | 'urgente';

export interface SupportTicketInput {
  type: SupportTicketType;
  title: string;
  description: string;
  contactEmail?: string | null;
  username?: string | null;
  pageUrl: string;
  systemContext?: {
    userAgent: string;
    screenResolution?: string;
    theme?: string;
  };
}

export interface SupportTicketCreated {
  ticketId: string; // ej. "SOL-149" o ID local de contingencia
  status: 'synced_jira' | 'queued' | 'stored_local';
  createdAt: string;
  jiraUrl?: string;
  message: string;
}

export interface TelemetryErrorEvent {
  id: string;
  message: string;
  stack?: string;
  pathname: string;
  timestamp: string;
  userId?: string | null;
  userAgent: string;
  escalatedToJira: boolean;
  jiraIssueKey?: string | null;
}

export interface JiraLinkConfig {
  instanceUrl: string; // "https://portal-solicitudes-dev.atlassian.net"
  portalUrl: string;   // "https://portal-solicitudes-jira.vercel.app"
  apiUrl: string;      // "https://jira-portal-solicitudes.onrender.com/api/v1"
  projectKey: string;  // "SOL"
}

export const DEFAULT_JIRA_CONFIG: JiraLinkConfig = {
  instanceUrl: process.env.JIRA_INSTANCE_URL || 'https://portal-solicitudes-dev.atlassian.net',
  portalUrl: process.env.JIRA_PORTAL_URL || 'https://portal-solicitudes-jira.vercel.app',
  apiUrl: process.env.JIRA_API_URL || 'https://jira-portal-solicitudes.onrender.com/api/v1',
  projectKey: process.env.JIRA_PROJECT_KEY || 'SOL',
};
```

---

## 4. Algoritmo y Flujo de Lógica Paso a Paso

### 4.1. Canal de Reportes del Usuario (`feedback-modal.tsx`)
1. El usuario hace clic en `[ Reportar Bug o Sugerir ]` en el footer de SaveState.
2. Se abre el modal con foco atrapado y soporte de tecla `Escape`.
3. El usuario completa:
   * Categoría: `Bug / Error`, `Sugerir Juego al Catálogo`, `Mejora de la Web`.
   * Título (5 a 200 caracteres).
   * Detalle (mínimo 10 caracteres).
   * Email opcional para seguimiento.
4. El cliente envía `POST /api/support/tickets`.
5. El backend de SaveState:
   * Aplica rate-limit básico por IP (máximo 5 reportes cada 10 minutos).
   * Sanitiza entradas con `isomorphic-dompurify`.
   * Llama a `POST https://jira-portal-solicitudes.onrender.com/api/v1/solicitudes` con timeout de 8 segundos.
   * Si la API de Render responde exitosamente, extrae el `jira_issue_key` o `id` y responde al cliente.
   * **Modo Resiliente (Fallback):** Si el backend de Render está en reposo (*cold-start*) o sin conexión, SaveState guarda el reporte en la tabla de soporte local y devuelve:  
     `{ ticketId: "LOCAL-" + uuid.slice(0,6), status: "queued", message: "Reporte registrado en la bitácora; se sincronizará con Jira automáticamente." }`.
6. El modal muestra confirmación visual con confetti o badge de éxito y se cierra suavemente.

### 4.2. Consola de Mando Jira en `/guardian` (`guardian-jira-panel.tsx`)
1. Solo accesible si `isGuardianAdmin` es verdadero.
2. Muestra 2 tarjetas de acceso rápido:
   * `[ 🚀 Abrir Jira Cloud Atlassian (SOL) ↗ ]`: Enlace con `target="_blank" rel="noopener noreferrer"` directo a `https://portal-solicitudes-dev.atlassian.net`.
   * `[ 🌐 Abrir Portal Web de Solicitudes ↗ ]`: Enlace a `https://portal-solicitudes-jira.vercel.app`.
3. Muestra métricas de estado de conexión con el backend de Render (`/health`).
4. **Visor de Telemetría de Errores:**
   * Muestra la tabla de los últimos errores capturados en SaveState (ej. fallos de fetch en APIs externas, errores de hidratación o excepciones).
   * Botón `[ ⚡ Escalar a Ticket de Jira ]`: toma el mensaje, el stack y la URL, e invoca la API para crear un ticket de tipo `incidente` prioritario en Jira Cloud.

### 4.3. Captura Automática de Telemetría (`/api/telemetry/errors`)
1. En `src/app/error.tsx` o en un interceptor global:
   ```typescript
   export function reportClientError(error: Error, pathname: string) {
     if (typeof window === 'undefined') return;
     const payload = {
       message: error.message || 'Unknown Error',
       stack: error.stack?.slice(0, 1500),
       pathname,
       userAgent: navigator.userAgent,
       timestamp: new Date().toISOString(),
     };
     navigator.sendBeacon?.('/api/telemetry/errors', JSON.stringify(payload)) ||
       fetch('/api/telemetry/errors', {\n         method: 'POST',\n         headers: { 'Content-Type': 'application/json' },\n         body: JSON.stringify(payload),\n         keepalive: true,\n       }).catch(() => {});\n   }\n   ```
2. La ruta `/api/telemetry/errors` mantiene un ring-buffer en memoria (máximo 50 eventos) desduplicados por hash para evitar saturación de logs.

---

## 5. Diseño Visual y Estilos

1. **Modal de Feedback:**
   * Estilo terminal cyberpunk: fondo `#0b0f19`, borde neón `#00f0ff`, botones retro `[ Transmitir Ticket ]`.
   * Chips de selección rápida de categoría con iconos: `🐛 Bug`, `🎮 Sugerir Juego`, `⚡ Feature`.
2. **Panel de Guardian:**
   * Sigue la estética de la consola Guardian (`guardian.css`): tipografía mono, indicadores de estado `● ONLINE / ○ STANDBY`, badges de severidad (`Urgente` rojo, `Media` amarillo, `Baja` verde).

---

## 6. Criterios de Aceptación Deterministas y Casos Borde

1. **Seguridad y Privacidad:**
   * Ningún token o secreto privado de Jira se expone al navegador cliente.
   * La pestaña `jira` en Guardian solo se renderiza si el usuario es el administrador autorizado (`benjaigancioreyes56@gmail.com`).
2. **Resiliencia (Zero Downtime Impact):**
   * Si la API de Jira/Render está caída o tarda más de 8s, la web de SaveState **nunca** debe fallar ni bloquear al usuario; debe responder con estado `queued` de forma transparente.
3. **Control de Abuso (Spam Protection):**
   * Validación estricta de longitud de texto (título >= 5 caracteres, detalle >= 10 caracteres).
   * Rate limiting por IP en `/api/support/tickets`.
4. **Suite de Pruebas Unitarias (`tests/unit/jira-support.test.ts`):**
   * Validar el validador de tickets con inputs válidos e inválidos.
   * Validar la sanitización de payloads evitando inyección de etiquetas `<script>` o HTML malicioso.
   * Validar el comportamiento de fallback cuando el backend externo no está disponible.
   * Validar la estructura del ring-buffer de telemetría de errores.
5. **Verificación CI:**
   * `npm run lint` sin advertencias.
   * `npx tsc --noEmit` sin errores de tipo.
   * `npm test` exitoso en todos los tests (>= 348 tests).
