# SaveState: Manual de Operación y Arquitectura para Codex en la Nube

> **Destinatario:** OpenAI Codex / Agente Autónomo en la Nube  
> **Proyecto:** SaveState (Catálogo, seguimiento y red social gamer retro/moderno)  
> **Repositorio:** `https://github.com/ilhamelin/savestate.git`  
> **Despliegue Producción:** `https://savestate-eight.vercel.app` (Vercel)

---

## 1. Contexto y Arquitectura Técnica

SaveState es una plataforma web completa de seguimiento de videojuegos, perfiles gamer, reseñas, colecciones y telemetría de juego.

* **Framework Web:** Next.js 16 (App Router con Server Components y Server Actions)
* **Librería UI:** React 19 + Tailwind CSS v4 + Lucide React + Framer Motion / ReactBits
* **Lenguaje:** TypeScript 5 (tipado estricto, sin `any` sueltos)
* **Base de Datos & Auth:** Supabase (PostgreSQL 16 con Row Level Security - RLS, RPCs y Realtime)
* **Almacenamiento:** Cloudflare R2 Vault (S3 compatible) para capturas y assets pesados
* **Integraciones Externas:**
  * IGDB / Twitch API v4 (Catálogo de videojuegos y portadas)
  * Steam Web API (Sincronización de horas, biblioteca y logros)
  * Riot Games API (Match history y telemetría LoL)
  * HenrikDev API (Valorant MMR y partidos)
  * Discord Bot & Webhooks (Anuncios y bridge comunitario)
  * TMDB / JustWatch (Metadatos multimedia y regiones)

---

## 2. Mapa de Ramas en GitHub

El repositorio opera con dos ramas clave que debes conocer:

| Rama | Propósito | Estado |
|---|---|---|
| `implementation/chatgpt` | **Rama Principal (HEAD / Producción):** Contiene la base de código funcional completa (v3.0 con Guardian Suite, Sitemap SEO, proxy, etc.). | 100% sincronizada. |
| `research/antigravity` | **Rama de Especificaciones y Auditorías:** Contiene 134 documentos técnicos detallados (`docs/`) con análisis de features, contratos de tipos y propuestas de UI. | 100% sincronizada en GitHub. |

---

## 3. Entorno de Ejecución en la Nube (Sin PC Local)

El usuario no mantendrá los archivos localmente en su máquina. Toda modificación o mantenimiento se ejecuta directamente en la nube (Codespaces, entorno Codex o sandboxes de GitHub):

### Variables de Entorno Requeridas (.env)
Las variables no se suben a Git por seguridad. Para ejecutar pruebas o levantar el servidor de desarrollo en la nube, se configuran las siguientes variables en el entorno de Codex o GitHub Secrets:

```bash
# Supabase (Obligatorias)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Dominio y Cron
NEXT_PUBLIC_APP_URL=https://savestate-eight.vercel.app
CRON_SECRET=

# APIs de Juegos y Media (Opcionales según el feature a testear)
TWITCH_CLIENT_ID=
TWITCH_CLIENT_SECRET=
STEAM_API_KEY=
RIOT_API_KEY=
HENRIK_API_KEY=
TMDB_API_KEY=

# Cloudflare R2 Vault
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=savestate-vault
R2_PUBLIC_URL=https://pub-83372560eadf4eadac2d1835674c6840.r2.dev

# Guardian Suite & Seguridad
GATEKEEPER_ENABLED=false
GATEKEEPER_SECRET=
ADMIN_EMAIL=benjaigancioreyes56@gmail.com
```

> [!NOTE]
> En producción, Vercel ya tiene configuradas todas estas variables de entorno en su panel. Cualquier commit en `implementation/chatgpt` o PR desplegará automáticamente.

---

## 4. Reglas de Desarrollo y Criterios de Aceptación

Para asegurar que los cambios no rompan la estabilidad de SaveState:

1. **Proxy Canónico de Red:**
   Next.js 16 opera la intermediación de red en `src/proxy.ts` exportando `proxy` con CSP nonce y Cache-Control. **No crear `middleware.ts` clásico**.
2. **Comprobación de Tipos y Calidad:**
   Antes de confirmar cualquier cambio, ejecutar:
   ```bash
   npm run build
   # o
   npx tsc --noEmit
   npm run lint
   ```
3. **Flujo de Git:**
   - Crear ramas de feature: `feature/<nombre-feature>` o `fix/<nombre-fix>`.
   - Abrir Pull Request apuntando a `implementation/chatgpt`.
   - Asegurar que el build de Vercel pase en verde.

---

## 5. Respaldo Local de Seguridad

El usuario conserva un respaldo de seguridad cifrado de `.env.local` fuera de las carpetas de desarrollo en:
`C:\Users\benja\OneDrive\Documentos\savestate_backup_env\.env.local`
Por lo tanto, la eliminación de las carpetas locales en su disco no comprometerá las credenciales.
