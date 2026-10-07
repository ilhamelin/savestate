# Propuesta Técnica: Adopción de Vercel para Despliegue y Gestión de Entorno
**Fecha:** 7 de octubre de 2026 (Actualizado con revisión técnica de implementación)  
**Origen:** Auditoría e Investigación (`research/antigravity`)  
**Destino:** Equipo de Implementación (`implementation/chatgpt` / Codex)  
**Propósito:** Adopción de Vercel como plataforma de hosting, dominio HTTPS y gestión de variables de entorno para SaveState.

---

## 1. Justificación y Alineación Arquitectónica

SaveState está construido sobre **Next.js 16 (App Router)**, **React 19** y **Supabase (PostgreSQL 16)**. La infraestructura recomendada para este stack es **Vercel**, tanto por capacidades operacionales como por el cumplimiento de los requerimientos del proyecto.

### Beneficios Principales

1. **Dominio HTTPS Administrado Inmediato:**
   - La autenticación OAuth (Discord, Google) y las cookies de sesión SSR seguras con PKCE exigen HTTPS en producción.
   - En `src/lib/env.ts` se valida estrictamente:
     ```typescript
     if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname))
       throw new Error('La URL de producción debe usar HTTPS.');
     ```
   - Vercel provee subdominio automático con certificados SSL gestionados (`https://[proyecto].vercel.app`), habilitando las URLs de callback de Supabase OAuth sin requerir compra de dominio ni configuración manual de certificados.

2. **Gestión Centralizada y Segura de Secretos:**
   - Permite segregar variables públicas de cliente (`NEXT_PUBLIC_*`) y secretos estrictos de servidor (`SUPABASE_SERVICE_ROLE_KEY`, `TWITCH_CLIENT_SECRET`) directamente en la plataforma.
   - Permite sincronizar variables al entorno de desarrollo local mediante la CLI oficial:
     ```powershell
     npx vercel env pull .env.local
     ```

3. **Caché Distribuida y Medición de Rendimiento:**
   - El proxy del catálogo implementa `unstable_cache` con revalidación de 24 horas (`revalidate: 86400`) en `src/integrations/igdb/server.ts`.
   - Vercel Data Cache soporta esta primitiva de forma nativa. Sin embargo, Data Cache almacena datos cerca de la región de ejecución y no garantiza de forma abstracta tiempos inferiores a 1.5 s; el cumplimiento de **RNF-02** debe validarse mediante mediciones empíricas en el despliegue real.

4. **Desacoplamiento de WebSockets:**
   - Las conexiones en tiempo real de `RealtimeFeed` (`activity_logs`) se abren directamente desde el navegador hacia el clúster de Supabase vía WebSockets, por lo que no consumen tiempo de ejecución ni límites de serverless functions en Vercel.

---

## 2. Resoluciones Técnicas de Compatibilidad

### A. Intermediación de Red: Conservación Estricta de `src/proxy.ts`
- En Next.js 16, la convención nativa para la intermediación de red opera mediante `src/proxy.ts` exportando la función `proxy` junto a su `config` con runtime Node.js.
- Vercel reconoce oficialmente esta especificación para Next.js 16.
- El compilador rechaza expresamente la coexistencia de `proxy.ts` y `middleware.ts`.
- **Resolución:** Se conserva intacto `src/proxy.ts`. No se crea ni se reexporta ningún archivo `middleware.ts`.

### B. Autenticación y Flujos de Integración
- **Twitch / IGDB:** Utiliza exclusivamente el flujo `client_credentials` de servidor a servidor (Machine-to-Machine); no involucra redirecciones de usuario final en el navegador ni requiere callbacks públicos.
- **Supabase Auth (Discord / Google):** Las URLs de callback OAuth se configuran en el panel de **Supabase Authentication**, apuntando al dominio generado por Vercel (`https://[proyecto].supabase.co/auth/v1/callback` y retorno hacia la app).

### C. Mapeo de Variables de Entorno en Vercel Dashboard

| Variable | Tipo en Vercel | Ámbito | Descripción |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Plaintext | Production / Preview / Dev | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Plaintext | Production / Preview / Dev | Clave pública / anon de Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret | Production / Preview / Dev | Clave administrativa para ingesta de catálogo |
| `TWITCH_CLIENT_ID` | Plaintext | Production / Preview / Dev | Client ID de Twitch Developer |
| `TWITCH_CLIENT_SECRET` | Secret | Production / Preview / Dev | Client Secret para OAuth M2M de IGDB |
| `NEXT_PUBLIC_APP_URL` | Plaintext | Production / Preview / Dev | URL canónica (`https://[proyecto].vercel.app`) |

---

## 3. Plan de Adopción Aprobado

1. **Paso 1 (Local):** Mantener el desarrollo y pruebas locales con `.env.local` y Supabase configurado.
2. **Paso 2 (Despliegue Vercel):**
   - Conectar el repositorio o desplegar vía Vercel CLI (`npx vercel`) manteniendo intacta la estructura de código (`src/proxy.ts`).
   - Cargar las variables de entorno en el panel de Vercel.
3. **Paso 3 (Verificación y Calibración):**
   - Configurar Site URL y Redirect URLs en Supabase Auth con el dominio HTTPS asignado por Vercel.
   - Medir latencias reales del catálogo caliente y frío para certificar RNF-02.
