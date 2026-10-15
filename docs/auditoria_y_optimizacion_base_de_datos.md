# Auditoría y optimización de base de datos

La migración revisada es `supabase/migrations/202610150034_database_audit_and_optimizations.sql`. Conserva los datos y los permisos de columnas existentes; no sustituye el esquema ni elimina tablas.

## Cambios revisados

- Índices idempotentes para las claves foráneas de las tablas auditadas y consultas frecuentes. Incluye tanto `game_id` como `user_id` en `party_requests`. Las claves ya cubiertas por una clave primaria o un índice existente no requieren otro índice exclusivo.
- Índice parcial `idx_notifications_unread` en `(user_id, created_at desc) where read_at is null`.
- RLS con `(select auth.uid())` en notificaciones, perfiles, biblioteca, Screen, mensajes privados y chat global. `library_add` sigue siendo INSERT; `library_edit` sigue siendo UPDATE. El INSERT de mensajes privados sigue exigiendo amistad aceptada. No se amplían los grants de columnas ni la lectura de bibliotecas privadas.
- `play_logs_console_progress_check` permite `gamerscore`, `trophies` y `achievements`. Comprueba tipos antes de convertir números y rechaza `kind: null`, datos incompletos, fracciones y valores fuera de rango. Conserva el límite de 10 000 000 y el comportamiento previo respecto a `current > total`.

Los índices de Screen por TMDB y de la bóveda por estado son índices de consulta: sus claves foráneas de usuario ya tienen cobertura en el esquema previo. No todos los índices de este script representan una clave foránea sin cobertura previa.

## Aplicación en producción

1. Copiar **todo** el archivo de la migración 034 al SQL Editor de Supabase Studio.
2. Ejecutarlo y guardar la consulta con el nombre **`34_database_audit_and_optimizations`**.
3. Comprobar que la transacción termine correctamente. El despliegue de Vercel no aplica este SQL.

`CREATE INDEX` normal puede bloquear escrituras durante la construcción; este script no es no bloqueante. Para tablas grandes, planificar una ventana de mantenimiento o construir los índices con `CONCURRENTLY` en un script separado fuera de una transacción. No cambiar simplemente a `CONCURRENTLY` conservando `BEGIN`/`COMMIT`.

La validación del CHECK recorre los registros existentes. Si encuentra datos inválidos, falla y revierte la transacción: no los borra ni los modifica automáticamente.

## Verificación reproducible

`npm run check` ejecuta ESLint, TypeScript, pruebas unitarias y Prettier. No ejecuta por sí solo las pruebas de integración ni aplica SQL.

La integración SQL se prueba sin credenciales ni conexión a producción mediante `tests/integration/database-audit.mjs`. Usa PostgreSQL PGlite instalado temporalmente fuera del proyecto:

```powershell
$env:SAVESTATE_PGLITE_MODULE = 'C:/ruta/temporal/node_modules/@electric-sql/pglite/dist/index.js'
node tests/integration/database-audit.mjs
```

El test crea los esquemas auxiliares de Supabase, aplica todo el historial local, carga progreso existente, aplica la 034 dos veces y comprueba índices, conservación de datos, políticas, permisos entre usuarios y validaciones de JSON. Es una comprobación funcional aislada; no mide mejoras de latencia ni certifica que la migración esté aplicada en el proyecto remoto.
