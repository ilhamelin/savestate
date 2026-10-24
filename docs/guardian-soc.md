# Guardian SOC y Threat Shield (SPEC-12)

El panel privado `/guardian` → **SOC Shield** permite gestionar DEFCON, cuarentenas y los últimos 20 eventos. Todas las operaciones exigen `authenticatedAdmin()`; las mutaciones requieren origen válido, motivo y, en niveles 3–1, confirmación explícita. La identidad del operador procede de la sesión, nunca del body ni de un username editable.

## Instalación y política

Aplicar completa `supabase/migrations/202610240041_guardian_soc.sql` en Supabase. Es idempotente, inicia DEFCON 5 sin cambiar interruptores existentes y limita los RPC de control a `service_role`. Las pruebas SQL usan una base PostgreSQL desechable; nunca se deben ejecutar las fixtures en Supabase.

| DEFCON | Política |
| --- | --- |
| 5 | Operación normal; cuarentena tras cinco credenciales/TOTP incorrectos en 60 segundos. |
| 4 | Además, máximo cinco solicitudes de autenticación por minuto y origen. |
| 3 | Registros cerrados; mutaciones web requieren cuenta verificada. |
| 2 | Solo lectura: se rechazan mutaciones y cron, nuevas autorizaciones de subida y DML directo de usuarios en tablas públicas protegidas. |
| 1 | Mantiene solo lectura y exige operador autenticado y pase TOTP ligado a su UUID, emitido después de activar esta política. |

El RPC de DEFCON modifica política, interruptores y auditoría en una transacción. Guarda los valores previos y los restaura al desescalar; no abre registros que ya estuvieran cerrados. La API genérica de switches no puede saltarse estas restricciones. La disponibilidad de la semilla TOTP se comprueba antes de activar DEFCON 1. No se añade FIDO2 ni se afirma que exista autenticación biométrica.

## Persistencia y límites reales

Los intentos y las cuarentenas se persisten con bloqueo por IP en PostgreSQL: cinco fallos distribuidos entre funciones también aíslan el origen por 15 minutos. Los rechazos repetidos no extienden ese plazo. Los eventos de control son append-only; UPDATE y DELETE se rechazan. Las IPs, motivos y actores solo se exponen mediante APIs administrativas.

Cada instancia mantiene un índice local y una instantánea con TTL de **3 segundos**. Un rechazo ya conocido devuelve 429 antes de consultar sesión o base de datos; el Proxy puede refrescar en segundo plano para descubrir levantamientos. Las instancias frías consultan la política compartida con deadline de 3 segundos y fallan cerradas si no pueden verificarla. La propagación requiere otra solicitud después de vencer el TTL; no hay temporizador global ni garantía de latencia global menor a 5 ms. No es una regla nativa de Vercel WAF.

Solo se acepta la IP proporcionada por `x-vercel-forwarded-for` dentro de Vercel; no se confía en `x-forwarded-for`, cuerpos de petición ni cabeceras de despliegues externos. Fuera de Vercel no se inventa una IP compartida. En producción las rutas de autenticación rechazan solicitudes sin origen confiable.

El contador diario representa **cuarentenas automáticas iniciadas en UTC**, no todo el tráfico bloqueado por Vercel. La latencia mostrada mide decisiones del caché local de esa instancia; puede indicar «Sin muestras». No se simulan métricas WAF.

## Autenticación y recuperación

El formulario de contraseña usa `POST /api/auth/password`. Solo `invalid_credentials` y códigos TOTP incorrectos incrementan el contador: caídas del proveedor, falta de configuración y solicitudes de otro origen no penalizan a usuarios. El endpoint directo de Supabase Auth conserva sus propias protecciones y no pasa por este Proxy. Los inicios OAuth se mantienen en Supabase; el trigger de registros aplica DEFCON también allí.

Guardian y sus APIs conservan autorización propia y permanecen accesibles para recuperación aun desde una IP en cuarentena. Login, callback y verificación TOTP permiten recuperar una sesión, pero la cuarentena sigue aplicándose a contraseña/TOTP. `/status` y `/api/system-status` permanecen públicos y no revelan IPs ni auditoría. Si se pierde la sesión del operador y su IP está aislada, otro dispositivo autorizado o el SQL Editor administrativo debe levantar la cuarentena; no existe bypass público.

Las URLs R2 de subida emitidas antes de DEFCON 2 siguen siendo utilizables hasta su expiración original (hasta cinco minutos). El cambio bloquea nuevas autorizaciones y confirmaciones, no revoca firmas ya entregadas.

## Verificación

`tests/unit/threat-shield.test.ts` ejecuta dominio, servicio real con reloj/almacén inyectados, rutas reales y Proxy con límites externos simulados. `tests/integration/guardian-soc.sql` verifica RPC, expiración, auditoría inmutable, restauración de interruptores, rechazo DML y permisos SQL. Se ejecuta sobre PostgreSQL 16 desechable después de aplicar la migración dos veces. Ninguna prueba escala DEFCON en producción.

La procedencia de la cabecera se basa en la [documentación oficial de cabeceras de Vercel](https://vercel.com/docs/headers/request-headers#x-vercel-forwarded-for).
