# Fase 2: estudio visual de perfil y listas con personalidad

Implementación basada en `fase2_estudio_perfil_y_listas_personalizadas.md`, conservada desde la rama de investigación. No añade dependencias ni migraciones SQL.

## Estudio de perfil

`ProfileStudio` mantiene un borrador de identidad, imágenes, acento, estado, privacidad y enlaces, comparado con el último perfil guardado. Reutiliza `ProfileIdentity` con slots de edición y botones de cámara: el perfil público conserva su presentación actual.

Nombre y estado se editan sobre la tarjeta. Los cinco estados rápidos y la paleta de cuatro colores actualizan el borrador y las variables CSS locales inmediatamente. La vista móvil mide 375 px cuando hay espacio disponible y se adapta al ancho real en dispositivos más pequeños; dispone de marco y scroll interno. La vista escritorio ocupa el ancho del editor.

El dock aparece solo con cambios pendientes. Guardar admite Ctrl+S y Cmd+S, usa validación HTML y las mismas validaciones de dominio que el servidor. Descartar restaura todos los campos, incluido el material visual pendiente. El editor advierte mediante `beforeunload` ante cierre/recarga y confirma salidas al pulsar enlaces. No intercepta el historial del navegador.

Los overlays admiten PNG/JPG/WebP de hasta 10 MB. El cliente comprime a WebP de hasta 512000 bytes, con máximo de 512 px para avatar y 1600 px para banner, y rechaza bitmaps mayores de 40 megapíxeles. Las URLs blob se liberan al reemplazar, guardar, descartar y desmontar. La CSP permite `blob:` exclusivamente en `img-src` para estas vistas previas.

La subida ocurre al guardar, a los nombres autorizados por RLS: `SU_UUID/avatar.webp` y `SU_UUID/banner.webp`. Antes de reemplazar un archivo se conserva su contenido; si falla la subida o el guardado del perfil, se intenta restaurar el anterior o quitar el archivo nuevo. Si falla también la restauración, se muestra un error específico y se conserva el borrador. Storage y PostgreSQL no comparten una transacción: esta recuperación es compensatoria y depende de que Storage siga disponible.

## Listas

Las plantillas completan título y descripción de cuatro colecciones sugeridas, con edición libre posterior. Cada juego admite una nota de varias líneas de hasta 1000 caracteres mediante el servicio existente; RLS mantiene la edición exclusiva del dueño. La nota se muestra como texto escapado, con marco de terminal y posición en la colección.

`ListCover` compone cuatro celdas con las carátulas de los primeros juegos ordenados por `position_index`, con desempate por `game_id`. Las celdas sin juego o sin carátula muestran un icono de reserva. El mosaico se utiliza en el índice y en la cabecera de la ficha. El esquema actual no tiene una columna de portada personalizada.

El índice obtiene hasta cuatro elementos por lista en una consulta relacional limitada de PostgREST. Se añadieron a los tipos de TypeScript las dos relaciones de `list_items` ya existentes en la base de datos; no se alteró el esquema. La consulta y las portadas respetan las políticas de visibilidad de las listas.

## Verificación

- `npm run check`: lint, tipos estrictos, formato y 27 tests unitarios, incluyendo detección de cambios y límites de notas.
- `npm run build`: compilación de producción Next.js 16.4.
- Integración real con cuentas temporales: persistencia de perfil, notas de 1000 caracteres, rechazo de 1001, rechazo de edición ajena por RLS, consulta relacional del mosaico y ocultamiento de una lista privada.
- Navegador: cambios reactivos, descarte de identidad/privacidad/enlaces, vista previa de 375 px, overlays y compresión local, ausencia de subidas antes de guardar, persistencia mediante Ctrl+S y desaparición del dock.
- Prueba de fallo deliberado: nombre de usuario ocupado (409), conservación del borrador y comprobación de que el avatar anterior se restauró exactamente mediante su hash SHA-256.
- Navegador: creación desde plantilla, alta y edición de nota de varias líneas y mosaico de cuatro carátulas. Capturas en `docs/evidence/`.

Para repetir la integración con una aplicación local:

```powershell
$env:TEST_STUDIO_LIVE = '1'
$env:TEST_APP_URL = 'http://localhost:3011'
node --env-file=.env.local --experimental-strip-types --test tests/integration/profile-lists.test.ts
```

Las cuentas de integración se eliminan en `finally`; no se modifican cuentas existentes. Un `notFound()` emitido tras empezar el streaming puede conservar HTTP 200 en Next.js: la prueba de privacidad comprueba además la ausencia de datos y la marca `noindex`.
