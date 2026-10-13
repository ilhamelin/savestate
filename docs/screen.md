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

Endpoints: `GET /api/screen/popular`, `GET /api/screen/search`, `GET /api/screen/media/[id]` y `POST /api/screen/progress`. Las búsquedas y fichas son públicas; el guardado requiere sesión y origen válido. El servidor obtiene título y número de episodios desde TMDB o el catálogo demo, sin confiar en metadatos enviados por el cliente.
