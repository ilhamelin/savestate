# Screen

La ruta `/screen` reúne el radar de adaptaciones, catálogo, búsqueda, fichas y bitácora privada de cine y series. Los enlaces desde `/games/[slug]` seleccionan la adaptación mediante `?select=TMDB_ID&type=tv|movie`.

Configura **una** credencial de servidor en `.env.local` para activar TMDB:

```env
TMDB_API_KEY=
# Alternativamente: TMDB_READ_TOKEN=
NEXT_PUBLIC_JUSTWATCH_DEFAULT_REGION=CL
```

La clave nunca se envía al navegador. Sin credenciales se muestra un catálogo demo identificado, con episodios de ejemplo y sin inventar disponibilidad de streaming. Regiones soportadas: CL, MX, ES y US. Los proveedores diferencian suscripción, alquiler y compra; su enlace conduce a la ficha de disponibilidad suministrada por TMDB/JustWatch.

Aplica `supabase/migrations/202610130029_screen_journal.sql` antes de guardar progreso. La tabla `user_screen_entries` permite acceso únicamente al propietario autenticado. `watched_episodes` almacena claves `temporada * 10000 + episodio`, evitando colisiones entre temporadas. Las notas admiten 2000 caracteres y las calificaciones 0–10 en pasos de 0,5.

El botón `+1 Ep` registra el primer episodio pendiente. Marcar una serie como completada marca sus episodios conocidos; el checklist permite retirar episodios vistos. En escritorio la ficha es lateral y en móvil es un diálogo con cierre mediante Escape.

La grilla adapta sus columnas al ancho disponible y ocupa todo el catálogo al cerrar la ficha. El radar y la ficha permiten abrir los tráileres disponibles en un reproductor de YouTube con dominio `youtube-nocookie.com`; el visor se cierra con Escape, el botón Cerrar o un clic fuera. Los proveedores se agrupan en suscripción y alquiler/compra, manteniendo sus logos y enlaces regionales.

Los tráileres priorizan Trailer sobre Teaser, versiones oficiales y, después, español latino (país o nombre del video), español general, España e inglés. La consulta de videos incluye `es-MX,es,en`.

El Hero Radar tiene cinco slots ordenados: Arcane, The Last of Us, Fallout, Castlevania: Nocturne y Super Mario. Los controles superiores y la cola inferior sincronizan la selección; las flechas recorren circularmente los títulos sin rotación automática. La calibración refleja la región JustWatch elegida y los chips usan los proveedores reales cuando existen. El modo demo identifica los valores de muestra. Los subtítulos, rankings, estados y clasificaciones son metadatos editoriales del prototipo, no una consulta de clasificación por país en tiempo real. Castlevania usa el ID TMDB correcto `123548`; `100883` corresponde a otra serie.

La ficha de telemetría usa cabecera HUD, estados 2×2, cinco estrellas (equivalentes a 2–10 puntos), notas privadas desplegables, checklist por temporada y tarjetas de plataforma/IP original. El contador de vistos y su barra corresponden a la temporada seleccionada. La duración usa `runtime` para películas y el promedio de `episode_run_time` para series, con fallback a las duraciones de episodios de la temporada consultada. No se inventan duración, calidad 4K, Dolby, doblajes ni latencia: esos datos quedan por confirmar si la fuente no los aporta. El indicador inferior distingue el guardado en curso, la sesión disponible y la necesidad de conectar una cuenta; no afirma un guardado exitoso sin confirmación.

El botón «Compartir en Chat Global» publica el título, estado, calificación, avance y enlace de Screen junto al arte oficial de TMDB. Usa `POST /api/discord/messages`, el servicio del chat unificado en `/chat`, y respeta su límite de 500 caracteres y 3 segundos entre envíos. Las notas privadas nunca se incluyen. El envío es explícito y requiere sesión; los errores aparecen en la ficha sin descartar el progreso.

Endpoints: `GET /api/screen/popular`, `GET /api/screen/search`, `GET /api/screen/media/[id]` y `POST /api/screen/progress`. Las búsquedas y fichas son públicas; el guardado requiere sesión y origen válido. El servidor obtiene título y número de episodios desde TMDB o el catálogo demo, sin confiar en metadatos enviados por el cliente.

El radar de seguimiento requiere `supabase/migrations/202610130030_screen_watchlist.sql`. «Seguir en Radar» guarda `followed` en la bitácora privada y añade el título bajo el catálogo. `GET /api/screen/watchlist?region=CL` devuelve únicamente los seguimientos del usuario autenticado. Cambiar la región vuelve a resolver la disponibilidad de proveedores. Sin la columna, los guardados normales siguen funcionando, pero seguir un título informa que falta la migración.

Para series se muestra el próximo episodio anunciado por TMDB; si no existe, se usa el primer episodio pendiente de la temporada cargada. Películas usan su fecha de estreno. Las fechas sin hora tienen referencia a las 00:00 UTC; el contador indica «POR ANUNCIAR», «¡ESTRENO HOY!» o «DISPONIBLE» según corresponda. Datos demo y fallos de TMDB no generan fechas ficticias.

«Avisar a Discord» es una publicación manual mediante `POST /api/screen/announce`, no una tarea programada. El servidor exige sesión, origen válido y un seguimiento propio; vuelve a obtener fecha/título/proveedores desde TMDB, limita envíos con `claim_discord_message_slot` y usa exclusivamente el canal autorizado `announcements`. Revisa los últimos 100 mensajes y añade nonce estable para reducir duplicados concurrentes. No publica notas ni otros datos privados. Los avisos anteriores que ya no estén entre esos 100 mensajes pueden volver a publicarse.
