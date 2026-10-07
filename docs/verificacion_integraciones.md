# Verificación de integraciones reales

Fecha: 7 de octubre de 2026. Rama: `implementation/chatgpt`.

## Cambios y comprobaciones

- Los timeouts de token Twitch y consulta IGDB se ampliaron de 2500 a 7000 ms.
- `npm run check` pasó: lint, tipos estrictos, 11 tests unitarios y formato.
- `npm run build` pasó y reconoció `Proxy (Middleware)`.
- La búsqueda de Chrono Trigger devolvió HTTP 200 con `source: igdb`: 15 juegos persistidos en `public.games`, partiendo de cero coincidencias. La consulta fría, incluida la comprobación de persistencia, tardó aproximadamente 6,49 s. La siguiente consulta devolvió `source: cache`, 15 juegos y 582 ms. Estos resultados locales no certifican RNF-02 en producción.
- Supabase Auth respondió correctamente, las consultas públicas funcionaron y se confirmó la existencia del bucket `profiles`.

## Sesión y biblioteca

El registro público mediante `signUp` rechazó el correo ficticio reservado de prueba con `email_address_invalid`. Para verificar los pasos siguientes se generó un enlace de alta mediante la API administrativa y se confirmó con `verifyOtp` en Supabase Auth. No se desactivó la confirmación de email ni se cambió la configuración de Auth.

Con esa cuenta temporal se comprobó:

- Creación automática de `public.profiles` por el trigger de Auth.
- Login real con contraseña y verificación remota del usuario.
- Cookies SSR aceptadas por el proxy y la API de la aplicación.
- Alta de biblioteca mediante `/api/library`: estado `playing`, nota 9.5.
- Edición de la misma ficha: estado `cleared`, nota 9, sin duplicación.
- Play Log asociado con 12.5 horas; las horas pertenecen a `play_logs`, no a `user_games`.
- Dos eventos `library_updated` en `public.activity_logs`, con las notas del alta y la edición.
- Renovación real mediante Supabase Auth y posterior carga autenticada de `/library`, mostrando el juego y `Cache-Control: private, no-store`.

La prueba detectó que el `upsert` original de biblioteca necesitaba permisos de actualización sobre columnas de propiedad restringidas. Se corrigió usando inserción con conflictos ignorados y actualización exclusiva de estado y nota. Se mantuvieron las políticas RLS y los permisos existentes; no se requieren nuevas migraciones.

Se agregó una regresión SQL que verifica la protección de propiedad, el comportamiento del conflicto, la edición permitida y su evento de actividad. Pasó junto con las tres migraciones y el resto de las aserciones en PostgreSQL aislado.

Las cuentas temporales se eliminaron al finalizar. Se verificó la eliminación en cascada de perfiles, biblioteca y eventos. Los títulos del catálogo permanecen disponibles.

## Validaciones pendientes

- Registro público con un correo real y entrega/confirmación de email.
- OAuth de Discord y Google con las URLs del despliegue.
- Subida y acceso real a archivos de Storage; la existencia del bucket no valida estos flujos.
- Entrega de eventos Realtime al navegador; la emisión y persistencia SQL sí fueron verificadas.
- Medición de rendimiento y comprobación de cookies, proxy y callbacks sobre HTTPS en Vercel.

No se registraron credenciales, contraseñas ni tokens en este documento o en Git.
