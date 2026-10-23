# Sala Arcade y convocatorias LFG (SPEC-08)

La ruta canónica es `/arcade`. `/parties` redirige permanentemente (308) a ella. El Chat Global conserva `/chat`.

## Contratos y seguridad

- GET `/api/parties?platform=PC&playstyle=casual&page=1` es de lectura pública, devuelve `{ data: PartyFeedResponse }` y `Cache-Control: private, no-store`.
- Plataforma y estilo son opciones cerradas; una página es un entero decimal de 1 a 10000. Valores desconocidos y parámetros duplicados devuelven 400 antes de consultar Supabase.
- POST usa la protección de origen y JSON de `mutation`. Requiere sesión (401); crear valida UUID, horario de 3–100 y contacto de 3–500 caracteres tras recortar espacios.
- El servidor fija el propietario y la base de datos fija creación y expiración a 48 h. No se aceptan esos campos del cliente.
- Retirar requiere confirmación en UI y una coincidencia de ID y propietario en el servidor. Una fila ajena o ausente devuelve 404.
- El feed excluye `expires_at <= now()`, pagina de 12 en 12 con una fila de anticipación y conserva las políticas RLS existentes.
- Notas y horarios se renderizan como texto de React, sin interpretar HTML.

## Interfaz y operación

El servidor carga duelo, feed y sesión concurrentemente. Sin duelo activo aparece un estado vacío; sin configuración se muestra SetupNotice. No se crean datos de ejemplo.

El tablero permite filtros, paginación, reintento manual y publicación mediante un diálogo nativo. Cambiar criterios cancela la consulta anterior y nunca mezcla páginas de filtros distintos. Las mutaciones actualizan la lista. El catálogo usa el buscador existente `/api/catalogue`; no se añade un endpoint duplicado ni dependencias.

Se reutilizan el widget de duelo y las tarjetas de lobby con copia de contacto. La votación mantiene el Realtime existente y su autorización. Los estilos son una columna por debajo de 640 px y dos a partir de ese ancho. El diálogo captura el foco, cierra con Escape y lo devuelve al botón de publicación.

Requiere la migración existente `202610070008_arcade_and_parties.sql`, indicada como aplicada en SPEC-08. Esta entrega no añade migraciones ni necesita nuevas variables.

## Verificación

`tests/unit/arcade-parties-api.test.ts` ejecuta el endpoint y el servicio reales con un adaptador Supabase aislado: filtros, paginación, expiración, sesiones, origen, límites, campos de servidor y borrado por propietario. Las pruebas aisladas no certifican el esquema de una instancia Supabase en vivo.

Verificar `npm run check`, `npm run build` y el preview del PR antes de fusionar.
