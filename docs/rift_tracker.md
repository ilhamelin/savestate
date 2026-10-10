# Rift Tracker

En la vista dedicada `/rift`, accesible desde el Navbar y Ctrl+K, Rift Tracker permite consultar un Riot ID y servidor. Muestra rango Solo/Dúo y Flexible, nivel e icono, partidas recientes en lotes de diez, estadísticas y jugadores por equipo. Es una consulta bajo demanda, sin migración SQL ni almacenamiento de vínculos en el perfil.

## Activar Riot

1. Iniciar sesión en el [Riot Developer Portal](https://developer.riotgames.com/) y registrar SaveState como producto. La clave de desarrollo sirve para pruebas y caduca cada 24 horas. Para usuarios públicos, solicitar una clave de producción; las claves personales y de desarrollo no habilitan un producto público. [Guía oficial de claves](https://developer.riotgames.com/docs/portal).
2. Añadir `RIOT_API_KEY=` con el valor real a `.env.local`. No usar `NEXT_PUBLIC_`, no hacer commit de la clave ni enviarla por chat.
3. Cargarla en Production mediante `npx vercel env add RIOT_API_KEY production --type secret` introduciendo el valor en el prompt y volver a ejecutar `npx vercel --prod`. El despliegue anterior no recibe variables añadidas después de su creación.
4. Abrir `/rift` con una sesión activa, indicar `Nombre#TAG`, seleccionar el servidor y cargar el historial. Mientras la clave esté pendiente, se muestra un aviso y el servicio responde 503 a consultas autenticadas válidas.

## API y seguridad

`POST /api/tracker/lol/inspect` recibe `{ riotId, platform }` y devuelve `{ data: LolProfileData }`. El alias `/api/tracker/lol` usa el mismo handler. Requiere sesión Supabase, origen de la aplicación y un cuerpo JSON de hasta 2 KB. Solo se consultan hosts oficiales seleccionados mediante una lista de plataformas; la clave viaja en `X-Riot-Token`, nunca en una URL ni en las respuestas.

Account usa el clúster de cuentas; Summoner y League usan la plataforma; Match usa el clúster regional. Oceanía consulta Account en Asia y Match en SEA. El resultado se cachea 120 segundos por Riot ID, plataforma y huella de la clave, sin guardar la clave como argumento de caché. Data Dragon se cachea 24 horas y selecciona el parche de cada partida cuando está disponible. Los detalles se piden en lotes de tres y se detienen al recibir 429. Las respuestas 429 principales incluyen `Retry-After`; los fallos parciales se explican sin confundir un rango no disponible con «Sin clasificar».

La tabla conserva los participantes reales de modos distintos de 5v5. Los espacios vacíos de objetos/hechizos se representan sin fabricar URLs. CS suma súbditos y monstruos neutrales; el daño es a campeones. Los emblemas de rango son distintivos retro de SaveState; los iconos de invocador, campeones, hechizos y objetos proceden de Data Dragon.

Las partidas personalizadas se excluyen de las búsquedas por Riot ID: para mostrarlas, Riot requiere consentimiento específico o RSO. La sección incluye la atribución de Riot. [Política y documentación oficial](https://developer.riotgames.com/docs/lol).

## Verificación

`npm run check` valida tipos, lint, formato y pruebas de normalización y servicio con respuestas simuladas. Probar con clave real en el entorno configurado: un Riot ID existente en LAS/KR, una cuenta sin rango, un ID inexistente y errores de credenciales/límite. Una clave pendiente impide certificar consultas reales a Riot, aunque Data Dragon puede verificarse sin clave.

## Filtros y analíticas

El historial filtra localmente por Todas, Solo/Dúo (420), Normales (400/430), ARAM (450), Arena (1700/1710) y Otros / Caos (el resto, incluyendo Flexible). Los paneles ROLES y TOP CHAMPIONS usan la muestra filtrada de todas las partidas cargadas, no toda la trayectoria del jugador. Las posiciones desconocidas se excluyen solo del panel de roles. Los cinco campeones más jugados se ordenan por cantidad y nombre en caso de empate. WR = victorias / partidas; KDA = (kills + assists) / deaths acumuladas (Perfecto cuando no hay muertes); los promedios K/D/A son por partida. Una nueva consulta restablece Todas.

## Cuenta principal, medallas y maestría

Los enlaces `/rift?riotId=Nombre%23TAG&platform=la2` cargan automáticamente la cuenta tras iniciar sesión. Sin parámetros se utiliza la cuenta fijada en `savestate_pinned_lol_account`. Las últimas cinco consultas exitosas se guardan en `savestate_recent_lol_searches`; los datos almacenados se validan y las restricciones del navegador no bloquean el buscador. Estas preferencias pertenecen al navegador, sin vínculos nuevos en Supabase.

Maestría consulta champion-mastery-v4 por PUUID en la plataforma seleccionada, con count=3. Los fallos son parciales y no bloquean el historial; el recurso se documenta en el [portal oficial](https://developer.riotgames.com/apis/#champion-mastery-v4). Se utiliza la versión actual de Data Dragon para sus imágenes.

Las medallas MVP son una heurística de SaveState por mayor daño o mejor KDA dentro del mismo equipo, incluyendo empates positivos. Participación = (kills + assists) / kills del equipo; se muestra 0% si no hay kills. Pentakill/cuatricidio provienen de largestMultiKill. Publicar en Momentos abre un borrador editable mediante parámetros acotados, nunca realiza publicaciones automáticas.

## Cargar más partidas y ambientación

La vista usa ProfileWallpaper con neon_cyberpunk.svg y fullScreen, conservando la capa oscura de contraste existente. La API acepta start (0–10000) y count (1–10), con valores por defecto 0/10. Cada página tiene su propia entrada de caché. La respuesta añade nextStart y hasMore. El cursor cuenta los IDs examinados de Riot, incluyendo partidas personalizadas o fallos de detalle, en lugar del número de tarjetas visibles. Si se interrumpe por 429, continúa desde el final del lote examinado, sin saltar los lotes no solicitados. Los errores parciales se mantienen visibles.

Cargar más acumula partidas únicas por matchId, conserva los filtros y recalcula las analíticas sobre la muestra acumulada. Las búsquedas y cargas adicionales se excluyen mutuamente; los errores conservan las partidas existentes y permiten reintentar. Un listado vacío o corto indica el final del historial; un fallo del listado no avanza el cursor.
