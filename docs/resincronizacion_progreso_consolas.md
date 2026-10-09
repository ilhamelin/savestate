# Resincronización de progreso de consolas

- Se elimina el control de horas estimadas en lote, estado, helper, estilos y prueba asociada. El aviso del importador aclara que el proveedor no facilita horas en este flujo; la sincronización entrega cero para los nuevos registros. Las herramientas individuales ya existentes se conservan.
- Al sincronizar Xbox/PSN, se actualiza `console_progress` de partidas identificadas como importadas, usando el cliente autenticado y RLS. No se crean partidas ni se modifican horas, fechas, notas, estado, puntuación o favoritos.
- La identificación utiliza el título de origen recordado; para registros anteriores usa el nombre del catálogo. Prefiere la plataforma correspondiente y evita títulos aproximados o ediciones ambiguas. Los casos sin una correspondencia inequívoca se conservan para confirmarlos en el importador.
- Las nuevas importaciones recuerdan `source_title` dentro del JSON existente, antes de que el usuario edite el nombre para buscar en catálogo. No requiere otra migración: se usa la 018 aplicada previamente.
- La insignia comparte componente entre importador y biblioteca: encabezado Gamerscore/trofeos, cifras grandes, barra accesible y plataforma.

## Verificación

- `npm run check`: 61 pruebas unitarias, lint, TypeScript y Prettier.
- `npm run build`: salida 0, un trabajador local.
- Prueba integral con Supabase real y transportes upstream simulados: 8.49 segundos. La resincronización repetida actualizó una partida antigua sin metadato, conservando 12.5 h, nota, estado, rating y favorito. No cambió la sesión manual del mismo juego ni añadió partidas.
- Navegador: insignia 850/1000 G y plataforma visibles, barra de progreso correcta; ausencia de ambos controles de horas en lote tras previsualizar una lista. Sin errores de consola. Evidencia: `docs/evidence/console-progress-badge.png`.
- Cuentas temporales, archivos de QA y servidor eliminados.

Para repetir la prueba integral, configurar `TEST_CONSOLE_SYNC_TITLE` en servidor y proceso de pruebas con el título del primer juego de `public.games` ordenado por ID. Activar `TEST_CONSOLE_SYNC_MOCK=1` y el preload `tests/integration/console-sync-upstream.mock.mjs` únicamente en el servidor local. En la prueba usar `TEST_CONSOLE_SYNC_LIVE=1` y `TEST_APP_URL=http://localhost:3000`. El título configurable vincula el transporte simulado a un juego del catálogo existente sin crear ni borrar títulos públicos.
