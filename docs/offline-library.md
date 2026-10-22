# Biblioteca PWA de solo lectura

Primera entrega: guardado voluntario desde la biblioteca propia, búsqueda y filtros sin red. No hay cola de mutaciones ni sincronización automática de cambios.

## Datos y límites
- IndexedDB contiene únicamente títulos, estados, nota numérica, horas, sesiones y plataformas resumidas.
- No almacena notas privadas, reseñas, credenciales, imágenes ni HTML autenticado.
- Se conservan hasta los 504 registros disponibles en la consulta actual; el contador informa de copias parciales.
- Una copia vence a las 12 horas. Solo debe activarse en dispositivos de confianza. El usuario puede borrarla manualmente.
- El navegador puede desalojar o restringir el almacenamiento. En ese caso la interfaz falla de forma cerrada.
- Esta copia no es un respaldo permanente.

## Sesión y protección
El cliente Supabase central instala una envoltura de signOut que invalida el acceso inmediatamente y espera el borrado de IndexedDB antes de llamar al SDK. El cambio de cuenta borra datos y cambia su generación en una sola transacción. Los guardados con generaciones antiguas se rechazan. storage/BroadcastChannel invalidan otras pestañas; pagehide borra la vista y pageshow vuelve a comprobar el acceso.

El visor online verifica la sesión por /api/library/offline-access, que conserva el proxy de Guardian y la moderación. Un 401/403 invalida la copia; otros errores HTTP no habilitan un fallback. Desconectado no se puede consultar una revocación remota: la copia sigue accesible hasta su vencimiento local. El almacenamiento del navegador no sustituye al cifrado del dispositivo y el reloj local no es una barrera de seguridad frente al dueño del dispositivo.

## Service worker
/library-sw.js usa scope / y solo ofrece el visor público si una navegación a / o /library falla por transporte. Nunca cachea respuestas SSR/RSC, API, autenticación o errores HTTP. El worker de Guardian mantiene su scope /guardian y sus propios caches; no se borra ni modifica.

Los únicos recursos exentos de autenticación son cinco archivos estáticos explícitos: el worker, HTML público, CSS y dos módulos JS. Ninguno incorpora datos de usuarios.

## Verificación remota
CI ejecuta los controles habituales y pruebas de parser, transacciones, carreras de sesión y service worker. Un job Chromium separado verifica navegación/reload sin red, búsqueda, texto seguro, invalidación entre pestañas, cambio de cuenta y rechazo online. No requiere secretos ni APIs externas.
