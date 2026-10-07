# Buscador global y audio retro

Implementación en `implementation/chatgpt`, basada en la propuesta de investigación del commit `5b30c1c`.

## Buscador

`CommandMenu` sustituye `HeaderSearch`; Ctrl/Cmd + K abre una única paleta también desde Explorar. El botón del HUD abre el mismo modal. Radix administra el foco dentro del diálogo y Escape lo cierra; el foco vuelve al botón del HUD.

La búsqueda comienza con tres caracteres, espera 450 ms y usa el parámetro existente `q` de `/api/catalogue`. Cancela peticiones al cambiar de consulta o cerrar y presenta hasta ocho juegos con año/plataforma, además de acceso a todos los resultados en Explorar. La navegación incluye biblioteca, listas, transmisión y perfil propio. Los comandos permiten conmutar CRT, audio y cerrar la sesión local con manejo de errores.

Se incorpora `cmdk` 1.1.1. La propuesta original permanece conservada; su afirmación de cero dependencias transitivas no corresponde al paquete instalado: incorpora componentes de Radix. No se ha certificado la cifra estimada de bundle de la propuesta.

## Audio y accesibilidad

`src/lib/sound.ts` sintetiza tonos con Web Audio sin npm adicional ni archivos MP3. Se silencia por defecto y solo se activa expresamente desde HUD, paleta o Ajustes. La preferencia `savestate_audio` se sincroniza entre controles y se conserva en el navegador. Si el almacenamiento o Web Audio fallan, las acciones siguen funcionando.

El contexto se desbloquea durante una interacción, antes de las peticiones. Critical Hit suena después de guardar una reacción nueva; Cleared/Platinum después de guardar un cambio de estado. No celebra eliminación de reacciones ni repetición del mismo estado. Los errores de formularios emiten un tono opcional. Silenciar detiene tonos pendientes, y los nodos se desconectan al terminar. No hay autoplay al cargar páginas. El sintetizador prioriza legibilidad, limpieza y control del silenciado; no se impone un límite de 1 KB al código fuente TypeScript sin minificar.

## Verificación

- `npm run check`: lint, TypeScript estricto, 19 tests y formato.
- Test de audio: sin contexto antes de consentimiento, programación de tonos, detención al silenciar y almacenamiento bloqueado.
- Navegador local: Ctrl+K, búsqueda real de Chrono Trigger, navegación con flecha/Enter a una ficha, conmutador sincronizado y Escape con restauración de foco. No se modificaron biblioteca ni reseñas de usuarios durante estas verificaciones. No se realizó una evaluación auditiva del volumen.
- Evidencia: `docs/evidence/buscador-global.png`.

## Publicación

Publicado con `npx vercel --prod --yes` desde el commit `8fff68b`, incluyendo la implementación registrada en `a2b1b26`. Despliegue `dpl_GHugL1naUXeyqBUVG4V4bEsECPzC`, estado READY, alias https://savestate-eight.vercel.app.

Build local y remoto aprobados. Producción devuelve HTTP 200 y CSP con nonce; búsqueda Chrono Trigger devuelve 15 títulos, origen IGDB, sin contingencia. En el navegador de producción Ctrl+K abre el modal y la búsqueda presenta sus primeros ocho títulos. Consola sin errores/advertencias y consulta de logs de errores sin entradas durante la ventana de verificación. Evidencia: `docs/evidence/buscador-produccion.png`.
