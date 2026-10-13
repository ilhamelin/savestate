# Discord Bridge: canales reales

`GET /api/discord/messages?channel=web-chat|checkpoints|announcements` requiere sesión SaveState y devuelve los mensajes reales de la frecuencia elegida. El navegador nunca puede proporcionar un ID arbitrario de Discord.

`DISCORD_CHANNEL_ID` sigue siendo el destino de web-chat y de todos los envíos. El servidor obtiene su `guild_id` y descubre los canales de texto o anuncios cuyo nombre contiene `checkpoints` o `anuncios-savestate`. La lista autorizada se cachea 60 segundos; los mensajes, 5 segundos por ID de canal. Una coincidencia ausente o ambigua no se sustituye por mensajes del chat principal.

Para resolver nombres ambiguos pueden configurarse `DISCORD_CHECKPOINTS_CHANNEL_ID` y `DISCORD_ANNOUNCEMENTS_CHANNEL_ID`. Los IDs deben corresponder a canales de texto del mismo servidor; el bot debe poder verlos y leer su historial. Las variables son de servidor y no requieren migraciones SQL.

`POST /api/discord/messages` admite únicamente web-chat, manteniendo sesión, comprobación de origen y cuota existentes. Las otras frecuencias son de solo lectura tanto en la interfaz como en el endpoint.

Al cambiar de frecuencia, la interfaz limpia el historial anterior, cancela la consulta pendiente y descarta respuestas atrasadas. Conserva el scroll inteligente y muestra todos los mensajes del canal, incluidos anuncios sin fijar. El panel de frecuencias aparece primero en el sidebar. En escritorio el chat se estira con la columna derecha; en móvil vuelve a altura automática.
