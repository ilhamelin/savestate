# Sincronización rápida de Steam

Fecha: 8 de octubre de 2026. Referencia: `docs/propuesta_steam_sync_rapido.md`, conservada desde `research/antigravity`.

## Implementación

- Migración `202610080014_steam_sync_ratelimit.sql`: Steam ID, cuota y última reclamación en perfiles; permisos de actualización únicamente para Steam ID. Los usuarios no pueden editar los campos de cuota.
- `claim_steam_sync_slot()` bloquea el perfil y concede tres intentos por día calendario UTC. Cambiar la cuenta no reinicia la cuota. La fecha se toma después de adquirir el bloqueo, usando `clock_timestamp()`.
- `POST /api/steam/sync` autentica la sesión, valida origen y configuración, reclama cuota y consulta el Steam ID guardado. Un límite agotado devuelve HTTP 429 con `Retry-After`. Las llamadas realizadas a Steam consumen cuota aunque el proveedor falle.
- `GET /api/steam/sync` devuelve estado propio sin consumir un intento; ambas respuestas usan `Cache-Control: no-store`.
- `apply_steam_sync()` solo admite ejecución por `service_role`. El cliente privilegiado queda encerrado en la integración, sin devolverlo a otras capas. El propietario proviene de la sesión; los minutos provienen de la respuesta validada de Valve, nunca del cuerpo enviado por el navegador.
- La actualización bloquea perfil, registros de biblioteca y logs de Steam; suma los logs con el mismo marcador `[Steam lifetime:APPID]` y añade únicamente el diferencial positivo. No ingiere títulos nuevos, no reduce horas ni modifica notas, fechas, estado, rating o partidas manuales.
- El contador de juegos actualizados cuenta títulos distintos. Las llamadas concurrentes y repetidas no duplican horas; un cambio de cuenta durante la consulta invalida la aplicación del snapshot anterior.
- La importación deja también un marcador de cero horas para títulos sin tiempo registrado. Al enlazar un registro existente conserva sus datos y añade un marcador cero si falta.
- El importador devuelve el Steam ID resuelto dentro de tickets firmados. Hay tickets separados para juegos y vinculación de cuenta; son personales y expiran a los 30 minutos. Los tickets antiguos de juegos siguen siendo válidos. Una importación confirmada guarda la cuenta; usuarios anteriores pueden vincularla explícitamente desde el importador.
- `SteamQuickSync` aparece en la cabecera de la biblioteca, con progreso, resultado y cuota. Bloquea a `0/3`, vuelve a consultar al cruzar medianoche UTC y al regresar a la pestaña. No guarda cuotas en localStorage.
- Sin paquetes nuevos, cambios en `src/proxy.ts` ni publicación en producción durante este paquete.

## Verificación realizada

- `npm run check`: lint, TypeScript, 44 pruebas unitarias y formato correctos.
- `npm run build`: build completo de Next.js 16.4.0, incluyendo `/api/steam/sync`.
- Supabase real con cuentas temporales y Valve simulado mediante un preload local explícito: diez solicitudes HTTP simultáneas produjeron exactamente tres éxitos y siete respuestas HTTP 429. Dos juegos recibieron un diferencial total de 3.75 horas una sola vez. Las partidas manuales, notas, Platinum, rating y favorito se conservaron. No se añadieron títulos ajenos ni se alteraron logs de otro propietario.
- Los permisos rechazaron modificar el contador directamente o ejecutar la aplicación privilegiada desde una sesión común. Vincular una cuenta distinta conservó la cuota agotada.
- Prueba previa de Steam/Wrapped pasó: tickets antiguos, importación y repetición atómicas, conservación de datos y privacidad del resumen anual.
- Navegador local sobre build de producción: vinculación desde el importador, primer sync con dos juegos y +5.25 horas, repetición sin añadir horas y bloqueo a `0/3`. Consola sin errores.
- Móvil 375 px: documento 360 px, panel de sincronización 320 px; sin desbordamiento.
- Cuentas temporales eliminadas y servidor de prueba detenido. El mock de Valve no se importa por la aplicación ni se activa en un inicio normal.

## Corrección SQL pendiente de confirmación

La primera versión de la migración 014 fue ejecutada y confirmada por el usuario. La prueba integral encontró que el error SQL `40001` en la protección de cambio de cuenta acababa en un timeout de Supabase, en lugar de una respuesta inmediata. Se corrigió el archivo de migración para usar `P0001`, que el servicio traduce a HTTP 409. Se mostró el bloque de reemplazo de `apply_steam_sync` al usuario; falta confirmar su ejecución para repetir y cerrar la prueba integral completa. La primera ejecución de esa prueba terminó con error en esa comprobación, después de verificar correctamente concurrencia y persistencia.

La cuota y el flujo visual ya están comprobados. Los casos finales de fallo de Valve y reinicio diario de la prueba integral deben completarse después del reemplazo SQL.

Capturas: `docs/evidence/steam-quick-sync.png`, `steam-quick-sync-exhausted.png`, `steam-quick-sync-mobile.png`.

## Repetir la prueba integral

En una terminal, con el build ya generado:

```powershell
$env:TEST_STEAM_SYNC_MOCK='1'
$env:NODE_OPTIONS='--import=./tests/integration/steam-sync-upstream.mock.mjs'
npm run start
```

En otra terminal:

```powershell
$env:TEST_STEAM_SYNC_LIVE='1'
$env:TEST_STEAM_SYNC_MOCK='1'
$env:TEST_APP_URL='http://localhost:3000'
node --env-file=.env.local --experimental-strip-types --test tests/integration/steam-sync.test.ts
```

La prueba utiliza cuentas descartables y las elimina al finalizar. El mock reproduce bibliotecas y un fallo del proveedor; no certifica la disponibilidad actual de Valve ni la privacidad de una cuenta real del jugador.
