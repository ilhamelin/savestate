# Corrección de perfil, fichas y catálogo

Fecha: 7 de octubre de 2026.

## Causas y cambios

Los logs de producción confirmaron `ERR_REQUIRE_ESM` al cargar `jsdom` a través de `isomorphic-dompurify`. El fallo afectaba tanto a las fichas como a las rutas de mutaciones: `/api/profile` devolvía HTTP 500 sin cuerpo, provocando además el error de lectura JSON mostrado por el formulario.

Se conserva DOMPurify y se fija su dependencia transitiva `jsdom` en `25.0.1` mediante un override acotado. Es la solución documentada por el mantenedor para Next.js en Vercel: [Known Issues](https://github.com/kkomelin/isomorphic-dompurify#known-issues). No se elimina la sanitización ni se amplían permisos de Supabase.

El catálogo daba por completa una búsqueda si encontraba cualquier fila reciente en PostgreSQL. Una búsqueda general quedaba así limitada a títulos ingeridos por consultas anteriores, como Metroid. Se elimina ese atajo; la caché de 24 horas de `fetchCatalogue` conserva cada consulta completa por separado y PostgreSQL sigue sirviendo como contingencia.

Los clientes de perfil y catálogo ahora muestran errores comprensibles ante respuestas vacías o HTML, preservando los mensajes JSON de validación.

## Verificación

- `npm run check`: aprobado, incluidos 13 tests unitarios y formato.
- Sanitización ejecutada con `--no-experimental-require-module`: dos tests de XSS aprobados, reproduciendo la restricción que fallaba en producción.
- Build local y build de Vercel: aprobados.
- Auditoría npm: cero vulnerabilidades conocidas en las dependencias instaladas.
- Catálogo general local: HTTP 200, 24 resultados e inclusión de otros juegos.
- Ficha `/games/metroid-ravenous`: HTTP 200 local y en Vercel Preview.
- Guardado autenticado de perfil local: HTTP 200; nombre, privacidad y avatar persistidos. Perfil público HTTP 200. Cuenta temporal eliminada al finalizar.
- `/api/profile` en Vercel Preview: HTTP 401 con JSON para una petición anónima; ya no falla al cargar las dependencias.
- `/api/catalogue` en Vercel Preview: HTTP 200.

Preview verificado: https://savestate-otu9dg6ii-ilhamelins-projects.vercel.app

Los cambios todavía requieren publicación en producción. El guardado autenticado se comprobó localmente contra Supabase real; la prueba remota del endpoint comprobó su carga y su rechazo de acceso anónimo. No se afirma una prueba de edición sobre la cuenta del usuario.
