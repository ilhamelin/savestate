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

## Fuentes técnicas verificadas

- https://nextjs.org/docs/app/getting-started/installation
- https://supabase.com/docs/guides/auth/server-side/creating-a-client
- https://api-docs.igdb.com/

## Verificación externa pendiente de configuración

Para comprobar OAuth, persistencia real, RLS y datos IGDB se necesita un proyecto Supabase configurado y credenciales Twitch. Las verificaciones sin credenciales no certifican esos servicios externos.
