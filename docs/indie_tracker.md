# Indie Tracker de itch.io

Solo visible en el perfil propio. Migraciones 022 y 023 aplicadas según confirmación del usuario. Los hitos ya no se muestran; sus datos existentes se conservan al guardar.

## Alarmas

Se muestra el último devlog, pero solo disparan alertas las releases con versión reconocida o palabras release/update/patch/hotfix/build/versión/actualización. Las noticias no activan alarmas. Se conserva por separado la última release del RSS, incluso si una noticia es más reciente. El filtro por palabras es heurístico: un anuncio de planes puede contener palabras de release.

El widget público que sigue a #download aporta data-upload_id y tamaños. La primera inspección HTML exitosa establece una referencia silenciosa. Nuevos IDs disparan «Nuevo archivo instalador subido a itch.io». Reordenar, quitar archivos o cambiar solo el tamaño no genera avisos. Una sustitución de contenido que mantenga el ID no puede detectarse. No se descargan instaladores ni archivos de pago.

«Estoy jugando el instalador detectado» reconoce los IDs actuales, sin inventar una versión de devlog. Si cambiaron durante la confirmación, el servidor pide sincronizar. La alarma visual no confirma que una notificación siga sin leer. Notas privadas: hasta 5000 caracteres; hasta 50 trackers por usuario.

## Cron diario (Vercel Hobby)

El usuario eligió Hobby: vercel.json configura GET /api/cron/check-itch con `0 12 * * *`. Se ejecuta una vez al día a las 12:00 UTC; Vercel puede iniciarlo dentro de esa hora. Hobby no permite el intervalo original de 12 horas. [Límites oficiales](https://vercel.com/docs/cron-jobs/usage-and-pricing).

Se generó un CRON_SECRET aleatorio de servidor en .env.local, ignorado por Git y sin mostrarlo. Configura el mismo valor como Secret de producción en Vercel antes de desplegar. No uses NEXT_PUBLIC_* ni una clave fija compartida. Transferencia por stdin desde PowerShell, sin escribir el valor en el comando:

```powershell
$itchCronEntry = Get-Content -LiteralPath .env.local | Where-Object { $_ -match '^CRON_SECRET=' } | Select-Object -First 1
$itchCronEntry.Substring('CRON_SECRET='.Length) | npx vercel env add CRON_SECRET production --type secret
```

La programación y las variables nuevas requieren un despliegue para entrar en producción. El panel muestra pendiente hasta tener configuración, y activo después de una ejecución completa correcta en las últimas 26 horas. No promete vigilancia continua 24/7: revisa diariamente. Comprobación manual disponible, separada por un mínimo de 30 segundos por juego.

El cron valida Authorization: Bearer con comparación de tiempo constante y falla cerrado sin secreto (mínimo 32 caracteres). Una concesión SQL de cinco minutos impide cron solapados. Procesa hasta 300 trackers, tres en paralelo, empezando por los intentos más antiguos anteriores a 23 horas; presupuesto de 250 segundos dentro de una función de 300 segundos. Esto tolera la variación horaria de Hobby. Los fallos consumen el intento y se vuelven a probar en el ciclo diario siguiente.

La respuesta incluye checked/updated/failed/remaining/complete. Fallos o pendientes devuelven 503 y no actualizan la señal de éxito. Vercel no reintenta automáticamente un cron fallido. Si la colección global supera el presupuesto, hace falta ampliar infraestructura; no se garantiza cubrir cualquier volumen cada día.

## Privacidad y persistencia

Rutas de usuario con sesión/RLS, POST con validación de origen, JSON y tamaño. Solo páginas HTTPS canónicas de creadores itch.io, sin credenciales ni redirecciones, límite de 1 MB y timeout de 10 segundos. Fallos parciales de RSS/HTML conservan sus últimas fuentes; si falla data.json no se reemplazan metadatos. El cron omite la sesión del navegador en proxy.ts y exige su propio secreto; mantiene CSP y cabeceras de seguridad.

apply_itch_check_v2 bloquea el tracker y persiste metadatos y notificación juntos. News, versiones anteriores y mismos IDs no repiten avisos. RSS antiguo no reemplaza el conocido. itch_monitor_state y RPC administrativas quedan restringidos a service_role.

Discord recibe el título del juego y su página pública, nunca notas, hitos o identidad del dueño. Dentro de un cron se agrupan avisos idénticos. Entrega best effort después de responder, sin garantía de exactamente una vez entre ejecuciones distintas.

## API

- GET /api/tracker/itch: trackers propios y estado operativo del monitor.
- POST /api/tracker/itch/inspect: url.
- POST /api/tracker/itch: add/save/remove/acknowledge-installer (IDs observados).
- POST /api/tracker/itch/check-updates: id del tracker.
- GET /api/cron/check-itch: exclusivamente CRON_SECRET; no acepta identidad de usuario desde el cliente.

## Verificación

Tests de URLs, RSS, releases frente a noticias, uploads/tamaños, versiones y datos privados. Pruebas de rutas con adaptadores simulados para evitar notificaciones externas. El HTML público del ejemplo confirmó el upload ID 16488290 y 554 MB sin descargar archivos. Las verificaciones reales de RPC usan IDs inexistentes o comparaciones sin mutar trackers reales.
