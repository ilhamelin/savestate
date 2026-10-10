# Embeds sociales y Discord Bridge

Implementación basada en `research/antigravity:docs/propuesta_social_embeds_y_discord.md`.

## Uso

- En un Momento Gamer o en el mensaje de un foro, pega una URL HTTPS de una publicación de X/Twitter o Instagram en una línea independiente.
- Se detectan hasta tres enlaces por mensaje, sin duplicados y fuera de bloques de código o spoilers. El Markdown original se conserva.
- La tarjeta carga al acercarse a la pantalla. El HTML de oEmbed se sanitiza en el servidor y las respuestas correctas se cachean siete días por URL canónica. Los fallos no se guardan como tarjetas válidas.
- «Cargar contenido interactivo» abre el marco aislado del proveedor. No se ejecutan sus scripts en la página de SaveState. El enlace original sigue disponible si la publicación es privada, eliminada o el proveedor falla.
- El endpoint solicitado de Instagram (`api.instagram.com/oembed`) puede no estar disponible. No se garantiza su respuesta; se ofrece el enlace original y la opción de cargar el marco oficial de Instagram. La disponibilidad de cada publicación depende del proveedor. No se añadieron tokens de Meta ni servicios externos alternativos.
- El chat está en `/community/discord`, enlazado desde el Header y Ctrl+K. Lectura y envío requieren sesión de SaveState: se aplica la regla de endpoint protegido de la propuesta, frente a su apartado contradictorio sobre espectadores anónimos.

## Configurar Discord

1. Crea una aplicación en [Discord Developer Portal](https://discord.com/developers/applications) y añade su bot.
2. Activa **Message Content Intent** en Bot. Es necesario para recibir el contenido de mensajes de otros usuarios, según las reglas de Discord; puede requerir aprobación si el bot está verificado.
3. Invita el bot al servidor con los permisos **View Channel**, **Read Message History** y **Send Messages**. Usa un canal dedicado a la comunidad de SaveState: sus mensajes se compartirán con los usuarios autenticados de la web.
4. Activa el modo desarrollador de Discord, copia el ID del canal y configura `DISCORD_CHANNEL_ID`.
5. Configura el token privado del bot en `DISCORD_BOT_TOKEN`. No lo pegues en el chat, no lo incluyas en Git y no uses un prefijo `NEXT_PUBLIC_`.
6. En Ajustes del canal → Integraciones → Webhooks, crea un webhook para avisos y configura `DISCORD_WEBHOOK_URL`. Usa una URL oficial HTTPS de `discord.com/api/webhooks/...`.
7. Añade las tres variables a `.env.local` y a **Production** en Vercel. Reinicia el servidor local y realiza un nuevo despliegue de Vercel para activar los valores de producción.
8. La migración `202610090021_discord_bridge.sql`, confirmada como aplicada por el usuario, habilita el cooldown atómico de tres segundos por usuario. Un intento que alcanza Discord consume el slot incluso si el proveedor falla: evita ráfagas de reintentos.

9. La invitación pública proporcionada es `https://discord.gg/532ZQzVXCp` y se usa por defecto. Puedes reemplazarla con `DISCORD_INVITE_URL` (`https://discord.gg/…` o `https://discord.com/invite/…`). La página muestra «Unirse al servidor» solo con una invitación válida; el webhook y el token nunca se usan como enlaces públicos.
10. En Production, usa `NEXT_PUBLIC_APP_URL=https://savestate-eight.vercel.app`. Para desarrollo local, conserva `http://localhost:3000` en `.env.local`; el enlace de la web y los avisos usan el origen configurado para cada entorno.

## Seguridad y eventos

- POST valida sesión, origen y longitud máxima de 500 caracteres. El username proviene del perfil autenticado, nunca del body.
- El cooldown se serializa con un bloqueo de fila en PostgreSQL y no depende de memoria de una instancia de Vercel. La tabla no tiene acceso directo para clientes.
- Los payloads usan `allowed_mentions: { parse: [] }`, para evitar menciones masivas/roles desde la web.
- Lectura con caché corta de cinco segundos, sondeo cada diez segundos solo con la pestaña visible, cancelación de peticiones y refresco manual. Los adjuntos se muestran como enlaces a hosts oficiales; texto escapado por React.
- Avisos de platino y nivel se basan en `award_xp.success`: una repetición del evento de XP no vuelve a enviarlos. Los platinos de bibliotecas privadas no se anuncian. Los niveles solo incluyen username y nivel, datos públicos del perfil.
- Los hilos se anuncian tras guardarse. Se usa `after()` para que fallos de Discord no impidan guardar la acción en SaveState. La entrega es best effort, sin cola durable ni reintento automático.
- Los avisos incluyen el botón Link (style 5) «🌐 Ver en SaveState» y el enlace del embed hacia el perfil o el hilo. El webhook añade `with_components=true` y `wait=true`, según la [API oficial](https://docs.discord.com/developers/resources/webhook#execute-webhook).
- Un progreso Steam/Xbox/PSN que se guarda por primera vez con `current === total` y total mayor que cero también genera aviso, con título y horas acumuladas de sus partidas. No se altera el estado ni se otorga XP por este aviso. La actualización compara el valor anterior para evitar anunciar dos sincronizaciones concurrentes del mismo registro. Otro registro ya completo o un juego con estado `platinum` evita el aviso adicional. No se garantiza entrega exactamente una vez entre registros distintos ni ante fallos del proveedor.
- `src/proxy.ts` mantiene el nonce y permite únicamente los marcos oficiales de X/Instagram, además de YouTube existente; no amplía `script-src`.

## Verificación

- `npm run check`: ESLint, TypeScript, formato y pruebas unitarias.
- `node --experimental-strip-types --test tests/integration/social-bridge.test.ts`: aprobado. Prueba los servicios y rutas reales con sesión/proveedores simulados, sin enviar mensajes externos ni escribir en Supabase.
- `npm run build`: aprobado con las nuevas rutas y Proxy nativo de Next.js 16.
- Supabase real: llamada anónima a `claim_discord_message_slot` rechazada con `42501`, sin modificaciones. No se ha ensayado el cooldown con una sesión real.
- Verificación del 9 de octubre: las credenciales locales permiten leer 30 mensajes del canal (HTTP 200), y consultar la configuración del webhook (HTTP 200). No se publicaron mensajes de prueba. La recepción real de avisos y el envío desde una sesión de SaveState siguen pendientes de prueba tras el despliegue.

Referencias: [Message Resource de Discord](https://docs.discord.com/developers/resources/message), [oEmbed de Instagram](https://developers.facebook.com/docs/instagram-platform/oembed).
