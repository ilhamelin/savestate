# Mejoras de uso diario

Implementadas el 7 de octubre de 2026 a petición del usuario, en `implementation/chatgpt`.

## Biblioteca

La biblioteca propia y las bibliotecas visibles de jugadores permiten buscar títulos sin distinguir mayúsculas ni acentos, combinar estado/plataforma de catálogo/género, y ordenar por última actualización del registro de biblioteca, título, puntuación o suma de horas de sus partidas. Las notas ausentes quedan al final al ordenar por puntuación. Los empates tienen orden estable.

La vista compacta muestra estado, título, nota y total de horas; las partidas y acciones siguen accesibles desplegando cada juego. Los filtros se aplican a los registros ya cargados. Se conserva el límite existente de los 500 juegos recientes y favoritos, con el aviso de la página y contador de juegos cargados. No se presenta como búsqueda global del catálogo ni se cambia la privacidad.

## Borradores y vista previa

Las modificaciones de texto, puntuación y spoilers se guardan en `localStorage` al editar, bajo una clave por usuario y juego. Al volver, se ofrece recuperar explícitamente el borrador; la versión publicada permanece como referencia y se avisa si cambió desde el borrador. Es posible descartarlo, y se elimina tras publicar correctamente. La persistencia es propia de ese navegador: no sincroniza entre dispositivos. Si el almacenamiento está bloqueado o lleno se informa y el editor sigue operativo.

La nota se mantiene sin cambios en PostgreSQL hasta publicar. La vista previa utiliza la operación autenticada `preview_review` del API existente y el mismo procesamiento/sanitización Markdown que las reseñas publicadas. No guarda datos ni crea actividad. El cliente descarta respuestas de vistas previas antiguas si cambia el texto. No se incorpora DOMPurify/jsdom al bundle del editor ni se añade dependencia nueva.

## Sesiones rápidas

En cada juego propio se puede elegir una partida existente e introducir entre 1 y 1440 minutos enteros. Se acumulan sus horas, redondeando a dos decimales según `numeric(8,2)`, hasta el límite de 100000 horas. Se conservan fechas, notas, plataforma y método; no se crea un historial separado de sesiones ni se marca el juego completado automáticamente.

El servidor comprueba autenticación y propiedad, además de RLS. La actualización compara el total previamente leído antes de escribir; si otro guardado cambió las horas vuelve a leer, hasta tres intentos. Así las sesiones concurrentes no sobrescriben un total obsoleto. Un conflicto persistente devuelve 409. El formulario deshabilita el envío mientras está pendiente y vacía los minutos tras el éxito. Si se pierde la respuesta de red, se deben revisar las horas antes de reenviar: no se promete idempotencia de reenvíos manuales.

## Hardening adicional

Los formularios compartidos declaran `method="post"`. Antes de la hidratación, o si JavaScript falla, evitan el GET nativo que podía poner campos privados en la URL. El envío normal sigue pasando por los handlers existentes; no se habilitan mutaciones sin JavaScript.

## Verificación

- `npm run check`: lint, tipos estrictos, 22 pruebas unitarias y formato.
- `npm run build`: aprobado con Next.js 16.4.0.
- Integración real opt-in: `TEST_LIBRARY_UX_LIVE=1`, `TEST_APP_URL=http://localhost:3007`, `node --env-file=.env.local --experimental-strip-types --test tests/integration/library-ux.test.ts`. Aprobada contra el build de producción local, con dos usuarios propios temporales eliminados al terminar.
- Dos sesiones simultáneas de 30 y 60 minutos sobre una partida de 1 h dieron 2.5 h; otra cuenta recibió 404 y anónimos 401; límites inválidos recibieron 400. Notas y fechas se conservaron. Vista previa sanitizada sin crear reseñas ni cambiar nota. SSR del acceso declara POST.
- Navegador con una cuenta privada desechable: filtros combinados, orden por nota, vista compacta y despliegue de acciones; una sesión de 90 minutos llevó 20 h a 21.5 h en UI y PostgreSQL; borrador recuperado tras recarga con nota/spoilers; vista previa con negritas y lista, sin script; publicación sincronizó la nota a 9 y eliminó el borrador. Consola sin errores/advertencias en ese recorrido. No se modificaron bibliotecas o reseñas de usuarios reales.
- Evidencias: `docs/evidence/biblioteca-filtros.png`, `docs/evidence/sesion-rapida.png`, `docs/evidence/resena-vista-previa.png`.

No hay migraciones, dependencias ni variables de entorno nuevas. La publicación se registra tras comprobar el despliegue.
