# Horas estimadas y progreso de consolas

## Cambios

- Importador Xbox/PSN: aviso sobre la ausencia de horas en la sincronización actual y herramienta de horas por juego para todas las filas seleccionadas y pendientes. Admite cero y hasta 100000 horas, con dos decimales; conserva filas desmarcadas e importadas y no cambia los estados elegidos.
- Biblioteca: «Editar horas» permite elegir una partida y sustituir sus horas totales. Conserva fechas, notas y metadatos. Una actualización concurrente de horas devuelve 409, sin sobrescribirla. La corrección de una estimación no genera XP de sesión.
- Al guardar, `router.refresh` actualiza totales y se revalida biblioteca/perfil. Dossier y gráficos siguen usando `play_logs` como fuente única.
- Xbox: resumen de Gamerscore actual/máximo; PSN: total de trofeos obtenidos/disponibles cuando están presentes las cuatro categorías. No se inventan totales ausentes ni se convierte Gamerscore en horas.
- Los resúmenes se muestran en previsualización y biblioteca, con la plataforma correspondiente. Son instantáneas del último importado; no representan una lista de logros individuales ni incluyen logros de Steam.

## Persistencia

La migración `202610090018_console_progress.sql`, confirmada como ejecutada por el usuario, añade `play_logs.console_progress` con validación de tipo y cantidades. Conserva la nota del usuario y el marcador exacto usado por la RPC 016, de modo que añadir un resumen no rompe la deduplicación de importaciones. Las políticas RLS existentes protegen la lectura y actualización.

Al reimportar, se conservan las horas y datos previos y se actualiza el resumen. Las partidas antiguas sin metadato lo recibirán al sincronizar y confirmar de nuevo su importación. La RPC original y la actualización del metadato son operaciones separadas; un error se informa y puede reintentarse con el marcador intacto.

## Verificación

- `npm run check`: salida 0, 60 pruebas unitarias, lint, tipos y formato.
- `npm run build`: salida 0 con un trabajador local (`CIRCLE_NODE_TOTAL=2`).
- Prueba integral en Supabase real: pasó en 10.22 segundos. Dos importaciones conservaron una sola partida y sus 35.5 h, actualizando el Gamerscore a 900/1000. Edición a 42.25 h, conflicto 409, input negativo, rechazo de progreso incompatible y acceso a partida ajena verificados. Notas, fechas y metadatos conservados; XP sin cambios.
- OpenXBL real: HTTP 200, 200 títulos normalizados, 191 con Gamerscore válido conservado por el parser. Sin mostrar credenciales ni listas personales.
- Navegador con cuenta temporal privada: la asignación en lote dejó 37.5 h en el título seleccionado y 0 h en el desmarcado. Edición rápida de 0 a 45.5 h; biblioteca, Dossier y ecosistema Xbox One mostraron 45.5 h y 100% de horas en esa plataforma. Resumen 850/1000 G conservado; consola del navegador sin errores.
- Evidencia: `docs/evidence/console-bulk-hours.png` y `docs/evidence/console-hours-dossier.png`. Sesión cerrada, cuentas, archivos temporales y servidor eliminados.

Esta entrega queda en la rama de implementación; no se solicitó despliegue en esta tarea.
