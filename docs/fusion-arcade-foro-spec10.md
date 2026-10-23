# Hub comunitario: Foro + Arcade (SPEC-10)

La entrada social es `/forum`. Por defecto muestra Debates; `/forum?tab=arcade` muestra el duelo comunitario y el tablero LFG existente. Un valor desconocido o un arreglo en `tab` vuelve a Debates.

## Carga y rutas

- Arcade consulta duelo, convocatorias (página 1) y usuario concurrentemente. No solicita el directorio de hilos.
- Debates consulta directorio, usuario y duelo concurrentemente. No solicita convocatorias.
- El teaser utiliza los títulos de `DuelSummary.games`, asociados a los IDs del duelo. Si falta un juego usa el título del duelo.
- Sin configuración no se consultan servicios de datos; siguen disponibles el selector y el aviso de configuración.
- `/arcade` y `/parties` redirigen directamente con 308 a `/forum?tab=arcade`. `next.config.ts` aplica el destino antes del renderizado (también se conservan los `permanentRedirect` de las páginas). Así se evita la regla anterior hacia `/chat` y la respuesta 200 con meta-redirección de un render en streaming. [Referencia de Next.js](https://nextjs.org/docs/app/api-reference/config/next-config-js/redirects).
- Navbar conserva 12 enlaces y activa Foro para ambas pestañas. El comando rápido y el retorno de login para publicar/votar apuntan al hub.
- Las búsquedas, canales, ordenación y creación de hilos mantienen sus rutas de Debates. El pulso del teaser respeta movimiento reducido.

Se conservan API, RLS, vencimiento de 48 h, publicación, retirada y votación. No requiere migraciones ni dependencias nuevas.

## Verificación

`tests/unit/arcade-parties-api.test.ts` conserva la cobertura de autorización y valida los nuevos destinos y navbar. `tests/unit/forum-hub.test.ts` renderiza el Server Component con adaptadores aislados para comprobar selección estricta de pestaña, consultas condicionales/concurrentes, filtros de Debates y estados vacíos.

Completar `npm run check`, build y aceptación de navegación móvil antes de fusionar. Las pruebas aisladas no certifican una instancia Supabase en vivo.
