# Broadcast no bloqueante y polling global

## Comportamiento

- El layout consulta los interruptores necesarios para el tema inicial y mantiene la verificación de acceso existente. La consulta del anuncio se resuelve en `SystemBroadcastStream`, bajo una frontera `Suspense` con fallback vacío.
- Un anuncio lento o una consulta fallida no retienen el resto del contenido. Si la consulta falla, el banner parte sin anuncio y puede recuperarse mediante el polling del cliente.
- El estado visual inicial de doble XP se transmite al banner. Su autorización y el cálculo de XP siguen siendo responsabilidad del servidor.
- El cliente realiza una consulta al montar y después espera 30 segundos desde la finalización de cada consulta correcta. El tráfico periódico pasa de aproximadamente seis a dos peticiones por minuto por pestaña visible, sin contar montaje, foco y reanudación.
- No hay peticiones solapadas. Las pestañas ocultas o sin conexión cancelan la consulta y su temporizador; volver a la pestaña o recuperar conexión provoca una actualización inmediata.
- Una respuesta HTTP no correcta o un error de red mantiene la última información confirmada y aplica esperas de 60 y hasta 120 segundos. Una respuesta correcta restaura los 30 segundos. Cada petición tiene un timeout de ocho segundos.
- La fecha límite de Halloween se controla con un temporizador separado: los reintentos del polling no prolongan el tema después de su fecha de cierre.
- Al desmontar el banner se cancelan solicitudes y temporizadores y se retiran los listeners. El descarte de anuncios en sessionStorage se conserva.

## Límites y seguridad

El proxy, sus controles de sesión y acceso, el TTL de diez segundos de los interruptores en servidor y las políticas RLS no cambian. El intervalo del cliente afecta a la actualización visual del anuncio, doble XP y tema; no amplía permisos ni retrasa la validación de un acceso por el servidor.

La optimización elimina la espera del broadcast del camino crítico, pero no todas las dependencias del layout: los interruptores iniciales y la sesión continúan resolviéndose en servidor. El banner puede aparecer después del contenido si el proveedor tarda.

## Verificación

Las pruebas cubren devolución del layout con el anuncio pendiente, frontera de Suspense, recuperación tras fallo del proveedor, exclusión de Guardian, peticiones sin solapamiento, pausa/reanudación, cancelación al desmontar y backoff con recuperación. GitHub Actions ejecuta lint, tipos, pruebas y formato; Vercel valida el build.

La ganancia de latencia del contenido requiere una medición autorizada: las sondas anónimas de producción siguen redirigiéndose a Gatekeeper. No se atribuye una mejora de LCP ni una reducción medida de consultas SQL a este cambio.
