# Evolución social: notificaciones y edición de Momentos

Implementación basada en `fase1_notificaciones_y_edicion_momentos.md`, conservada desde la rama de investigación.

## Migración 007

`supabase/migrations/202610070007_moment_notifications.sql` añade notificaciones de comentarios y nuevas reacciones al autor, excluyendo interacciones propias. Mantiene el esquema de la 002 y sus políticas RLS. Complementa la propuesta con la revocación de ejecución directa del trigger y la inclusión idempotente de `notifications` en `supabase_realtime`; elimina la variable `post_title` que no se utilizaba.

El usuario confirmó su ejecución en Supabase. El test real comprobó las filas generadas y la entrega del evento por Realtime a la sesión del destinatario.

## Campanita

`NotificationBell` aparece únicamente para usuarios autenticados. Consulta un endpoint autenticado, sin caché, con las cinco señales más recientes y el total exacto de no leídas. El badge muestra hasta `99+`. El menú permite marcar todas como leídas y acceder a `/notifications`; comparte las etiquetas de tipos con esa página.

La suscripción Realtime filtra por destinatario y conserva RLS; se retira al desmontarse. Hay refresco al navegar, abrir el menú, volver a la pestaña y cada minuto mientras esté visible. Las peticiones anteriores se cancelan. El menú soporta teclado, Escape, retorno de foco, cierre al salir del foco y clic exterior.

La tabla actual no almacena un ID de publicación. Los enlaces conducen al perfil del actor, una alternativa prevista en la propuesta, sin inferir un post a partir de su identidad.

## Edición

Solo el autor recibe el control Editar. El formulario reutiliza las validaciones y conversión de imágenes de creación, precarga título, Markdown, categoría, privacidad y multimedia; permite conservar o quitar capturas, añadir capturas, reemplazarlas por YouTube y eliminar multimedia. El juego relacionado se conserva.

La API autentica, comprueba autoría y valida antes de actualizar. Usa `expected_updated_at` y un UPDATE condicionado por la misma versión para evitar sobrescrituras entre pestañas (409 ante conflicto). Sanitiza Markdown y valida propiedad, existencia, tipo y tamaño de capturas. Conserva el ID del post y sus comentarios/reacciones, actualiza `updated_at` e invalida `/highlights`. Solo tras un UPDATE exitoso elimina archivos reemplazados; un fallo de limpieza deja un archivo privado accesible únicamente a su dueño.

Cambiar a Solo yo oculta automáticamente el evento de actividad por la política de la 006. Las URLs firmadas emitidas anteriormente mantienen su vigencia máxima de cinco minutos, conforme al modelo existente.

## Verificación

- `npm run check`: lint, tipos, formato y 26 tests unitarios aprobados.
- `npm run build`: empaquetado Next.js 16.4 aprobado, incluyendo `/api/notifications` y el proxy nativo.
- Integración real con dos cuentas temporales: triggers, exclusión de interacciones propias, entrega Realtime autenticada, aislamiento RLS, marcado masivo, rechazo de edición ajena y versiones antiguas, conservación de interacciones, sanitización, cambio de multimedia, eliminación de archivos reemplazados y privacidad de actividad.
- Navegador con cuenta temporal: badge de dos señales, menú con etiquetas y tiempos, marcado a cero, edición persistida de título/texto/categoría, cancelación sin guardar y una nueva señal recibida sin recargar; consola sin errores.
- Header y menú comprobados a 320 y 390 px, sin desbordamiento horizontal. Se guardaron capturas de la campanita y del editor en `docs/evidence/`.
- Prueba de regresión real de Momentos existente aprobada: creación idempotente, comentarios, reacciones, actividad y Storage privado.

Para repetir la integración contra una aplicación local compilada:

```powershell
$env:TEST_SOCIAL_LIVE = '1'
$env:TEST_APP_URL = 'http://localhost:3011'
node --env-file=.env.local --experimental-strip-types --test tests/integration/social-evolution.test.ts
```

El test crea y elimina sus cuentas y archivos de prueba. No modifica usuarios existentes ni ejecuta migraciones.
