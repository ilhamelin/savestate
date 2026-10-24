# Monitor de dependencias (SPEC-11)

- `/status` muestra seis sondas instantáneas; sigue siendo público aunque Gatekeeper esté activo o Supabase no responda.
- `GET /api/system-status` conserva `switches` y `broadcast`, añade `health` y `stateAvailable`. Si falla la lectura del estado, devuelve `null` sin inventar interruptores ni modificar controles de acceso.
- `?healthOnly=1` evita consultas duplicadas de anuncios e interruptores en la pantalla de estado.
- Guardian → Uptime permite `POST /api/guardian/dependencies/probe`, con administrador verificado, origen propio y un intervalo mínimo de cinco segundos por instancia.
- La caché dura treinta segundos desde el cierre de las sondas y comparte solicitudes simultáneas. Es memoria por instancia, no un límite global distribuido.
- Steam comprueba GetServerInfo; Supabase una consulta HEAD; Discord el gateway HTTP; Jira el portal. No se prueban escrituras, permisos del bot ni creación de tickets.
- Twitch valida el token ya compartido por el catálogo, sin generar OAuth adicional ni consumir consultas IGDB. Hasta que exista ese token, figura “Sin comprobar”. La respuesta OAuth no certifica consultas IGDB.
- Vercel mide procesamiento local del runtime, sin afirmar disponibilidad de CDN, Edge u otras regiones.
- “Sin comprobar” usa el estado `maintenance` para configuración ausente o sondas no ejecutadas; no anuncia mantenimiento programado del proveedor.
- La latencia media excluye las sondas sin medir. No se calcula un porcentaje histórico de uptime a partir de una lectura efímera.
- Los avisos de importación y catálogo reutilizan el polling global; las pantallas de estado pausan su polling si están ocultas o sin conexión.
- La escalada de telemetría a Jira se pospone solo para errores explícitos de proveedor con una sonda actual en estado `down`. El incidente permanece en el buffer; los tickets manuales y los errores genéricos siguen disponibles.
- Los informes públicos no incluyen tokens, URL del proyecto Supabase, credenciales, cuerpos de respuestas ni detalles internos de excepciones.
- No requiere migraciones ni nuevas dependencias npm.

Verificación: `npm run check`, `npm run build`, sondas simuladas con reloj determinista y prueba del servidor compilado con Supabase inaccesible y Gatekeeper activo.
