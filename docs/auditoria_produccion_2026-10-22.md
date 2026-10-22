# Auditoría inicial de producción — SaveState

Fecha: 22 de octubre de 2026, 01:19 de Chile (04:19 UTC).

## Alcance y evidencia

- PR de contribución remota [#1](https://github.com/ilhamelin/savestate/pull/1) fusionado en `implementation/chatgpt` como `0f03d9eb29515c572a683a2801b38bc4c73fb43e`.
- GitHub Actions del commit fusionado: [CI Runner correcto](https://github.com/ilhamelin/savestate/actions/runs/39721482049).
- Vercel informó estado `success` para ese commit: [despliegue asociado](https://vercel.com/ilhamelins-projects/savestate/Cq3V2Q13JYb57c5FHLefgKKmPztb).
- [Auditoría HTTP ejecutada en GitHub Actions](https://github.com/ilhamelin/savestate/actions/runs/39721725271): 20 GET anónimos, secuenciales y sin cookies, dos por ruta, hacia `https://savestate-eight.vercel.app`.
- El artifact `production-http-audit` conserva los resultados JSON durante siete días; el resumen y los logs del job contienen las mediciones.
- La revisión de código usa el commit fusionado. La identidad exacta del despliegue detrás del alias durante la medición no se pudo consultar mediante el conector; no se debe confundir un status GitHub correcto con una inspección completa de Vercel.

## Mediciones iniciales

Los valores son tiempo hasta recibir cabeceras en milisegundos, muestras 1 y 2. Incluyen red, DNS/TLS y tiempo del servidor; no equivalen a Core Web Vitals ni permiten calcular percentiles o atribuir un arranque en frío.

| Ruta | HTTP, muestras 1 / 2 | Cabeceras ms, muestras 1 / 2 | Destino |
| --- | --- | --- | --- |
| `/` | 307 / 307 | 2081.9 / 228.7 | `/gatekeeper` |
| `/explore` | 307 / 307 | 158.6 / 72.3 | `/gatekeeper` |
| `/screen` | 307 / 307 | 80.7 / 73.9 | `/gatekeeper` |
| `/hoyo` | 307 / 307 | 199.9 / 67.2 | `/gatekeeper` |
| `/worlds` | 307 / 307 | 70.2 / 74 | `/gatekeeper` |
| `/gatekeeper` | 200 / 200 | 1068.3 / 125 | Sin redirección |
| `/robots.txt` | 200 / 200 | 130.5 / 42.6 | Sin redirección |
| `/sitemap.xml` | 200 / 200 | 186.3 / 67.9 | Sin redirección |
| `/api/system-status` | 401 / 401 | 63.6 / 66.8 | Sin redirección |
| `/api/guardian/telemetry` | 403 / 403 | 962.8 / 123.3 | Sin redirección |

Resultados confirmados:

- Cero respuestas 5xx y cero timeouts en estas 20 solicitudes. Esto no demuestra ausencia de errores históricos.
- Las cinco páginas de contenido redirigen a Gatekeeper. Sus tiempos no describen el SSR de esas páginas ni el rendimiento después de autenticarse.
- `/gatekeeper` devolvió HTML de 15.210 bytes decodificados en ambas muestras; la segunda respuesta tuvo cabeceras a los 125 ms. El navegador puede descargar recursos adicionales no incluidos aquí.
- `robots.txt` y `sitemap.xml` son públicos. Ambos mostraron `x-vercel-cache: HIT` en la segunda muestra.
- El sitemap devuelve `Cache-Control: private, no-store` al cliente pese al HIT observado en Vercel; no se debe afirmar que el CDN nunca lo almacena.
- El endpoint de estado mantiene el bloqueo anónimo (`401`) y la telemetría administrativa exige autorización (`403`).
- No se enviaron códigos de Gatekeeper, sesiones, credenciales ni solicitudes de escritura.

## Observaciones de código y prioridades

### 1. Medir páginas con acceso autorizado antes de optimizar su SSR

Prioridad alta para completar el diagnóstico. El Gatekeeper impide observar el contenido con sondas públicas y limita el rastreo de buscadores aunque el sitemap exista. Esto es una consecuencia de la configuración actual, no una razón para desactivar el control de acceso.

Siguiente paso: una medición autorizada de navegación y recursos, con una sesión de prueba y secretos del runner bien delimitados. No publicar cookies ni códigos en artifacts. Medir LCP, INP y CLS en navegador requiere un trabajo distinto de esta sonda HTTP.

### 2. Separar datos opcionales del camino crítico del layout

El [layout raíz](https://github.com/ilhamelin/savestate/blob/0f03d9eb29515c572a683a2801b38bc4c73fb43e/src/app/layout.tsx#L38-L50) fuerza renderizado dinámico y espera interruptores y broadcast antes de devolver la estructura. La consulta del [broadcast activo](https://github.com/ilhamelin/savestate/blob/0f03d9eb29515c572a683a2801b38bc4c73fb43e/src/services/system-state.ts#L59) no tiene caché de aplicación y dispone de un timeout de tres segundos.

Hipótesis a verificar: la consulta opcional del anuncio puede retrasar el primer contenido. Evaluar caché corta con invalidación al editar el anuncio o streaming independiente. Mantener las comprobaciones de acceso en el proxy y evitar caché compartida de sesiones o información privada.

### 3. Cuantificar el polling de estado global

El [banner](https://github.com/ilhamelin/savestate/blob/0f03d9eb29515c572a683a2801b38bc4c73fb43e/src/components/system-broadcast-banner.tsx) consulta inmediatamente y cada diez segundos mientras la pestaña está visible. [La ruta de estado](https://github.com/ilhamelin/savestate/blob/0f03d9eb29515c572a683a2801b38bc4c73fb43e/src/app/api/system-status/route.ts) vuelve a consultar el broadcast.

Esto implica aproximadamente seis consultas por minuto por pestaña visible, más las de montaje y cambios de visibilidad. Medir tráfico real antes de elegir caché de broadcasts, backoff o Realtime. Conservar la rapidez de los interruptores de seguridad y la separación de datos de usuario.

### 4. Revisar la política HTTP del sitemap por separado

El [proxy](https://github.com/ilhamelin/savestate/blob/0f03d9eb29515c572a683a2801b38bc4c73fb43e/src/proxy.ts#L136) aplica `private, no-store` a casi todas las rutas, incluido el sitemap. Revisar una política explícita solo para metadatos públicos, con pruebas de cabeceras. Las respuestas autenticadas y las rutas de Guardian deben mantener su protección.

## Límites y pendientes

- La conexión Vercel–GitHub funciona: el commit fusionado y el PR de auditoría recibieron estados Vercel correctos.
- El conector de Vercel sigue devolviendo `403` por falta de acceso al equipo `ilhamelins-projects`. Vincular el repositorio no concede ese permiso al conector.
- Por ese motivo no se han inspeccionado logs internos, excepciones, tasas de error, CPU, memoria, duración de funciones ni métricas de usuarios reales.
- Dos muestras por ruta no prueban estabilidad, percentiles ni diferencias entre instancias frías y calientes.
- Los bytes medidos son del cuerpo decodificado; no son el volumen comprimido transferido.
- No se cambiaron funciones de aplicación, políticas RLS, datos, variables, Gatekeeper ni otros interruptores.

## Repetición

El workflow [Production HTTP audit](../.github/workflows/production-audit.yml) se ejecuta al modificar su definición en un PR hacia `implementation/chatgpt`. Una vez integrado en la rama predeterminada de GitHub, también puede lanzarse manualmente desde Actions. Cada ejecución está limitada a cinco minutos, sin credenciales, con timeout de diez segundos por solicitud y lectura acotada del cuerpo.
