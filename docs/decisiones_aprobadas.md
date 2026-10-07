# Decisiones aprobadas — 7 de octubre de 2026

Complemento autorizado por el usuario a los siete documentos originales. Los originales permanecen íntegros.

## Dominio y alcance

- Top 4: hasta cuatro juegos ordenados y fijados en la cabecera del perfil. Incluido en el MVP.
- Reacciones gamer: Critical Hit, GG y Game Over. Posteriores al núcleo de reseñas conforme a MoSCoW.
- Cuenta pública por defecto. Un switch limita la biblioteca a propietario y amigos aceptados. Seguir no concede acceso privado.
- Modelo social híbrido: seguimiento unilateral para actividad pública y amistad bidireccional mediante solicitud aceptada. Se implementan las relaciones necesarias antes de habilitar privacidad.
- Una ficha maestra de biblioteca por usuario/juego y múltiples Play Logs con plataforma, hardware/emulador, fechas, dificultad y horas.
- Nota opcional entre 1 y 10, en incrementos de 0.5. Fuente única: user_games.rating. Las reseñas referencian la ficha; no duplican la nota. Una actualización desde cualquiera de las interfaces actualiza esa misma columna.
- MVP: email/contraseña, Discord y Google. Steam se posterga a Fase 2.
- Se reutiliza la carpeta y repositorio Git existente. No se configura remoto ni se hace push.

## Resoluciones técnicas dentro del alcance

- users se materializa como profiles, vinculado a auth.users. El correo permanece en Supabase Auth y nunca en perfiles públicos.
- favorite_position nullable (1–4), con unicidad por usuario, reemplaza el booleano ambiguo is_favorite.
- Privacidad de biblioteca protege también logs, favoritos, reseñas y actividad asociada; nombre e identidad básica siguen disponibles para buscar personas y solicitar amistad.
- Las notas comunitarias se calculan exclusivamente sobre bibliotecas visibles al visitante público; nunca incluyen datos privados.
- El modo de contingencia usa catálogo previamente almacenado cuando IGDB falla; no implica una PWA ni navegación sin conexión.
- Node.js 24 para el runtime de servidor y tests TypeScript nativos; no se incorpora otro framework de testing.
- @supabase/supabase-js y @supabase/ssr son SDKs oficiales requeridos para Supabase y sesiones SSR.
- marked convierte Markdown a HTML; isomorphic-dompurify sanitiza antes de persistir y nuevamente al renderizar. HTML arbitrario, imágenes y enlaces inseguros se excluyen.
- server-only evita importar credenciales de servidor al cliente. ESLint y Prettier satisfacen lint/formatting solicitados.
- Se utilizan versiones compatibles dentro de los majors documentados y un lockfile reproducible.

## Extensión aprobada: descubrimiento (7 de octubre de 2026)

El usuario aprueba implementar las cuatro recomendaciones: orden y paginación en Explorar con filtros conservados al volver; agregado rápido a Backlog/Wishlist/Playing desde tarjetas; listas con cualquier juego del catálogo; y «Qué juego hoy», selección aleatoria del backlog con filtros de plataforma y género. Los detalles y la verificación se registran en [mejoras_descubrimiento.md](mejoras_descubrimiento.md). Se conserva el stack y no se agregan dependencias.

## Extensión aprobada: uso diario (7 de octubre de 2026)

El usuario aprueba el bloque recomendado de tres mejoras: biblioteca con búsqueda por título, filtros de plataforma/género, ordenación y vista compacta; borradores locales de reseñas recuperables y vista previa sanitizada; registro rápido de minutos en partidas existentes. Se conserva el esquema actual y no se añaden dependencias. Las sesiones acumulan el total de horas de un Play Log, sin crear un historial diario adicional. Los borradores no cambian la nota ni publican texto hasta guardar la reseña. Los detalles y verificaciones se registran en [mejoras_uso_diario.md](mejoras_uso_diario.md).

## Fuentes técnicas verificadas

- https://nextjs.org/docs/app/getting-started/installation
- https://supabase.com/docs/guides/auth/server-side/creating-a-client
- https://api-docs.igdb.com/

## Estado de verificación externa

Supabase y Twitch/IGDB están configurados; las verificaciones reales de sesión, persistencia y catálogo se registran en los documentos de verificación de `docs/`. Los accesos OAuth completos, Storage, Realtime y la latencia objetivo requieren certificación específica. Las verificaciones sin credenciales no certifican esos servicios externos.
