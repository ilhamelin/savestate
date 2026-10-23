# SPEC-06 · Guardian Cloud / CI

Monitor de solo lectura para `ilhamelin/savestate` y el proyecto Vercel `savestate`.
No requiere migraciones ni dependencias nuevas.

## Configuración opcional

- `VERCEL_TOKEN`: token del operador limitado al proyecto/equipo correspondiente, exclusivamente en servidor.
- `VERCEL_PROJECT_ID`: ID o nombre; por defecto `savestate`.
- `VERCEL_TEAM_ID`: opcional para proyectos de equipo. Un 403 puede indicar falta de acceso al equipo/proyecto.
- `GITHUB_TOKEN`: token fine-grained para este repositorio con Contents, Actions y Pull requests en lectura. Ningún endpoint modifica despliegues, commits o PRs.

No usar prefijos `NEXT_PUBLIC_`, incluir valores reales en Git ni copiar tokens en el chat.
Las variables de Preview y Production se configuran por separado. Sin credenciales, Vercel muestra una indicación de configuración y GitHub usa lectura pública.

## Caché y cuotas

El feed tiene TTL de 30 segundos **por instancia serverless**, comparte consultas en vuelo y devuelve copias para evitar mutaciones.
La caché se invalida al cambiar credenciales o proyecto/equipo; no conserva datos privados al retirar el token.

Cuatro lecturas cada 30 segundos superarían la cuota pública de GitHub. Sin token se espacian cinco minutos, manteniendo el refresco del panel a 30 segundos. Se respetan ETags, Retry-After y x-ratelimit-reset.
Las instancias/regiones no comparten esta memoria: no se promete un límite distribuido de llamadas.

Un proveedor o recurso caído no impide consultar los demás (`Promise.allSettled`).
Los errores se cachean, las peticiones expiran a los cinco segundos y los cuerpos se limitan a 512 KB.
Las copias anteriores se conservan hasta 30 minutos y se identifican como anteriores; el timestamp del monitor es distinto del de los datos.
Ningún cuerpo de error de los proveedores ni secreto se devuelve al navegador.

## Producción, CI y seguridad

La consulta de producción es independiente del listado de seis despliegues recientes para que muchos previews no la oculten.
La tarjeta muestra el **último intento de producción**, que puede diferir del despliegue promovido que sirve tráfico.
Un estado desconocido nunca aparece como READY. Los estados QUEUED/BLOCKED se preservan en `phase` sin romper el contrato base.
La duración usa buildingAt/ready o run_started_at/updated_at; no confunde espera en cola con ejecución.

Se consulta específicamente `.github/workflows/ci.yml` para evitar atribuir al CI oficial un workflow auxiliar.
Los commits se deduplican por SHA conservando las dos ramas cuando corresponde.
Los enlaces se restringen a los hosts oficiales o se construyen con identificadores validados del repositorio.
Las respuestas de `/api/guardian/cloud-feed` requieren `authenticatedAdmin()` antes de consultar o usar la caché y llevan `private, no-store`.

El panel reutiliza el scheduler existente: no solapa peticiones, pausa timers y aborta al ocultarse, desconectarse o desmontarse, y aplica backoff ante fallos del endpoint. Los efectos visuales respetan reduced motion.

## Referencias

- [SPEC-06](https://github.com/ilhamelin/savestate/blob/research/antigravity/docs/specs/SPEC-06-guardian-cloud-devops-monitor.md)
- [Vercel · Deployments API](https://vercel.com/docs/rest-api/deployments/list-deployments)
- [GitHub · Workflow runs](https://docs.github.com/en/rest/actions/workflow-runs)
- [GitHub · buenas prácticas y límites](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api)
