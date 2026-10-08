# SaveState v2 — Entrega B: Steam y Wrapped

Implementación del 8 de octubre de 2026 en `implementation/chatgpt`, basada en `propuesta_savestate_v2.md` y el pedido de Entrega B. No incorpora dependencias nuevas.

## Importador Steam

- Acceso desde `/settings` y `/library` hacia `/library/import`.
- `POST /api/steam/import`: sesión verificada, mismo origen, cuerpo limitado y respuestas personales sin caché compartida.
- Acepta Steam ID 64 como texto o perfiles HTTPS de `steamcommunity.com/profiles/...` e `id/...`. Las URLs de entrada no se descargan: solo se extrae el identificador. Perfiles personalizados se resuelven mediante `ISteamUser/ResolveVanityURL/v0001/`.
- `IPlayerService/GetOwnedGames/v0001/` se consulta exclusivamente en servidor, con `STEAM_API_KEY`, detalles de aplicaciones y juegos gratuitos jugados. La biblioteca y «Detalles de juegos» deben ser públicos, conforme a la [documentación oficial de Valve](https://partner.steamgames.com/doc/webapi/IPlayerService).
- Steam devuelve minutos acumulados. Se sugiere `playing` si hay minutos y `backlog` si no; el usuario puede elegir `cleared` explícitamente. No se infiere terminación ni Platinum a partir de horas.
- Previsualización en páginas de 250 títulos; interfaz de 24 tarjetas con búsqueda, selección, estados, carga adicional y progreso. Los lotes adicionales no se seleccionan automáticamente. La importación procesa juegos secuencialmente y puede detenerse tras el juego actual.
- Las previsualizaciones tienen firma HMAC, caducidad de 30 minutos y vínculo al usuario. Se firma con la clave de servidor existente y un prefijo exclusivo; ningún secreto viaja al cliente. Títulos/minutos alterados o tickets de otra sesión se rechazan.
- Se consulta el catálogo existente/IGDB y solo se elige automáticamente una coincidencia exacta única tras normalización conservadora de acentos, puntuación y marcas. No se eliminan números ni nombres de ediciones. Si no hay coincidencia inequívoca, el usuario elige una ficha entre los resultados; los títulos no resueltos quedan sin importar.
- La migración `202610070010_steam_import.sql` guarda ficha de biblioteca y horas en una transacción mediante RPC `security invoker`, respetando RLS. Conflictos no modifican estados, puntuaciones, favoritos ni partidas existentes. Las horas de nuevos juegos se guardan en una partida con prefijo `[Steam lifetime:APPID]`, sin fechas de inicio/finalización inventadas.

### Configuración externa

La migración 010 fue ejecutada en Supabase por el usuario y probada contra el servicio real. `STEAM_API_KEY` aún está pendiente; la interfaz informa esa situación y conserva el acceso normal a la biblioteca.

Configurar la clave en `.env.local` y en el entorno Production de Vercel, siempre sin prefijo `NEXT_PUBLIC_`. No pegarla en chat ni versionarla. Después hay que reiniciar el servidor local o desplegar de nuevo en Vercel para cargarla.

La prueba contra Valve con una biblioteca pública real queda pendiente de disponer de esa clave. El importador queda preparado para despliegue con su aviso descriptivo de configuración; la consulta externa solo se habilita al configurar la clave.

## SaveState Wrapped

Ruta `/players/[username]/wrapped?year=2026`, enlazada desde cada perfil. Año actual por defecto; selector anual. Carrusel manual accesible de cinco secciones, sin movimiento automático: checkpoints, GOTY, géneros, Momento épico y ritmo mensual. Exportación Canvas de 1080×1920, con fuentes ya cargadas y sin imágenes externas ni riesgo de Canvas contaminado.

### Definiciones de cálculo

- Año y meses en UTC. Registrados: primer evento `library_updated` disponible de cada título; `updated_at` no se usa como fecha de alta. Si se borró el historial, no se inventan fechas anteriores.
- Jugados: títulos con actividad de estado `playing`/`cleared`/`platinum` o una partida atribuida al año.
- Completados: títulos que entraron en `cleared`/`platinum` durante el año o tienen una fecha de fin en ese año. Cada título cuenta una vez; subir de Cleared a Platinum o cambiar una nota no añade otra finalización. La fecha de fin de una partida tiene prioridad sobre un evento posterior para determinar el mes.
- Horas: la partida completa se atribuye a fecha de fin, inicio o registro, por ese orden. Una partida que cruza varios años no se prorratea al faltar sesiones fechadas. Las horas históricas importadas de Steam se excluyen; su estado de biblioteca sí representa el checkpoint marcado al importar.
- GOTY: mayor puntuación actual entre los títulos jugados en ese año; favoritos actuales resuelven empates o sirven de alternativa cuando no hay puntuación. No se afirma disponer de puntuaciones históricas por año.
- Géneros: peso por título, repartido entre sus géneros; redondeo por restos mayores para sumar exactamente 100%.
- Momento épico: publicación pública visible, creada en el año, con mayor número actual de reacciones. Desempate estable por fecha e ID. Las publicaciones privadas no se incluyen.

El servicio consulta todas las páginas de los datos del resumen, sin reutilizar el límite de 500 de la vista de biblioteca. Existe un tope de seguridad de 50.000 filas por consulta paginada; si se supera, se devuelve un error explícito en lugar de estadísticas parciales.

Wrapped comprueba `can_view_library` y mantiene RLS en todas las consultas. Una biblioteca privada bloquea el resumen a visitantes y usuarios ajenos; propietario y amigos autorizados pueden consultarlo. Exportar descarga los datos visibles al usuario: no publica ni sube imágenes a terceros.

## Verificación

- `npm run check`: lint, tipos estrictos, 34 tests unitarios y formato aprobados.
- `npm run build`: empaquetado de producción aprobado con las tres rutas nuevas y `src/proxy.ts` intacto.
- `TEST_STEAM_WRAPPED_LIVE=1` con `TEST_APP_URL=http://localhost:3100`: importación por HTTP contra Supabase real, nota/estado conservados al repetir, un solo registro de horas, rechazo de horas manipuladas en el cuerpo, tickets alterados/caducados/ajenos, origen externo, sesión ausente y privacidad de Wrapped. Datos temporales eliminados.
- Navegador: cinco diapositivas comprobadas, GOTY/44 horas/Momento épico/abril sobre fixture controlada, descarga PNG de 1080×1920 revisada visualmente y consola sin errores.
- Steam sin clave: aviso y botón deshabilitado comprobados. Fuente Steam simulada de 300 títulos: resolución de vanity, 250 iniciales, 24 tarjetas, desmarcado y selección individual, conservación de juego existente, carga de 50 adicionales y búsqueda verificados. La simulación vive en `tests/integration/steam-upstream.mock.mjs`, se activa únicamente mediante `--import` y opt-in local; la aplicación no la importa.
- Evidencia: `docs/evidence/v2b-wrapped-desktop.png`, `v2b-wrapped-export.png`, `v2b-steam-unconfigured.png` y `v2b-steam-preview-fixture.png`.

Esta entrega no despliega a producción: el usuario pidió confirmar preparación para el despliegue final. La instalación Steam real depende de configurar su clave.
