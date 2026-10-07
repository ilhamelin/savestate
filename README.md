# Savestate

Diario de videojuegos y catálogo social con estética pixel art/cyberpunk. Construido desde los siete documentos originales y las decisiones aprobadas en [docs/decisiones_aprobadas.md](docs/decisiones_aprobadas.md).

## Arranque

Requiere Node.js 24.

```powershell
npm ci
Copy-Item .env.example .env.local
# Completa las credenciales y aplica las migraciones según la guía.
npm run dev
```

Abre `http://localhost:3000`. La [guía de configuración](docs/configuracion.md) explica cómo crear Supabase, configurar email/Discord/Google y conectar Twitch/IGDB. Sin credenciales, la interfaz muestra el estado pendiente; no inventa juegos ni persiste datos en memoria.

## Alcance implementado

- Catálogo IGDB con búsqueda por título/estudio/saga, filtros, fichas SSR, caché de metadatos y contingencia con PostgreSQL.
- Explorar con orden, páginas de 24 juegos, filtros en la URL y agregado rápido a biblioteca sin sobrescribir entradas existentes.
- Buscador de catálogo en listas y «Qué juego hoy» para elegir al azar entre juegos del backlog por plataforma/género.
- Email/contraseña, recuperación, callbacks Discord/Google y cierre de sesiones.
- Seis estados de biblioteca, múltiples Play Logs y Top 4 ordenado.
- Una puntuación por usuario/juego, de 1 a 10 en medios puntos, compartida por biblioteca y reseña mediante una transacción.
- Markdown sanitizado, spoilers ocultos por defecto, reacciones gamer, comentarios y reportes.
- Perfiles, galería de avatares, subida WebP limitada, temas, enlaces y estadísticas de partidas.
- Seguimiento unilateral, solicitudes de amistad bidireccional y biblioteca privada para amigos aceptados.
- Feed con suscripción Realtime, listas compartibles y notificaciones internas.
- Panel de moderación para roles administrativos asignados en Supabase.

Steam, chat privado, emulación web y avatares modulares no forman parte de esta entrega.

La aplicación cuenta con despliegue en [Vercel](https://savestate-eight.vercel.app) y comprobaciones reales de IGDB, Supabase y sesión documentadas en `docs/`. Las nuevas mejoras de descubrimiento y sus verificaciones se detallan en [docs/mejoras_descubrimiento.md](docs/mejoras_descubrimiento.md). Storage, Realtime, ambos accesos OAuth completos y la latencia objetivo deben certificarse por separado; un build correcto no certifica esos flujos.

## Stack y organización

Next.js 16 App Router · React 19 · TypeScript 5 estricto · Tailwind CSS v4 · Supabase/PostgreSQL 16 · IGDB v4. Silkscreen y JetBrains Mono para tipografía; Lucide para iconos; canvas-confetti solo bajo demanda y respetando movimiento reducido.

```text
docs/                    Documentos fuente, decisiones y configuración
src/app/                 Páginas SSR, APIs y callbacks de autenticación
src/components/          Interfaz y controles accesibles
src/domain/              Tipos y reglas independientes del framework
src/services/            Casos de uso y sanitización
src/repositories/        Consultas de persistencia
src/integrations/         Supabase e IGDB
src/lib/                 Configuración, sesiones, errores y tipos SQL
supabase/migrations/     Esquema, RLS, funciones y hardening
tests/unit/              Reglas críticas y sanitización
tests/integration/       Asunciones HTTP y pruebas SQL de privacidad
public/avatars/          Galería pixel art en SVG
```

La documentación original numerada y el compilado permanecen en la raíz. Las siete copias canónicas están en `docs/`; el README documental original se conserva en `docs/indice_original.md`.

## Comandos

| Comando                    | Propósito                                             |
| -------------------------- | ----------------------------------------------------- |
| `npm run dev`              | Desarrollo local                                      |
| `npm run build`            | Compilación de producción                             |
| `npm run start`            | Servidor de producción local                          |
| `npm run lint`             | Reglas TypeScript, React Hooks y accesibilidad        |
| `npm run typecheck`        | TypeScript estricto                                   |
| `npm test`                 | Tests unitarios con Node                              |
| `npm run test:integration` | Tests HTTP/SQL cuando sus entornos están configurados |
| `npm run format`           | Formatear código sin alterar documentación fuente     |
| `npm run check`            | Lint, tipos, tests y comprobación de formato          |

## Seguridad y límites actuales

- Las tablas aplican RLS. Seguir no otorga acceso privado; solo una amistad aceptada lo permite.
- El correo vive en Supabase Auth, fuera de perfiles públicos.
- Claves de servicio y Twitch exclusivamente en servidor. `.env.local` está ignorado.
- Mutaciones JSON exigen mismo origen y sesión verificada. Las respuestas personales no usan caché compartida.
- Markdown se sanitiza al guardar y al renderizar; CSP usa nonce por solicitud.
- La puntuación única y Top 4 se protegen también en PostgreSQL.
- Una biblioteca muestra hasta 500 registros recientes más sus favoritos; las estadísticas indican ese alcance. Las fichas muestran hasta 50 reseñas dentro de 200 fichas de biblioteca visibles y 300 comentarios. Las listas y señales tienen límites explícitos de consulta para la entrega inicial.

Consulta [docs/estado_implementacion.md](docs/estado_implementacion.md) para resultados de verificación y pendientes. No hay remoto configurado y no se hizo push.
