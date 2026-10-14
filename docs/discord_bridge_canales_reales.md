# Discord Bridge: canales reales

`GET /api/discord/messages?channel=web-chat|checkpoints|announcements|chat-privado` requiere sesión SaveState y devuelve los mensajes reales de la frecuencia elegida. El navegador nunca puede proporcionar un ID arbitrario de Discord.

`DISCORD_CHANNEL_ID` sigue siendo el destino de web-chat. El servidor obtiene su `guild_id` y descubre los canales de texto o anuncios cuyo nombre contiene `checkpoints` o `anuncios-savestate`. La lista autorizada se cachea 60 segundos; los mensajes, 5 segundos por ID de canal. Una coincidencia ausente o ambigua no se sustituye por mensajes del chat principal.

Para resolver nombres ambiguos pueden configurarse `DISCORD_CHECKPOINTS_CHANNEL_ID` y `DISCORD_ANNOUNCEMENTS_CHANNEL_ID`. Los IDs deben corresponder a canales de texto del mismo servidor; el bot debe poder verlos y leer su historial. Las variables son de servidor y no requieren migraciones SQL.

`POST /api/discord/messages` admite web-chat y chat-privado, manteniendo sesión, comprobación de origen y cuota existentes. Checkpoints y anuncios son de solo lectura tanto en la interfaz como en el endpoint. Respuestas y menciones se resuelven dentro del canal elegido.

Al cambiar de frecuencia, la interfaz limpia el historial anterior, cancela la consulta pendiente y descarta respuestas atrasadas. Conserva el scroll inteligente y muestra todos los mensajes del canal, incluidos anuncios sin fijar. El panel de frecuencias aparece primero en el sidebar. En escritorio el chat se estira con la columna derecha; en móvil vuelve a altura automática.

## Frecuencia privada

`DISCORD_PRIVATE_CHAT_CHANNEL_ID` tiene fallback a `747219024324198532`. El canal debe existir en el mismo servidor; un override inexistente no habilita otro canal. La pastilla solo aparece si el servidor confirma acceso. Salvo las excepciones administrativas descritas abajo, la identidad proviene exclusivamente de `auth.getUser().identities` con proveedor Discord: un nombre, enlace de perfil o rol de administrador de SaveState no concede acceso. Iniciar sesión con Discord o vincularlo como identidad de Supabase es necesario; el consentimiento OAuth independiente de Roles Vinculados no sustituye esa identidad.

Cada lectura y envío consulta la membresía, roles y sobrescrituras actuales de Discord. Se admiten dueño del servidor, administrador de Discord o permisos efectivos de ver canal y leer historial. Envíos requieren además `SEND_MESSAGES`; adjuntos requieren `ATTACH_FILES`. Timeouts y membresías pendientes bloquean envíos. Fallos de verificación ocultan la frecuencia y devuelven 403 al intentar acceder directamente. La autorización nunca se comparte en la caché de mensajes. Al revocarse el acceso, el siguiente sondeo vacía la vista y regresa al chat general.

Los borradores, adjuntos y respuestas se limpian al cambiar de frecuencia para evitar cruces entre conversaciones públicas y privadas.

La migración `202610140031_discord_private_media.sql` crea `discord-private-media` con `public=false`, límite de 5 MB y políticas de propietario (incluida una política restrictiva frente a otros permisos amplios). `POST /api/discord/private-upload` verifica permisos y devuelve únicamente un token de subida y una ruta propia, sin URL pública. El navegador sube directamente a Storage; al enviar, el servidor valida propietario, MIME, tamaño y firma, transfiere el archivo como adjunto multipart a Discord y elimina la copia temporal tras el éxito. Un fallo de envío conserva la copia privada para reintentar. Los archivos abandonados permanecen privados para su propietario; no se ha añadido una limpieza programada. Las URLs externas de GIFs/imágenes conservan la visibilidad de su proveedor.

## Vinculación nativa y excepciones administrativas

En `/settings`, Cuentas Vinculadas usa `auth.linkIdentity` (Discord, PKCE) y `auth.unlinkIdentity`; el callback conserva `next=/settings` o `/chat` con `safeNext`. También está disponible en la tarjeta de Roles Vinculados del chat. Nombre/avatar se obtienen de la identidad, no del perfil editable. No se puede quitar la única identidad de acceso.

Supabase debe tener habilitados Discord y **Enable Manual Linking**, y permitir las URLs de callback de producción/local. Los errores se muestran en el panel; nunca se sustituye vinculación por iniciar otra sesión. Roles Vinculados es un consentimiento independiente.

Las cuentas administradoras existentes `ilhamelin_v2` y `ilhamelin` reciben acceso completo por sus UUID inmutables, comprobados contra `auth.getUser()`. `DISCORD_PRIVATE_CHAT_ALLOWED_USERS` admite UUID de usuarios Supabase separados por comas, no nombres editables; esto impide heredar acceso cambiando el username. Las demás cuentas siguen sujetas a permisos efectivos actuales de Discord. No se omite autenticación ni el aislamiento de adjuntos privados.
