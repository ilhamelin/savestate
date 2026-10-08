# Fase 3: Sala Arcade, compañeros y habitaciones

La especificación fuente se conserva en `fase3_arcade_duelos_y_lfg_companeros.md`. Esta entrega incorpora `/parties`, un duelo comunitario en el inicio y tres temas de perfil, sin añadir dependencias.

## Base de datos

`supabase/migrations/202610070008_arcade_and_parties.sql` contiene el esquema completo. La migración y sus dos ajustes fueron aplicados por el propietario del proyecto Supabase y comprobados con sesiones reales:

- `room_theme` admite `crt_terminal`, `handheld_console` y `retro_shelf`; tiene permiso de actualización de columna para usuarios autenticados y conserva la política de autoría del perfil.
- `game_duels` se administra mediante SQL con una cuenta administrativa. Los clientes solo leen duelos.
- `duel_votes` usa clave primaria `(duel_id, user_id)`. No concede edición ni borrado a clientes. Su trigger exige un juego del duelo y que este siga activo; bloquea la fila del duelo para coordinar su cierre con votos concurrentes. La función tiene `SECURITY DEFINER`, `search_path = ''` y ejecución directa revocada.
- Los votos son públicos bajo RLS, tal como propone la especificación. La interfaz consulta agregados con `duel_results`, no descarga todos los votantes.
- `party_requests` admite las seis plataformas y cuatro estilos documentados. El trigger fija fechas en servidor, exactamente a 48 horas, y los clientes no tienen permiso para suministrar ni modificar esas fechas. Solo su autor puede retirarlas.
- La expiración oculta convocatorias mediante RLS y consultas `expires_at > now()`; no borra físicamente filas. Los índices no usan `now()` en predicados, porque PostgreSQL exige funciones inmutables allí.

Si ya se aplicó la primera versión mostrada en el chat, los ajustes complementarios fueron:

```sql
grant update (room_theme) on public.profiles to authenticated;
alter function public.validate_duel_vote() security definer;
```

## Activar un duelo comunitario

El widget muestra el duelo activo más reciente. Si no hay ninguno, presenta un estado vacío. No genera enfrentamientos ni elige juegos arbitrariamente.

En el SQL Editor, consulta los juegos ya ingeridos para elegir sus UUID:

```sql
select id, title from public.games
where title ilike '%Chrono Trigger%' or title ilike '%Halo%'
order by title;
```

Después crea un duelo con dos UUID diferentes del catálogo:

```sql
insert into public.game_duels (game_a_id, game_b_id, title)
values ('UUID_DEL_JUEGO_A', 'UUID_DEL_JUEGO_B', 'Tu duelo comunitario');
```

Para rotar el enfrentamiento, desactiva el anterior con `is_active = false` y crea una fila nueva. Conserva los juegos de duelos históricos para que sus votos mantengan significado. No hace falta un despliegue para activar un duelo.

## Interfaz y servicios

- `GET /api/arcade` devuelve el duelo actual, carátulas, agregados y voto propio. `POST /api/arcade` registra votos con sesión y mismo origen. Reintentar el mismo voto es idempotente; elegir otro después devuelve 409.
- `GameDuelWidget` muestra botones antes del voto y barras complementarias después. Realtime escucha inserciones del duelo; una consulta cada 15 segundos mientras la página está visible recupera cambios si la conexión falla. Las peticiones obsoletas se cancelan y no sobrescriben el voto recién registrado.
- `/parties` filtra plataforma/estilo y pagina 12 convocatorias. El formulario usa un diálogo nativo con foco contenido, cierre por Escape y retorno al botón de apertura. Reutiliza la búsqueda paginada de IGDB/PostgreSQL. Las tarjetas muestran autor, juego, horario, contacto y tiempo restante; se ocultan al caducar y solo ofrecen retirada al autor.
- `POST /api/parties` valida juego, plataforma, estilo, horario de 3–100 caracteres y contacto de 3–500. La identidad procede de la sesión. El contenido se representa como texto, sin ejecutar HTML ni convertir contactos en destinos automáticos.
- Profile Studio permite previsualizar y guardar la habitación, con el mismo dock de cambios, descarte y Ctrl+S. El perfil público presenta CRT con líneas estáticas, un marco portátil con controles decorativos o una estantería con cajas en Top 4 y biblioteca. Las animaciones del VS y barras respetan movimiento reducido.
- La cabecera pasa a dos filas antes de 1400 px para acomodar Compañeros y la campanita. `src/proxy.ts` permanece como convención canónica.

## Verificación

`npm run check`: lint, TypeScript estricto, formato y 30 pruebas unitarias correctas. `npm run build`: empaquetado de producción correcto.

La prueba optativa `tests/integration/arcade.test.ts` crea dos usuarios temporales en Supabase y comprueba:

- voto válido, reintento, unicidad, elección ajena, suplantación y rechazo de duelo cerrado;
- recepción del voto en otra sesión mediante Supabase Realtime;
- creación, límites, sesión obligatoria y retirada exclusivamente por el autor;
- expiración exacta de 48 horas y exclusión de convocatorias vencidas para visitantes;
- persistencia y renderizado público de los tres temas, validación del tema y rechazo de edición de otro perfil.

Se ejecuta contra un servidor local y limpia sus usuarios/duelos al finalizar:

```powershell
$env:TEST_ARCADE_LIVE = '1'
$env:TEST_APP_URL = 'http://localhost:3011'
node --env-file-if-exists=.env.local --experimental-strip-types --test tests/integration/arcade.test.ts
```

La revisión de navegador comprueba creación desde el modal, voto y porcentajes, cambio de habitación desde ajustes y presentación del perfil público. Se verificó ausencia de desbordamiento horizontal a 1280 px y a 390 px; el modal móvil ocupa 341 px y dirige el foco al buscador. Las imágenes de evidencia usan exclusivamente una cuenta temporal. No se ha desplegado esta fase a producción.

Evidencia: `docs/evidence/habitacion-portatil.png`, `habitacion-estanteria.png`, `companeros.png`, `companeros-mobile.png` y `duelo-mobile.png`.
