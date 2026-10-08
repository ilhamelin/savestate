# Configuración de Savestate

La aplicación compila sin credenciales. En ese estado muestra la configuración pendiente y no permite guardar datos. Para habilitar los flujos reales necesitas tus propios proyectos Supabase y Twitch.

## 1. Entorno local

Requiere Node.js 24 y npm. Desde la raíz:

```powershell
npm ci
Copy-Item .env.example .env.local
```

Completa `.env.local` en tu editor. No pegues claves privadas en el chat, README ni Git. El archivo está ignorado.

## 2. Supabase

1. Crea un proyecto Supabase dedicado a Savestate. La especificación selecciona PostgreSQL 16: comprueba `select version();`. Si el proveedor ofrece exclusivamente otro major, resuelve ese cambio antes de usarlo como entorno definitivo.
2. Copia la URL del proyecto y la clave pública/anon a `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`. El nombre de la variable se mantiene por compatibilidad con la documentación; el SDK también admite la clave publicable del proyecto.
3. Copia la clave privada de servidor/service-role a `SUPABASE_SERVICE_ROLE_KEY`. Solo la ingesta del catálogo utiliza ese cliente. Los servicios de usuario usan su sesión y RLS.
4. En SQL Editor, aplica **una sola vez**, en este orden:
   - `supabase/migrations/202610070001_initial.sql`
   - `supabase/migrations/202610070002_notifications_moderation.sql`
   - `supabase/migrations/202610070003_hardening.sql`
   - `supabase/migrations/202610070004_highlights.sql`
   - `supabase/migrations/202610070005_highlights_privacy.sql`
   - `supabase/migrations/202610070006_highlights_privacy_guard.sql`
5. Confirma que todas las tablas tienen RLS habilitado, que existe el bucket `profiles` y que `activity_logs` pertenece a la publicación `supabase_realtime`.
6. El bucket acepta únicamente WebP de hasta 512000 bytes. Las políticas limitan cada jugador a `SU_UUID/avatar.webp` y `SU_UUID/banner.webp`; no conceden escritura en carpetas ajenas.
7. Para Momentos, confirma que `highlights` tiene `public = false`, admite únicamente WebP de hasta 1 MB y aplica la política restrictiva de lectura de la 006. Las capturas se consultan mediante URLs firmadas de cinco minutos; nunca mediante URLs públicas.

Las migraciones se ejecutan con privilegios administrativos en un proyecto nuevo. No las ejecutes sobre un proyecto ajeno o una base con tablas del mismo nombre. Los archivos SQL se mantienen versionados; futuros cambios deben ser nuevas migraciones.

## 3. Autenticación

En Authentication:

- Habilita email/contraseña, confirmación de correo y una longitud mínima de contraseña de 12 caracteres.
- Configura Site URL: `http://localhost:3000` durante desarrollo; tu dominio HTTPS al publicar.
- Añade las URLs de retorno locales necesarias: `http://localhost:3000/auth/callback`, `http://localhost:3000/auth/callback?next=/reset-password`, y sus equivalentes con `127.0.0.1` si utilizas esa dirección.
- Configura SMTP para entregar confirmaciones y recuperación en un entorno real.
- Activa Discord y Google. Registra en cada proveedor una aplicación OAuth y su URL de callback de **Supabase**, disponible en el panel del proveedor: `https://TU_PROYECTO.supabase.co/auth/v1/callback`. Esa URL es distinta de la ruta de retorno de Next.js.
- Mantén las claves OAuth de esos proveedores en Supabase, no en variables públicas de Next.js.

La aplicación utiliza PKCE, intercambio de código en `/auth/callback`, cookies SSR y verificación de identidad mediante `getClaims()`. `/auth/confirm` también soporta enlaces con `token_hash`.

Si personalizas las plantillas de correo para usar hashes:

```text
Confirmación: {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup
Recuperación: {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery
```

Steam queda pendiente de Fase 2. No hay un proveedor Steam simulado.

## 4. Twitch / IGDB

1. Registra una aplicación en [Twitch Developer Console](https://dev.twitch.tv/console/apps).
2. Copia Client ID y Client Secret a `TWITCH_CLIENT_ID` y `TWITCH_CLIENT_SECRET`.
3. El servidor obtiene y renueva un token mediante client credentials; el navegador nunca recibe ese secreto o token.
4. Al buscar, se ingieren juegos en PostgreSQL. No se realiza una descarga completa del catálogo.

La caché de metadatos dura 24 horas. Las notas públicas se consultan aparte para respetar cambios de privacidad. Un presupuesto atómico compartido por las instancias limita nuevas llamadas IGDB a menos de cuatro por segundo. Ante fallo, timeout o saturación, se consulta el catálogo almacenado.

## 5. Arranque y comprobación

```powershell
npm run dev
```

Abre `http://localhost:3000`. Para producción local:

```powershell
npm run build
npm run start
```

Al cambiar las variables de entorno, reinicia el servidor. Las variables `NEXT_PUBLIC_*` requieren también recompilar para que el navegador reciba el nuevo valor.

Checklist de conexión real:

1. Buscar un juego; abrir su ficha e identificar el mismo registro IGDB en `games`.
2. Crear y confirmar una cuenta; probar Discord y Google por separado.
3. Agregar un juego, cambiar sus seis estados y registrar dos rejugadas.
4. Calificar con 9.5, escribir una reseña, cambiar la nota allí y comprobar la biblioteca.
5. Fijar cuatro favoritos; comprobar orden y rechazo de duplicados/quinto favorito.
6. Con dos cuentas: hacer privada una biblioteca, seguirla, comprobar que sigue oculta, aceptar amistad y comprobar acceso. Eliminar la amistad y verificar la revocación.
7. Probar recuperación de contraseña, cierre local y revocación global de sesiones.
8. Verificar subida WebP, listas, comentarios, reacciones, reportes, notificaciones y feed Realtime.

## 6. Moderación

Los roles se asignan únicamente desde administración de Supabase en `app_metadata.role`, con valor `moderator` o `admin`. No uses `user_metadata`: es editable por el jugador. Tras asignar el rol, renueva la sesión. `/moderation` permite revisar reportes y sugerencias y eliminar reseñas reportadas. La incorporación manual de juegos al catálogo debe revisarse administrativamente; las sugerencias no se publican de forma automática.

## 7. Pruebas

```powershell
npm run check
```

Los tests unitarios usan el runner nativo de Node y cubren notas, favoritos, fechas, redirecciones, enlaces, Markdown y estadísticas.

Para RLS con una instancia **local y aislada** de Supabase, instala su entorno de desarrollo y `psql`, aplica las migraciones y define `TEST_DATABASE_URL` en `.env.local`. Después:

```powershell
npm run test:integration
```

El runner SQL exige un host local y revierte todos sus fixtures. No lo apuntes a producción. Sin `TEST_DATABASE_URL`, esa prueba queda omitida explícitamente.

Los tests HTTP son para la aplicación local **sin configurar**, con el servidor de producción iniciado:

```powershell
$env:TEST_APP_URL = 'http://127.0.0.1:3000'
npm run test:integration
```

También se incluye `tests/integration/verify-isolated.mjs`: permite comprobar las mismas migraciones y aserciones SQL usando un PGlite instalado fuera del proyecto y apuntado por `SAVESTATE_PGLITE_MODULE`. Es una herramienta temporal de verificación, no una dependencia de Savestate. Simula las funciones de identidad y las tablas Storage; no certifica los servicios Supabase Auth, Storage ni Realtime reales.

## Fuentes oficiales

- [Next.js: instalación](https://nextjs.org/docs/app/getting-started/installation)
- [Supabase: clientes SSR y sesiones](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [Supabase: Discord](https://supabase.com/docs/guides/auth/social-login/auth-discord)
- [Supabase: Google](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [IGDB: autenticación y límites](https://api-docs.igdb.com/)
