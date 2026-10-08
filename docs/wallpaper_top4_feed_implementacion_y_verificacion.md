# Wallpapers, Top 4 y telemetría: implementación y verificación

Fecha: 8 de octubre de 2026. Rama: `implementation/chatgpt`.

## Alcance y decisiones

- Referencia conservada: `docs/propuesta_wallpaper_top4_y_feed.md`, desde `research/antigravity`.
- Migración 013 completa aplicada en Supabase y confirmada por el usuario. Además de `wallpaper_url`, incluye el objeto `wallpaper.webp` en las políticas de Storage y el RPC `set_favorite_slot`.
- `completed` no existe en el dominio. El usuario aprobó `backlog` para títulos nuevos fijados desde el catálogo. Los registros existentes conservan estado, nota y partidas.
- Las ranuras permanecen independientes al vaciar una posición. Elegir un juego fijado en otra ranura intercambia posiciones, evitando duplicados. La operación es una transacción que bloquea la fila del perfil, igual que el RPC previo `set_favorites`.

## Wallpapers

Cuatro SVG locales sin nuevas dependencias: Cyberpunk, Habitación 90s, Synthwave y Espacio. Selector y vista previa reactiva en Profile Studio, integrados con Guardar, Descartar y Ctrl+S. La imagen personalizada reutiliza la compresión WebP de hasta 500 KB y se guarda en `profiles/<user_id>/wallpaper.webp`. El flujo de guardado respalda y restaura el objeto previo si falla la actualización del perfil.

El perfil muestra el wallpaper detrás de la habitación existente con el degradado oscuro de la especificación. El servidor admite únicamente los cuatro presets exactos o el objeto del propio usuario en el proyecto Supabase configurado. También filtra valores introducidos directamente en base de datos antes de renderizarlos. El wallpaper es público, como el avatar y banner.

## Top 4

Cuatro ranuras visibles, acciones solo para el propietario y diálogo nativo con cierre por Escape y restitución de foco. Las búsquedas usan debounce de 300 ms y AbortController para descartar respuestas obsoletas. Ambas fuentes ofrecen paginación de 24 resultados.

`GET /api/favorites` requiere sesión y consulta exclusivamente la biblioteca del usuario. Incluye títulos importados de Steam y registros fuera de los 500 juegos visibles del perfil. La pestaña de catálogo usa el endpoint existente `/api/catalogue`, incluida su ingesta IGDB.

`POST /api/library` con `action: favorite_slot` valida ranura y UUID, usa el RPC con la sesión del propietario y revalida perfil y biblioteca. El RPC es `security invoker`, conserva RLS y no admite un ID de propietario enviado por el cliente. Un error de inserción revierte la desasignación anterior.

## Telemetría

El HUD distingue conexión pendiente, suscripción WebSocket activa y desconexión con respaldo. El contador empieza esperando una señal y usa tiempo real transcurrido. Cada actualización identifica su origen: WebSocket, respaldo de 30 segundos, regreso a la pestaña o sincronización manual. Los eventos próximos se agrupan durante 500 ms para limitar refrescos. El reloj y respaldo se pausan en pestañas ocultas; todos los listeners, temporizadores y canales se limpian al desmontar.

El botón Sincronizar usa `router.refresh()` en transición y muestra progreso sin recargar el documento. La animación se desactiva con movimiento reducido.

## Evidencia

- 42 pruebas unitarias: validación de ranuras, IDs, presets, URLs propias y cambios del borrador, además de las regresiones existentes.
- Lint, TypeScript estricto y formato verificados; build de producción completo en Next.js 16.4.0 con `src/proxy.ts` intacto.
- Prueba real `tests/integration/wallpaper-top4.test.ts`: subida y lectura del objeto propio, guardado de preset y wallpaper propio, rechazo de URLs ajenas, intercambio de ranuras, vaciado, nuevo juego en backlog, conservación de nota y horas, rollback ante UUID inexistente y aislamiento por RLS. Paginación comprobada con 30 juegos y búsqueda por título. Cuenta y objeto temporales eliminados.
- Navegador sobre `npm run start`: guardado de Synthwave en Studio, fijado desde Mis Juegos, búsqueda real de Chrono Trigger en IGDB, asignación y desasignación desde el perfil. Consola sin errores.
- Feed: WebSocket conectado y un checkpoint real recibido; contador mostró origen WebSocket. Sincronización manual reinició a cero y mostró estado de progreso; respaldo automático identificado por separado.
- Móvil 375 px: documento 360 px, wallpaper 320 px y diálogo 326 px con contenido de 309 px; sin desbordamiento.
- El servidor de desarrollo produjo recargas HMR repetidas durante la sesión de verificación; la comprobación visual completa se hizo con el build de producción local.

Capturas: `docs/evidence/profile-wallpaper.png`, `top4-slot-editor.png`, `top4-slot-editor-mobile.png`, `profile-wallpaper-top4.png` y `feed-telemetry.png`.

Para repetir la prueba real:

```powershell
$env:TEST_PROFILE_EXTRAS_LIVE='1'
$env:TEST_APP_URL='http://localhost:3000'
node --env-file=.env.local --experimental-strip-types --test tests/integration/wallpaper-top4.test.ts
```

Entrega preparada para despliegue. Este paquete no se publicó en Vercel durante su implementación.
