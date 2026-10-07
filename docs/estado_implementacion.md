# Estado de implementación

## Entrega local

| Hito | Implementación | Validación externa en producción |
|---|---|---|
| 0 — Fundaciones | Stack, configuración, tokens, tipografías, HUD, CRT y movimiento reducido | Verificado en Vercel; contrastes y conmutador CRT operativos |
| 1 — Catálogo | Proxy IGDB, caché 24h, ingesta perezosa, filtros, ficha SSR y estadísticas públicas | Credenciales Twitch configuradas; latencia en caché ~829 ms (< 1.5 s, RNF-02 cumplido) |
| 2 — Cuentas y biblioteca | Email/Discord/Google, recuperación, seis estados, Play Logs y RLS | Supabase Auth en vivo; flujos OAuth verificados con Discord y Google |
| 3 — Reseñas | Nota única atómica, Markdown, spoilers, reacciones, comentarios y reportes | Flujo de mutaciones con usuarios autenticados reales verificado |
| 4 — Perfiles | Top 4, temas, enlaces, galería y subida WebP, estadísticas por horas/año | Bucket `profiles` y políticas de Storage verificadas |
| 5 — Social | Seguimiento, amistad, feed Realtime, listas y notificaciones | Publicación `supabase_realtime` y WebSockets operativos |
| 6 — Lanzamiento | Validaciones, cabeceras seguras, pruebas unitarias e integración en la nube | Despliegue en producción certificado en [`https://savestate-eight.vercel.app`](https://savestate-eight.vercel.app) |

Las decisiones posteriores del usuario prevalecen sobre los originales. Top 4 pertenece al MVP aunque el roadmap original lo sitúe en Hito 4. Las relaciones sociales se implementaron para hacer operativa la privacidad para amigos; no se sustituyeron por privacidad exclusiva del propietario.

## Dependencias adicionales justificadas

Los SDK oficiales `@supabase/supabase-js` y `@supabase/ssr` materializan el backend documentado. `marked` procesa el Markdown requerido; `isomorphic-dompurify` sanitiza el HTML resultante. `server-only` protege fronteras de credenciales. Las dependencias de ESLint/TypeScript/React Hooks/accesibilidad y Prettier implementan los controles de calidad solicitados. No se añadieron ORM, un segundo backend, otra biblioteca UI ni un framework de testing.

El preset `eslint-config-next` se reemplazó por reglas directas de ESLint porque su árbol transitivo contenía vulnerabilidades sin parche compatible. La auditoría debe registrarse con las versiones efectivas del lockfile, no con una promesa de ausencia de vulnerabilidades futuras.

## Resultados locales — 7 de octubre de 2026

- `npm run check`: lint de TypeScript/React/accesibilidad, tipos estrictos, 11 tests unitarios y formato aprobados.
- `npm run build`: compilación de producción aprobada.
- Tres migraciones ejecutadas con éxito en el PostgreSQL temporal; aserciones SQL de privacidad, amistad/revocación, propiedad, nota atómica, medios puntos, Top 4, Play Logs y archivos de perfil acotados aprobadas.
- `npm audit`: cero vulnerabilidades conocidas en las versiones instaladas, incluyendo herramientas de desarrollo.
- Tres tests HTTP aprobados contra el servidor local sin credenciales; la prueba de Supabase local se omite explícitamente al faltar `TEST_DATABASE_URL`.
- Navegador: portada y catálogo revisados en móvil y escritorio; conmutador CRT operativo; consola sin errores en los recorridos comprobados.
- Los siete documentos originales y sus copias canónicas conservan hashes idénticos.

## Verificación externa y despliegue completado — 7 de octubre de 2026

La aplicación completó su transición desde el entorno local aislado hacia el entorno de producción real, certificado formalmente en [docs/certificacion_lanzamiento.md](certificacion_lanzamiento.md):

1. **Despliegue en Producción:** Alojado en **Vercel** ([`https://savestate-eight.vercel.app`](https://savestate-eight.vercel.app)) bajo HTTPS administrado, CSP dinámica con `nonce` inyectada por `src/proxy.ts`, y `Cache-Control: private, no-store`.
2. **Supabase Administrado:** Proyecto PostgreSQL 16 con las tres migraciones aplicadas, 14 tablas con RLS, bucket `profiles` con aislamiento de avatares WebP, y autenticación OAuth en vivo con Discord y Google.
3. **Catálogo IGDB Real:** Conexión M2M directa con credenciales Twitch, ingesta perezosa persistida en base de datos y latencia medida en producción de ~829 ms en caché caliente, certificando el cumplimiento de **RNF-02**.
4. **Repositorio:** Gestionado mediante Vercel CLI preservando la estructura del repositorio sin requerir push ni configuración de remoto público.
