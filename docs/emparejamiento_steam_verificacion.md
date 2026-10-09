# Emparejamiento resiliente de Steam

Implementa `solucion_importacion_steam_fichas.md`, consultada desde `research/antigravity`.

- Limpieza de marcas comerciales y segmentos entre corchetes/paréntesis, antes de limitar el término a 80 caracteres.
- Búsqueda secuencial: título limpio en PC; sin filtro de plataforma si no hay candidatas; título principal anterior a `:` o `-` como último intento. Cada etapa se detiene al encontrar resultados. Los términos vacíos se rechazan antes de consultar catálogo.
- `match` admite `title` manual opcional y validado. El ticket firmado sigue siendo obligatorio; el término manual no reemplaza el título, ID o minutos firmados durante el guardado.
- Filtros Todos, Listos y Sin ficha/Pendientes con contadores y paginación sobre el conjunto filtrado. Listos incluye fichas elegidas y juegos ya procesados; Pendientes incluye títulos sin ficha confirmada.
- Campo manual por juego, envío con Enter o Buscar, candidatas con miniatura/año y selección por radio. Puede quitarse la ficha elegida. Una única coincidencia exacta normalizada se selecciona; las coincidencias ambiguas requieren selección.
- Se mantienen estados, selección masiva, confirmación previa, horas y prevención de duplicados. No hay migraciones ni dependencias nuevas.

## Verificación

- `npm run check`: 66 pruebas unitarias aprobadas, lint, TypeScript y formato correctos.
- `npm run build`: aprobado.
- Prueba integral local: Steam simulado, catálogo y Supabase reales. La búsqueda manual Grand Theft Auto V para GTA V devuelve candidatas; dos confirmaciones conservan una partida con 4 horas y marcador `[Steam lifetime:30]`, ignorando AppID/minutos enviados sin firma. Los términos vacíos o mayores de 80 caracteres devuelven 400. Cuenta temporal eliminada.
- Navegador: consulta de tres títulos, limpieza inicial de búsquedas, Enter, ficha elegida, Listos (1) y Pendientes (2); sin errores de consola. La sesión y la cuenta de QA se eliminaron; el servidor se detuvo.
- Evidencia: `docs/evidence/steam-manual-matching.png`.
