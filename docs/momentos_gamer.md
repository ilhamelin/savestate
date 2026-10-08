# Momentos Gamer

Implementación de `propuesta_momentos_highlights.md`, con las correcciones de
privacidad aprobadas en las migraciones 005 y 006. No se ejecutan migraciones
desde la aplicación; las aplicó el propietario en Supabase SQL Editor.

## Uso

- `/highlights`: publicaciones recientes, categorías y paginación de 12.
- Publicar: título de 3–120 caracteres, descripción Markdown hasta 5000,
  categoría, juego opcional y hasta cuatro capturas o un enlace de YouTube.
- YouTube admite enlaces HTTPS `youtu.be`, `watch?v=` y `shorts/`. Solo se guarda
  el identificador validado y se incrusta desde `www.youtube-nocookie.com`.
- Capturas PNG/JPG/WebP se convierten en cliente a WebP de hasta 1 MB.
- Reacciones Critical Hit, GG y Game Over: una por jugador; repetirla la quita.
- Comentarios hasta 2000 caracteres, paginados de 20. Cada autor puede borrar
  sus comentarios o publicaciones.
- Enlaces a momentos desde la navegación, Ctrl+K, perfiles y fichas de juego.
- La actividad de momentos vinculados a juegos aparece en Transmisión.

## Privacidad

- `Solo yo` corresponde a `is_private`. El resto respeta la privacidad de la
  biblioteca y las amistades; seguir a alguien no concede acceso privado.
- Bucket `highlights` privado. `image_urls` contiene rutas
  `<user_id>/<post_id>/<archivo>.webp`, no URLs permanentes.
- Lecturas y firmas usan el cliente Supabase de la sesión, con RLS. La aplicación
  no usa la clave de servicio para acceder a publicaciones o medios.
- Firmas de 300 segundos, sin caché compartida. Una firma emitida antes de un
  cambio de privacidad conserva su validez hasta expirar.
- La 006 añade un guard restrictivo de Storage y respeta la visibilidad del post
  en activity_logs, incluso después de un cambio a privado o una eliminación.
- CSP conserva nonce y permite únicamente el dominio de incrustación de YouTube.
- Las descripciones se limpian al guardar y el Markdown se sanitiza al renderizar.
- Una subida interrumpida puede dejar capturas aún sin publicación; permanecen
  accesibles solo para su autor. Los reintentos en el mismo formulario reutilizan
  subidas y el identificador para evitar duplicar publicaciones.

## Verificación

Tests unitarios de YouTube, rutas propias, límites, categorías y medios excluyentes.
Test real optativo: `TEST_HIGHLIGHTS_LIVE=1` y `TEST_APP_URL` local, seguido de
`npm run test:integration`. Crea sus propias cuentas y capturas temporales y las
elimina al terminar. Cubre API, comentarios, reacciones, Storage firmado,
bibliotecas privadas, amistades y visibilidad de activity_logs.

- `npm run check`: lint, TypeScript estricto, formato y 25 tests unitarios pasan.
- `npm run build`: compilación de producción aprobada, con `src/proxy.ts`.
- Integración real de Momentos y cabeceras HTTP: aprobada. Comprueba también
  reintentos idempotentes y rechazo de escritura en carpetas ajenas.
- Navegador: publicación de dos PNG convertidos a WebP, carga mediante URLs
  firmadas, carrusel, reacción, comentario y reproductor de YouTube nocookie.
  Consola sin errores; cuenta, publicaciones y objetos de prueba eliminados.
- La primera prueba detectó que el bucket aún era público. Se aplicó la 006 y
  se repitió la matriz de permisos satisfactoriamente antes de desplegar.
- Evidencia de interfaz con datos desechables: `evidence/momentos-gamer.png`.

## Producción

Desplegado con `npx vercel --prod` en
`https://savestate-eight.vercel.app/highlights`.
Deployment `dpl_H5zNT13BTRGTAHvUaEyxjXmuzRUH`, estado READY.

Verificación posterior: `/highlights` responde 200, contiene CSP nonce y
`frame-src 'self' https://www.youtube-nocookie.com`, y no usa caché compartida.
Publicar sin sesión responde 401. El navegador renderiza el módulo sin errores
de consola. Evidencia pública: `evidence/momentos-produccion.png`.
