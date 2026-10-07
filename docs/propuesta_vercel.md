# Propuesta Técnica: Adopción de Vercel para Despliegue y Gestión de Entorno
**Fecha:** 7 de octubre de 2026  
**Origen:** Auditoría de Investigación (`research/antigravity`)  
**Destino:** Equipo de Implementación (`implementation/chatgpt` / Codex)  
**Propósito:** Evaluación y propuesta para adopción de Vercel como plataforma de hosting, dominio HTTPS y gestión de variables de entorno para SaveState.

---

## 1. Justificación y Alineación Arquitectónica

SaveState está construido sobre **Next.js 16 (App Router)**, **React 19** y **Supabase (PostgreSQL 16)**. La infraestructura natural recomendada para este stack es **Vercel**, tanto por capacidades operacionales como por el cumplimiento de los requerimientos del proyecto.

### Beneficios Principales

1. **Dominio HTTPS Administrado Inmediato:**
   - La autenticación OAuth (Discord, Google) y las cookies de sesión SSR seguras con PKCE exigen HTTPS en producción.
   - En `src/lib/env.ts` se valida estrictamente:
     ```typescript
     if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname))
       throw new Error('La URL de producción debe usar HTTPS.');
     ```
   - Vercel provee subdominio automático con certificados SSL gestionados (`https://[proyecto].vercel.app`), habilitando las URLs de callback OAuth sin requerir compra de dominio ni configuración manual de certificados en fases tempranas.

2. **Gestión Centralizada y Segura de Secretos:**
   - Permite segregar variables públicas de cliente (`NEXT_PUBLIC_*`) y secretos estrictos de servidor (`SUPABASE_SERVICE_ROLE_KEY`, `TWITCH_CLIENT_SECRET`) directamente en la plataforma.
   - Permite sincronizar variables al entorno de desarrollo local mediante la CLI oficial:
     ```powershell
     npx vercel env pull .env.local
     ```

3. **Caché Distribuida en Edge (RNF-02):**
   - El proxy del catálogo implementa `unstable_cache` con revalidación de 24 horas (`revalidate: 86400`) en `src/integrations/igdb/server.ts`.
   - Vercel Data Cache soporta esta primitiva de forma nativa a nivel de Edge, asegurando tiempos de respuesta < 1.5 s en consultas de catálogo caliente.

4. **Desacoplamiento de WebSockets:**
   - Las conexiones en tiempo real de `RealtimeFeed` (`activity_logs`) se abren directamente desde el navegador hacia el clúster de Supabase vía WebSockets, por lo que no consumen tiempo de ejecución ni límites de serverless functions en Vercel.

---

## 2. Puntos Técnicos Críticos para Compatibilidad con Vercel

Para que el despliegue en Vercel opere sin anomalías, se deben considerar los siguientes requisitos técnicos identificados en la auditoría:

### A. Formalización de `src/middleware.ts`
En el entorno serverless de Vercel, la ejecución de Edge Middleware exige la convención estándar `src/middleware.ts`. Mantener el archivo únicamente como `src/proxy.ts` causará que Vercel omita el middleware, impidiendo:
- La inyección de la cabecera `Content-Security-Policy` dinámica con `nonce`.
- El refresco preventivo de cookies de sesión Supabase SSR mediante `db.auth.getClaims()`.
- La asignación de `Cache-Control: private, no-store` en rutas privadas.

**Solución requerida:** Crear `src/middleware.ts`:
```typescript
import { proxy, config } from './proxy';
export { proxy as middleware, config };
```

### B. Mapeo de Variables de Entorno en Vercel Dashboard

| Variable | Tipo en Vercel | Ámbito | Descripción |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Plaintext | Production / Preview / Dev | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Plaintext | Production / Preview / Dev | Clave pública / anon de Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret | Production / Preview / Dev | Clave administrativa para ingesta de catálogo |
| `TWITCH_CLIENT_ID` | Plaintext | Production / Preview / Dev | Client ID de Twitch Developer |
| `TWITCH_CLIENT_SECRET` | Secret | Production / Preview / Dev | Client Secret para OAuth Token de IGDB |
| `NEXT_PUBLIC_APP_URL` | Plaintext | Production / Preview / Dev | URL canónica (`https://[proyecto].vercel.app`) |

---

## 3. Plan de Adopción Recomendado

1. **Paso 1 (Local):** Mantener el desarrollo y pruebas locales con `.env.local` y Supabase configurado.
2. **Paso 2 (Código):** Implementar la reexportación de `src/middleware.ts` en la rama de implementación.
3. **Paso 3 (Despliegue):**
   - Opción A (Vía Git): Conectar el repositorio a Vercel con integración automática.
   - Opción B (Vía CLI): Desplegar mediante `npx vercel` sin requerir remoto Git público.
4. **Paso 4 (Verificación):** Configurar las URLs de retorno en Supabase Authentication y Twitch Console apuntando al dominio asignado por Vercel.
