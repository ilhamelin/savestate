# Indie Tracker de itch.io

Disponible solo en el perfil propio, en «Mis checkpoints de itch.io». Requiere la migración `202610090022_itch_tracker.sql`, aplicada y comprobada en Supabase.

## Uso

1. Añade la URL HTTPS de la página de un juego, por ejemplo `https://autor.itch.io/juego`.
2. Indica la versión que estás jugando y el estado. Puedes añadir hasta 50 hitos y 5000 caracteres de notas privadas por juego.
3. Guarda el checkpoint. «Estoy jugando la última detectada» completa la versión a partir del último devlog.
4. «Comprobar actualizaciones» consulta itch.io manualmente. Guarda los cambios pendientes antes de comprobar. Hay un intervalo mínimo de 30 segundos por juego y un máximo de 50 juegos por usuario.

La primera consulta crea la referencia inicial sin avisos retroactivos. Un nuevo devlog genera una notificación interna con enlace al tracker. Las notas, hitos y versiones jugadas no se muestran a otros jugadores, incluso en perfiles públicos.

## Qué significa una actualización

Se consulta `data.json` para metadatos y `devlog.rss` para la entrada más reciente, ordenada por fecha. [itch.io documenta el feed de devlogs](https://itch.io/updates/updates-to-devlogs).

Un devlog puede ser una noticia sin lanzamiento. La versión se extrae del título si contiene un número reconocible, como `1.8E`; en caso contrario se conserva el título del devlog. No se inventa una versión ni se descargan archivos. «Página / Descargar» abre la página oficial del juego; compras, permisos y descargas siguen gestionados por itch.io. Metadatos como tags o screenshots pueden estar vacíos si itch.io no los devuelve.

Si el feed falla, se conservan los datos del último devlog conocido y se muestra el aviso. Si falla `data.json`, se informa del error y se conservan los datos guardados. El último intento de comprobación consume el intervalo incluso si el proveedor falla.

## API y seguridad

- `POST /api/tracker/itch/inspect`: `{ url }`, devuelve metadatos en `{ data }`.
- `GET /api/tracker/itch`: lista privada del usuario autenticado.
- `POST /api/tracker/itch`: acciones `add`, `save` y `remove`.
- `POST /api/tracker/itch/check-updates`: `{ id }`, donde `id` identifica el tracker guardado. Devuelve tracker, indicador de nuevo devlog y mensaje.
- Todas las rutas requieren sesión. POST también valida origen, JSON y tamaño de payload. Solo se consultan dominios de creadores `*.itch.io`, sin credenciales en la URL ni redirecciones; imágenes únicamente desde `img.itch.zone`. Respuestas limitadas a 1 MB y timeout de 10 segundos.
- RLS y permisos por columna protegen los campos privados. Metadatos y comprobaciones solo se escriben desde el servidor tras validar la sesión y la propiedad. Las RPC administrativas no pueden ejecutarse desde clientes anónimos o autenticados.
- PostgreSQL bloquea el registro para serializar comprobaciones y persistir el devlog y su notificación en una misma transacción. El mismo devlog no vuelve a notificar y feeds más antiguos no reemplazan al más reciente.

## Discord

Si está configurado `DISCORD_WEBHOOK_URL`, una actualización detectada envía un aviso con el juego, el devlog y la página oficial de descarga. No incluye el nombre del usuario que rastrea el juego ni sus datos privados. Usa el servicio existente con menciones deshabilitadas y entrega best effort después de responder; un fallo de Discord no revierte la notificación interna. Puede haber avisos del mismo juego para distintos usuarios. No hay cron, polling automático ni garantía de entrega de Discord exactamente una vez.

## Verificación

- `npm run check`: 82 pruebas unitarias, TypeScript, ESLint y formato.
- `node --experimental-strip-types --test tests/integration/itch-tracker.test.ts`: rutas/servicios reales con adaptadores simulados; prueba sesión, CSRF, SSRF, propiedad, cuota, persistencia de notas y no repetir avisos. No escribe en Supabase ni envía mensajes externos.
- Consulta real de `data.json` y `devlog.rss` del ejemplo proporcionado: HTTP 200.
- Supabase real: tabla, columna y ambas RPC presentes. Invocación administrativa con UUID inexistente rechazada, sin cambios; accesos anónimos rechazados con `42501`. No se crearon cuentas de prueba ni se modificaron trackers reales durante esta validación.
