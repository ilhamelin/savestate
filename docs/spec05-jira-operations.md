# SPEC-05 · Operación del soporte Jira

## Preparación

1. Ejecutar completa la migración `supabase/migrations/202610220040_jira_support.sql` en Supabase. Todas las tablas y funciones son exclusivas de `service_role`; ni `anon` ni `authenticated` pueden leer los reportes o incidentes directamente.
2. Configurar las cuatro URLs/proyecto de `.env.example` y `JIRA_PORTAL_TOKEN` exclusivamente en el servidor de Vercel. El token es el Bearer JWT de una **cuenta técnica del Portal**, con rol solicitante o coordinador, no un API token de Atlassian. Renovarlo antes de su caducidad o cuando el Portal responda 401. No se guarda una contraseña ni se elude la autorización del Portal.
3. Mantener `CRON_SECRET` (32 caracteres o más) configurado. El cron diario, compatible con Hobby, revisa hasta tres reportes por ejecución. El operador también puede reintentar desde Guardian. Una cola grande requiere más ejecuciones autenticadas; no se promete entrega instantánea.
4. Comprobar en el preview el estado del Portal y enviar un reporte de prueba **solo con autorización explícita**. Las pruebas automatizadas de este PR usan transportes simulados y PostgreSQL aislado, sin crear tickets en producción.

## Contrato verificado del Portal

Se revisaron `backend/app/schemas/solicitud.py`, `api/v1/solicitudes.py` y `api/deps.py` de `ilhamelin/jira-portal-solicitudes`.
El POST recibe `titulo, descripcion, tipo, area, prioridad_solicitada` y exige autenticación.
Un HTTP 201 puede significar que el Portal guardó la solicitud pero todavía no creó el issue en Jira.
La clave se obtiene de `jira_integracion.jira_issue_key`. Un UUID de solicitud **no se presenta como issue Jira**.

## Resiliencia y duplicados

Cada reporte se guarda primero en Supabase; si el almacenamiento falla, se devuelve 503 y nunca se simula aceptación.
Una RPC y una lease coordinan ejecuciones concurrentes. El intento de escritura se registra antes de llamar al Portal.
El ID local se incluye como marcador único en el título remoto.

- Error de autenticación/conexión **antes** del POST: queda en cola para reintento.
- Recepción confirmada por el Portal: se guarda su UUID y solo se consulta esa solicitud en futuras ejecuciones.
- Timeout, respuesta inválida o error 5xx **después** de iniciar el POST: queda pendiente de conciliación, sin repetir automáticamente una escritura cuyo resultado se desconoce.
- La conciliación busca el marcador en hasta 1.000 solicitudes visibles para la cuenta técnica. Si no puede confirmar la recepción, conserva el estado para revisión del operador. El Portal no ofrece una clave de idempotencia nativa, por lo que no es posible prometer entrega exactamente una vez frente a todos los fallos.
- Doble clic en escalado: una restricción única por incidente y la lease evitan tickets concurrentes duplicados.

## Privacidad y telemetría

La captura no envía cookies, localStorage, contenido de formularios ni IDs de sesión. El servidor vuelve a validar, sanitizar y redactar patrones conocidos (tokens, correo, IP y consultas de URL); un mensaje arbitrario todavía puede contener información sensible no reconocida, por lo que conviene revisarlo antes de escalar.
Guardian/Gatekeeper se excluyen de captura automática. No se envían errores a Jira sin acción explícita del operador.

El buffer autoritativo se guarda en Supabase, deduplicado durante cinco minutos y limitado atómicamente a 50 eventos para compartirlo entre instancias serverless. El dominio incluye la misma política de ring-buffer testeable en memoria.
Los tickets conservan el texto que el visitante envía voluntariamente; no añadir datos sensibles.
Los GET administrativos y las mutaciones de escalado requieren `authenticatedAdmin()`. Los POST públicos tienen origen estricto, tamaño máximo y limitación atómica por IP (hash HMAC, sin guardar IP).
No se modifica la CSP para permitir acceso al Portal desde el navegador: el transporte es servidor a servidor.

## Comprobación manual

- Footer: abrir reporte, recorrer con Tab, cerrar con Escape y volver al botón original.
- Enviar Bug, sugerencia o feature; verificar ID y distinguir en cola/Portal/Jira.
- Guardian: comprobar accesos externos, listado, buffer y escalado. Un visitante debe recibir 403 en ambos GET.
- Simular token vencido o API inaccesible: el reporte se conserva en cola.
- Revisar que una respuesta demorada no genere otro POST y que el panel muestre conciliación pendiente.

## Evidencia de aceptación de esta entrega

[GitHub Actions · verificación completa](https://github.com/ilhamelin/savestate/actions/runs/39874802470): lint sin advertencias, TypeScript, 380 pruebas sin fallos, Prettier, build de producción Next.js 16, PostgreSQL 16 aislado y Chromium con componentes reales y transporte simulado. No se crearon tickets reales en el Portal/Jira. El harness temporal se retiró del árbol final; las pruebas unitarias y de rutas permanecen en el repositorio.
