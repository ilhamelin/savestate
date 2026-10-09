# Sincronización automática de consolas

## Actualización: Xbox y emparejamiento masivo (9 de octubre de 2026)

La especificación actualizada se conserva en `docs/propuesta_sincronizacion_consolas_automatica.md`. Esta actualización reemplaza los detalles del endpoint, formatos Xbox y limitaciones de credenciales documentados en la verificación inicial más abajo.

- OpenXBL: `friends/search?gt=...`, cabecera `Accept-Language: en-US` y títulos en `content.titles` o `titles`.
- Identidad exacta desde `people`, `content.profileUsers` o `profileUsers`, con Gamertag en `settings` e ID numérico. No se selecciona otra cuenta por aproximación.
- Los títulos Xbox con dispositivos exclusivamente `PC` se conservan con plataforma compatible `Xbox One`, conforme a la decisión de producto. El usuario puede corregir la plataforma antes de importar; esta asignación no acredita hardware físico.
- Emparejamiento secuencial de filas seleccionadas sin juego asignado y sin importar. Prefiere título exacto normalizado; si falta, propone el primer resultado. Conserva elecciones existentes, permite revisar otras ediciones y exige el botón de importación para persistir la biblioteca.
- Progreso accesible y cancelación con `AbortController`: no inicia nuevas consultas ni asigna resultados después de cancelar. Conserva las coincidencias terminadas para reanudar. Los errores individuales no interrumpen las demás filas.
- Consulta real local de `ilhamelin`: búsqueda HTTP 200, identidad exacta y títulos HTTP 200; 200 filas normalizadas. No se imprimieron claves ni respuestas personales.
- `npm run check`: salida 0, 53 pruebas unitarias, lint, TypeScript y Prettier. `npm run build`: salida 0. Pruebas del emparejamiento: coincidencia exacta, primera opción, lista vacía, error por fila y cancelación.
- Prueba del endpoint con Supabase real y transportes simulados: pasó en 7.95 segundos, incluyendo el nuevo endpoint, locale obligatorio, respuestas anidadas y títulos PC. Sesión, privacidad y ausencia de importación sin confirmación siguen correctas; cuenta temporal eliminada.

Los apartados siguientes conservan la evidencia de la entrega inicial y sus limitaciones en ese momento.

Referencia conservada: `docs/propuesta_sincronizacion_consolas_automatica.md`. Se completó la implementación inicial del commit `3f70350`, manteniendo `psn-api` 2.18.1 y la RPC de la migración 016. No requiere nuevas migraciones.

## Flujo

En `/library/import`, PSN y Xbox ofrecen sincronización por identificador con botón y Enter. Los valores vacíos o inválidos se rechazan en cliente antes de consultar la API. El servidor autentica, valida y comprueba el guardado del identificador en el perfil antes de consultar el proveedor. El ID es público y no constituye verificación de propiedad. Los juegos solo entran a la biblioteca después de confirmar las coincidencias del catálogo.

La importación manual se conserva en un acordeón cerrado inicialmente. El botón de guardar identificador permite también borrarlo. PSN consulta hasta dos páginas de 100 títulos; Xbox normaliza hasta 200 títulos de la respuesta. Plataformas desconocidas y juegos exclusivamente de PC no se atribuyen artificialmente a una consola. Duplicados y títulos ocultos se excluyen. Las horas quedan en cero porque estas respuestas de trofeos/logros no ofrecen tiempo jugado. Platino o progreso 100% en PSN, y puntuación completa con total positivo en Xbox, sugieren `cleared`; el resto sugiere `playing`.

## Integraciones y configuración

- `PSN_NPSSO`: secreto de servidor para `psn-api`. Autenticación con NPSSO, resolución exacta de Online ID y lectura de títulos. Una búsqueda aproximada no selecciona automáticamente otra cuenta.
- `XBL_API_KEY`: secreto de servidor de OpenXBL. Host fijo `https://api.xbl.io/v2`, búsqueda `friends/search/{gamertag}` y títulos `achievements/player/{xuid}`. Gamertags modernos con sufijo requieren coincidencia exacta; el XUID se valida como texto numérico.
- `.env.example` incluye ambas variables; no deben utilizar prefijo `NEXT_PUBLIC_` ni pegarse en el chat.
- Credencial ausente/expirada o límite upstream: 503; perfil no encontrado o inaccesible: 404; fallo de transporte/formato: 502. No se devuelve texto crudo del proveedor ni se imprimen credenciales.
- Xbox usa `no-store`, redirecciones bloqueadas y `AbortSignal.timeout(10000)`. El SDK PSN no expone señal de cancelación; el flujo tiene un plazo total de respuesta de 20 segundos, aunque el SDK puede continuar una petición iniciada tras vencer ese plazo.

Fuentes primarias: [PSN user trophies](https://psn-api.achievements.app/api-docs/user-trophies), [OpenXBL](https://xbl.io/), [OpenXBL OpenAPI](https://github.com/OpenXBL/Docs/blob/main/openapi.yaml), [OpenXBL account search](https://github.com/OpenXBL/Docs/blob/main/account.json). La integración corrige la URL y el formato de búsqueda de la propuesta inicial.

## Verificación

- `npm run check`: ESLint, tipado estricto, 51 pruebas unitarias y formato.
- `npm run build`: empaquetado completo de Next.js 16.4.0.
- Credencial PSN local real: intercambio de autenticación correcto y consulta mínima del propio contexto de servicio con respuesta válida de títulos. No se guardaron ni mostraron títulos o tokens personales.
- Prueba integral con Supabase real y transportes PSN/OpenXBL simulados: pasó en 5.68 segundos. Verificó sesión, ID vacío, coincidencia exacta, previsualización, perfiles privados, error 502 sin filtrar secretos, guardado de IDs y ausencia de importación sin confirmación. Utiliza el SDK PSN real sobre HTTP simulado.
- Navegador sobre build local: ID vacío, Enter en ambas consolas, estados/plataformas de previsualización y acordeón cerrado. Sin errores en consola; a 375 px, documento de 360 px sin desbordamiento. Evidencia: `docs/evidence/console-automatic-sync.jpg`.
- Servidor, cuentas y archivos temporales de prueba eliminados. Los mocks solo se activan con un preload explícito y no forman parte del inicio normal.
- Inventario de variables de producción: `PSN_NPSSO` presente; `XBL_API_KEY` ausente al verificar. Xbox queda disponible mediante importación manual hasta configurar su clave. No se pudo comprobar una consulta Xbox real.

Para repetir la prueba integral, iniciar el build local con:

```powershell
$env:TEST_CONSOLE_SYNC_MOCK='1'
$env:NODE_OPTIONS='--import=./tests/integration/console-sync-upstream.mock.mjs'
npm run start
```

Y en otra terminal:

```powershell
$env:TEST_CONSOLE_SYNC_LIVE='1'
$env:TEST_CONSOLE_SYNC_MOCK='1'
$env:TEST_APP_URL='http://localhost:3000'
node --env-file=.env.local --experimental-strip-types --test tests/integration/console-sync.test.ts
```

## Publicación

Publicado con `npx vercel --prod` desde el commit `f6d6c93`. Vercel confirmó `READY` para `dpl_9r9vdoxCWLBnGLycS9BLgVDekys6`, con build remoto correcto en 17 segundos.

- Dominio: <https://savestate-eight.vercel.app>.
- Despliegue: <https://savestate-ffzufnum8-ilhamelins-projects.vercel.app>.
- Comprobación pública: HTTP 200 y CSP con nonce; sincronización sin sesión rechazada con 401.
- Sesión temporal real en producción: ID vacío rechazado con 400; Xbox respondió 503 con el mensaje explícito de `XBL_API_KEY` pendiente. La cuenta temporal se eliminó.

No se da por verificada una sincronización Xbox real hasta configurar su credencial. PSN se verificó con la credencial local real; los casos de privacidad y coincidencias se probaron con transportes simulados.
