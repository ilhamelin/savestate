# Guardian y Gatekeeper: implementación sin activar

Con la migración 037 el bloqueo global usa `system_switches.gatekeeper_enabled`, consultado cada diez segundos como máximo por instancia del servidor. `GATEKEEPER_ENABLED` solo sirve como valor inicial si Supabase no está configurado. La moderación individual requiere la migración 036 y una semilla configurada, y opera independientemente del switch global. Esta implementación no activa el bloqueo ni genera una semilla real.

## Preparación antes de activar

1. Ejecutar íntegramente `supabase/migrations/202610160035_gatekeeper_attempts.sql` en Supabase. Crea únicamente el límite atómico de cinco intentos por IP/minuto (identificador HMAC, sin guardar la IP). Solo `service_role` puede invocarlo. Si falta, la verificación falla cerrada con 503.
2. Configurar `ADMIN_USER_ID` con el UUID inmutable del operador (recomendado). Si no se configura, se exige el correo confirmado de Supabase `ADMIN_EMAIL=benjaigancioreyes56@gmail.com`. `ADMIN_USERNAME` es solo referencia visual: un username editable nunca concede acceso.
3. Configurar `GATEKEEPER_SECRET` como Base32 aleatorio (A–Z, 2–7), mínimo 32 caracteres. Nunca usar `NEXT_PUBLIC_*`, secretos de ejemplo ni enviarlo al chat. Mantener `GATEKEEPER_ENABLED=false` durante el enrolamiento. Configurar también `SUPABASE_SERVICE_ROLE_KEY` para el limitador.
4. Abrir `/guardian` en el teléfono, entrar con Google y pulsar **Activar en este dispositivo**. La API de enrolamiento exige sesión administrativa verificada y mismo origen; responde `no-store`. La semilla se importa a una `CryptoKey` HMAC no exportable y se almacena en IndexedDB; no se guarda en localStorage ni en la caché del service worker.
5. Instalar mediante el menú del navegador (Android: Instalar; iPhone: Compartir → Agregar a pantalla de inicio). Abrir una vez con conexión para preparar el shell offline. Comprobar en modo avión que siguen rotando los códigos cada 20 segundos.
6. Tras aplicar 037 y con autorización explícita posterior, usar **Guardian → Switches → Web Gatekeeper → Confirmar activación**. No requiere redespliegue. La API verifica que hay semilla y limitador disponibles antes de activarlo. Validar `/gatekeeper` con la clave del teléfono. La cookie `savestate_gate_pass` dura 12 horas, está firmada con HMAC-SHA256 y usa `HttpOnly`, `SameSite=Lax`, `Secure` en producción. Se valida incluso al acceder directamente a las APIs.

## Comportamiento y recuperación

- TOTP HMAC-SHA1 de seis dígitos, paso 20 segundos, tolerancia de ±1 paso, conforme al algoritmo de [RFC 6238](https://www.rfc-editor.org/rfc/rfc6238). Es una clave compartida de entrada al sitio, no sustituye el login ni las políticas RLS de Supabase. Dentro de su ventana puede utilizarse por varios visitantes; el límite de intentos protege la verificación anónima.
- `/guardian` y sus APIs conservan autorización propia. Login y callback siguen accesibles para evitar un bloqueo administrativo. Los endpoints exactos de Discord Interactions y cron quedan fuera del pase humano porque ya exigen firmas o `CRON_SECRET`. No se excluye de forma genérica `/api/`.
- El directorio consulta campos públicos de perfiles con la sesión normal, tras comprobar al administrador. Tiene búsqueda remota, páginas de 50, total registrado y actualización manual/pull-to-refresh. No se cachean usuarios offline.
- El service worker solo controla el prefijo `/guardian`, no el resto del sitio. Cachea un shell público sin cuentas ni secretos. Si la navegación falla por falta de red, ese shell recupera la clave local de IndexedDB y permite copiar códigos. Sin enrolamiento previo no genera nada.
- El modo offline es una capacidad confiada al teléfono: quien desbloquee ese navegador podrá generar claves. «Olvidar dispositivo» borra la clave local. Cerrar sesión no revoca por sí solo una clave offline.
- Para revocar un dispositivo perdido, rotar `GATEKEEPER_SECRET` en el servidor y reenrolar los teléfonos válidos. Esto invalida también los pases existentes. Para recuperar acceso, desactivar el switch desde Guardian o ejecutar `update public.system_switches set value='false'::jsonb where key='gatekeeper_enabled';` en Supabase. Login/Guardian conservan su autorización propia y no dependen del pase. Si falla la consulta de switches en una ruta protegida, devuelve 503 en vez de abrir el acceso.
- Las exclusiones existentes del matcher para imágenes/texto públicos se mantienen. Gatekeeper no convierte el almacenamiento público ni la API pública directa de Supabase en servicios privados.

## Verificación local

Los tests usan exclusivamente semillas de vectores públicos de RFC, identidades simuladas y un PostgreSQL aislado para el limitador. No cambian variables de Vercel, no aplican SQL al Supabase remoto y no activan el bloqueo real.

## Gestión de jugadores desde Guardian

- Aplicar también `supabase/migrations/202610160036_player_moderation.sql`. Las dos RPC nuevas son exclusivas de `service_role`; los campos de moderación no son editables por el jugador.
- En **Jugadores → Administrar**, el operador puede bloquear, desbloquear, reiniciar o eliminar otra cuenta. Su propia cuenta está protegida en la API y en la interfaz. Reinicio y borrado exigen escribir el username exacto; no se ejecutan desde el modo offline.
- Bloquear revoca los pases anteriores en la siguiente petición protegida a SaveState y exige un código TOTP válido. Los nuevos pases están firmados, vinculados al UUID y a su fecha de emisión. La verificación reconoce el bloqueo con comparación atómica de timestamp; conserva esa fecha para que los pases de otros dispositivos sigan revocados. Desbloquear manualmente elimina esa exigencia individual. El pase renovado caduca a las 12 horas.
- Reiniciar conserva credenciales, cuentas vinculadas y contenidos sociales, pero elimina biblioteca y sus partidas/reseñas dependientes, insignias, bóveda y eventos de XP; restablece nivel, XP, título y marco equipados, estado, tema y enlaces sociales.
- Antes de reset/borrado se eliminan físicamente los objetos R2 del prefijo UUID del jugador. Se rechaza la operación si hay subidas de bóveda de menos de 310 segundos. Para el borrado se limpian además los archivos de Supabase Storage bajo el mismo prefijo y se invoca `auth.admin.deleteUser`. Nunca se borra `storage.objects` mediante SQL.
- La limpieza de almacenamiento y la base de datos no comparten transacción: si falla un proveedor, se conserva la cuenta para reintentar, aunque parte de los archivos pueda haberse eliminado. Los errores no se presentan como operaciones exitosas.
- El bloqueo web no sustituye RLS, no retira archivos ya públicos y no corta una página ya cargada sin nuevas peticiones. Un reinicio no desvincula Steam/PSN/Xbox.
- `tests/integration/player-moderation-audit.mjs` aplica todas las migraciones en PostgreSQL desechable y prueba reset, cascadas, conservación de credenciales, aislamiento de otro jugador, concurrencia de bloqueos y permisos de RPC/columnas. Nunca usa la base remota.

## Operator Suite (migración 037)

- **Alerta** publica un anuncio global de hasta 240 caracteres. La transacción serializa reemplazos y solo permite uno activo. El banner aparece arriba del Header, consulta cada diez segundos mientras la pestaña esté visible y permite descartarlo por ID en sessionStorage. Guardian y Gatekeeper conservan su vista independiente sin banner. El apagado no borra un mensaje ya enviado a Discord.
- El envío a Discord es opcional y explícito; usa el canal autorizado de anuncios y bloquea menciones masivas. Si Discord falla, el anuncio web permanece activo y Guardian informa del fallo parcial sin invitar a reintentar a ciegas.
- **Switches** valida claves y tipos. El registro cerrado se aplica mediante trigger de `auth.users`, también para OAuth/API directa; los usuarios existentes pueden iniciar sesión. El tema clásico retira la decoración estacional principal y restaura el fondo de rejilla; las páginas abiertas reciben el cambio mediante el sondeo del estado público.
- **HUD** actualiza cada quince segundos con la pestaña visible. La latencia corresponde a una consulta real de Supabase desde el servidor, no a latencia de Vercel Edge. R2 muestra `sum(file_size)` de metadatos (incluye reservas y no cuenta objetos huérfanos). Los conectados son Presence, mientras que “actividad reciente” cuenta jugadores con cambios de biblioteca en quince minutos. El estado de Discord comprueba la API REST; no inventa presencia del gateway.
- La bitácora solo es accesible al administrador. Registra códigos inválidos, la primera limitación de cada ventana, anuncios, switches y premios. Las IP se convierten a huellas HMAC; nunca se almacenan códigos TOTP, semillas ni direcciones IP crudas.
- **Premiar** ofrece +50/+100/+500 XP y el catálogo real de insignias con asignación o retirada. La RPC de XP bloquea la fila para conservar premios concurrentes y rechaza valores fuera de rango/desbordamiento. Las APIs de escritura exigen administrador y mismo origen; tablas sensibles y RPC no conceden escritura a `anon` ni `authenticated`.
- El modo offline conserva únicamente el generador local; las otras cuatro pestañas requieren conexión y sesión. El shell v3 evita servir la navegación anterior desde la caché.
