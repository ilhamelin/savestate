# Plan de Despliegue en Vercel (Fase 1)
**Fecha:** 7 de octubre de 2026  
**Origen:** Auditoría e Investigación (`research/antigravity`)  
**Destino:** Equipo de Implementación (`implementation/chatgpt` / Codex)  
**Propósito:** Definir los pasos operacionales, pre-requisitos de Git y consideraciones técnicas para desplegar SaveState en Vercel de forma limpia y reproducible.

---

## 1. Contexto y Objetivos

Con la infraestructura de Supabase activa (migraciones aplicadas) y la API de Twitch/IGDB verificada localmente (15 títulos persistidos y respuestas de caché en ~582 ms), el siguiente hito operacional es el **Despliegue en Vercel (Fase 1)**.

El objetivo de esta fase es:
1. Obtener un entorno de producción público bajo HTTPS administrado (`https://[proyecto].vercel.app`).
2. Centralizar la gestión de variables de entorno y secretos.
3. Habilitar la URL canónica necesaria para la posterior configuración de OAuth con **Discord y Google** (Fase 2).

---

## 2. Vías de Despliegue Propuestas (Para Decisión de Codex)

Considerando el estado actual del repositorio (múltiples ramas locales: `master`, `implementation/chatgpt` y `research/antigravity`, sin remoto Git configurado), se presentan dos estrategias operacionales:

### Estrategia A: Despliegue vía Vercel CLI (`npx vercel`) — *Sin remoto público*
* **Mecánica:**
  1. Ejecutar desde la raíz del proyecto:
     ```powershell
     npx vercel
     ```
  2. Autenticar en navegador, vincular a la cuenta/equipo de Vercel y aceptar la configuración predeterminada de Next.js.
  3. Cargar las variables de entorno en Vercel mediante CLI o panel web.
  4. Ejecutar el despliegue a producción:
     ```powershell
     npx vercel --prod
     ```
* **Ventajas:** Rápido, no requiere configurar claves SSH, tokens ni repositorios en GitHub. Permite probar el build de Vercel de inmediato desde el worktree local.
* **Desventajas:** Los despliegues son manuales por comando; no cuenta con CI/CD automático ante nuevos commits.

### Estrategia B: Despliegue vía Git Integration (GitHub / GitLab privado) — *Recomendada para CI/CD*
* **Mecánica:**
  1. Unificar o preparar la rama de lanzamiento (ej. merge/fast-forward de `implementation/chatgpt` hacia `master` o `main`).
  2. Crear un repositorio privado en GitHub (ej. `savestate`).
  3. Configurar remoto y realizar push inicial:
     ```powershell
     git remote add origin https://github.com/[usuario]/savestate.git
     git push -u origin main
     ```
  4. Importar el proyecto desde el dashboard de Vercel conectando el repositorio de GitHub.
* **Ventajas:** Despliegues continuos automáticos (CI/CD), vistas previas automáticas en Pull Requests y preservación histórica del código en la nube.
* **Desventajas:** Requiere crear y autenticar el repositorio en GitHub previamente.

---

## 3. Matriz de Variables de Entorno para Vercel Dashboard

Al configurar el proyecto en Vercel (en **Settings -> Environment Variables**), se deben cargar exactamente las siguientes claves:

| Variable | Tipo / Secreto | Valor / Origen |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Plaintext | `https://pvrfiugmpiozteetjoym.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Plaintext | Clave pública anon de Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret** (Oculto) | Clave secreta service_role de Supabase |
| `TWITCH_CLIENT_ID` | Plaintext | Client ID de Twitch Developer |
| `TWITCH_CLIENT_SECRET` | **Secret** (Oculto) | Client Secret de Twitch Developer |
| `NEXT_PUBLIC_APP_URL` | Plaintext | URL asignada por Vercel (ej. `https://savestate-app.vercel.app`) |

*Nota: Una vez desplegado, si la URL final difiere de la tentativa, se actualiza `NEXT_PUBLIC_APP_URL` y se dispara un redeploy.*

---

## 4. Puntos de Verificación Post-Despliegue (Smoke Tests)

Una vez completado el build de Vercel:
1. **Comprobar Edge Proxy y CSP:** Confirmar HTTP 200 en la raíz, presencia de cabeceras `Content-Security-Policy` dinámicas y `X-Content-Type-Options: nosniff`.
2. **Comprobar Ingesta y Data Cache:**
   - Realizar una búsqueda en `/explore` (ej. *"Metroid"*).
   - Comprobar que IGDB responde, se persiste en Supabase PostgreSQL y las peticiones subsecuentes se sirven desde caché rápida.
3. **Comprobar Autenticación por Correo:**
   - Registrar una cuenta de usuario y validar el flujo de confirmación.
4. **Comprobar Persistencia y RLS:**
   - Guardar un título en la biblioteca personal y registrar un Play Log para confirmar conectividad con Supabase desde el entorno serverless de Vercel.

---

## 5. Consulta y Validación con Codex

Se solicita a Codex:
1. Validar si prefiere la **Estrategia A (CLI)** para una primera prueba inmediata o la **Estrategia B (GitHub)** para dejar listo el flujo de CI/CD.
2. Confirmar si la rama `implementation/chatgpt` requiere alguna sincronización o limpieza de commits antes de iniciar el empaquetado hacia Vercel.
3. Certificar que `next.config.ts`, `package.json` y los scripts de build no presentan discrepancias para el runtime de Vercel.
