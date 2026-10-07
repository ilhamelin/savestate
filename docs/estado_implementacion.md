# Estado de implementación

## Entrega local

| Hito | Implementación | Validación externa pendiente |
|---|---|---|
| 0 — Fundaciones | Stack, configuración, tokens, tipografías, HUD, CRT y movimiento reducido | Auditoría completa WCAG AA |
| 1 — Catálogo | Proxy IGDB, caché 24h, ingesta perezosa, filtros, ficha SSR y estadísticas públicas | Credenciales Twitch; latencia real menor a 1.5 s |
| 2 — Cuentas y biblioteca | Email/Discord/Google, recuperación, seis estados, Play Logs y RLS | Supabase Auth y proveedores reales |
| 3 — Reseñas | Nota única atómica, Markdown, spoilers, reacciones, comentarios y reportes | Flujo con usuarios autenticados reales |
| 4 — Perfiles | Top 4, temas, enlaces, galería y subida WebP, estadísticas por horas/año | Storage y políticas del servicio real |
| 5 — Social | Seguimiento, amistad, feed Realtime, listas y notificaciones | WebSockets y dos cuentas Supabase |
| 6 — Lanzamiento | Validaciones, cabeceras seguras, pruebas unitarias e integración SQL local | Lighthouse >90 sobre todos los flujos, carga y despliegue |

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

## Límites de verificación externa

La prueba SQL aislada utiliza un PostgreSQL temporal y funciones mínimas que representan identidad/Storage de Supabase. Comprueba ejecución de migraciones, restricciones y RLS, pero no la infraestructura Supabase, firmas JWT, entregabilidad de correo, OAuth o Realtime. La suite para Supabase local con `psql` está preparada y se omite cuando falta `TEST_DATABASE_URL`.

La suite HTTP sin credenciales comprueba respuestas del servidor, validación de filtros, bloqueo de otro origen, ausencia de acceso anónimo a mutaciones, CSP y caché. No sustituye la prueba autenticada contra servicios reales.

Las mediciones de búsqueda contra IGDB deben distinguir caché caliente e ingesta inicial: una API externa puede exceder la meta de 1.5 s. Los timeouts y la contingencia limitan la espera, pero aún no se certifica RNF-02.

No se desplegó la aplicación, no se configuró GitHub y no se realizó push.
