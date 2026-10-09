# Importador multiplataforma

Referencia: `docs/propuesta_importador_consolas.md`, conservada desde `research/antigravity`. Migración: `202610080016_console_imports.sql`, cuya ejecución en Supabase fue confirmada por el usuario.

## Uso

`/library/import` ofrece Steam, PlayStation (PSN) y Xbox. Steam conserva su integración existente. En las consolas se puede guardar o borrar el identificador público, subir CSV/JSON o pegar un título por línea. Los identificadores también se editan en Profile Studio y aparecen en el perfil público; no implican verificación de propiedad ni acceso automático a PSN/Xbox.

Hasta 200 títulos y 200 KB por archivo. Se aceptan CSV con separador coma o punto y coma, BOM, campos entre comillas y comillas escapadas. JSON puede ser un array de títulos/objetos o un objeto con `games`. Campos: `title` (`name`, `game`, `game_name`, `nombre`, `título`), `platform` (`plataforma`), `hours` (`hours_played`, `playtime_hours`, `horas`), `minutes` y `status`. Si el proveedor exporta otra estructura, hay que adaptar sus columnas; no se presupone compatibilidad con todos los exportadores.

```csv
title,platform,hours,status
"Final Fantasy VII",PS5,12.5,playing
```

```json
{ "games": [{ "title": "Halo", "platform": "Xbox One", "hours": 8.5, "status": "playing" }] }
```

La previsualización permite desmarcar juegos, editar horas, estado y plataforma, y buscar coincidencias en el catálogo existente/IGDB. El usuario confirma la edición concreta antes de importar. Sin estado explícito, las horas solo sugieren `playing`; no prueban que el juego esté terminado. `completed` se traduce a `cleared` y `abandoned` a `dropped`, usando los estados reales de SaveState.

La lista se pagina de diez en diez; importa secuencialmente los juegos confirmados con una barra de progreso y opción de detener tras el juego actual. Los juegos sin coincidencia quedan pendientes. Un error conserva los resultados anteriores y permite reintentar.

## Persistencia y seguridad

- La RPC se ejecuta con la sesión del propietario y RLS; no acepta un usuario externo ni utiliza la clave de servicio.
- Bloquea la ficha de biblioteca para serializar importaciones concurrentes. Una repetición no duplica la partida ni las horas para la misma plataforma y fuente.
- Juegos nuevos: estado confirmado y horas del archivo, con `play_method = hardware`. Juegos existentes: conserva estado, nota, favorito y partidas manuales; registra la plataforma con cero horas si falta el marcador de importación, evitando sumar un histórico potencialmente duplicado.
- Parámetros SQL y servidor validan fuente, pertenencia de plataforma, estado y horas finitas entre cero y 100000. PSN ID/Gamertag admiten 3–30 caracteres o `null` para borrar.
- Mutaciones exigen sesión, mismo origen, JSON y límites de tamaño. Los archivos se leen en cliente y su contenido se analiza en servidor; no se almacenan los archivos originales. No se añadieron dependencias ni se modificó `src/proxy.ts`.

## Verificación

- `npm run check`: ESLint, TypeScript estricto, 48 pruebas unitarias y formato.
- `npm run build`: empaquetado de Next.js 16.4.0 con `/api/consoles/import` y `/library/import`.
- Prueba integral contra Supabase real: pasó en 9.55 segundos. Sesión/origen inválidos rechazados; identificadores guardados y borrados; CSV previsualizado; búsqueda real de Chrono Trigger; seis importaciones concurrentes produjeron una sola ficha y una sola partida de 12.5 horas; un `user_id` externo no alteró el propietario. Una ficha Platinum con nota 9.5 y favorito conservó sus datos y dos horas manuales. Una plataforma incompatible fue rechazada antes de crear la ficha. Se comprobó también una importación Xbox de cero horas.
- Navegador sobre build local de producción: subida real de CSV Xbox, lectura de plataformas/horas/estados, selección de edición PlayStation y guardado de 12.5 horas, edición de Xbox en Profile Studio y exhibición de ambas insignias públicas. Consola sin errores. A 375 px, documento de 360 px sin desbordamiento horizontal.
- Cuentas y archivos temporales eliminados; servidor de prueba detenido. Capturas en `docs/evidence/console-import-desktop.jpg`, `console-import-mobile.jpg` y `console-profile-badges.jpg`.

Para repetir la prueba integral, inicia `npm run start` con el build generado y ejecuta:

```powershell
$env:TEST_CONSOLE_IMPORT_LIVE='1'
$env:TEST_APP_URL='http://localhost:3000'
node --env-file=.env.local --experimental-strip-types --test tests/integration/console-import.test.ts
```

El despliegue de esta entrega a Vercel queda pendiente.
