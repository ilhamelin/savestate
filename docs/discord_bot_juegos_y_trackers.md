# Bot Discord: juegos gratis y trackers

## Comandos

La aplicación registra ocho comandos: `/web`, `/savestate`, `/perfil`, `/juego`, `/gratis`, `/valorant`, `/lol` y `/genshin`. Se actualizan con:

```powershell
node --env-file=.env.local scripts/register-discord-application.mjs
```

`/gratis` muestra hasta tres ofertas activas del servicio GamerPower existente, con valor, plataforma, cierre indicado y enlaces para reclamar. Usa el modelo normalizado actual (`thumbnail`, `openGiveawayUrl`), sin añadir otra integración de ofertas.

`/valorant usuario:Nombre#TAG region:latam|br|na|eu` usa el tracker competitivo existente, con `latam` por defecto. Presenta nivel, rango/RR disponibles y winrate de partidas recientes con resultado conocido. Si falta Henrik y Riot no proporciona esos datos, se indica su ausencia: no se considera al jugador sin rango ni se inventa un 0% de victorias.

`/lol usuario:Nombre#TAG region:la1|la2|na1|br1|euw1` usa Riot, con `la2` por defecto. Muestra nivel y rango Solo/Dúo, LP, victorias/derrotas y winrate. La consulta limita el historial a una partida porque la tarjeta se centra en el rango.

`/genshin uid:123456789` consulta el perfil público mediante Enka y reutiliza su almacén de nombres de personajes. Muestra nickname, Adventure Rank, Abismo y hasta ocho personajes públicos con nivel. Requiere un UID de nueve dígitos.

Los comandos que consultan proveedores envían primero un ACK público diferido. Las tarjetas exitosas son públicas y los errores siguen siendo efímeros.

## Anuncios automáticos

`announceNewFreebiesToDiscord()` publica en el canal autorizado de `announcements`, descubierto por nombre o por `DISCORD_ANNOUNCEMENTS_CHANNEL_ID`. El bot requiere permisos para ver el canal, leer su historial, enviar mensajes e insertar embeds.

Antes de publicar revisa los últimos 100 mensajes sin caché de mensajes y compara ID de oferta en el footer, título y URL de reclamación. Cada publicación usa un nonce estable por oferta con `enforce_nonce: true`. Las ejecuciones concurrentes de un proceso comparten una promesa; Discord evita mensajes concurrentes con el mismo nonce en su ventana reciente. La deduplicación se limita al historial reciente: no es un registro permanente y una oferta antigua que salga de los 100 mensajes puede volver a anunciarse.

El resultado se cachea una hora por canal. Los fallos de lectura del historial impiden publicar y los fallos parciales no se cachean como éxito. Tras publicar se invalida la caché de mensajes del Bridge.

Los lotes respetan `X-RateLimit-Remaining` y `X-RateLimit-Reset-After` antes del siguiente mensaje. Ante un 429 reintentan como máximo dos veces, esperando `Retry-After` o `retry_after`, con esperas acotadas a 30 segundos y un pequeño margen. El nonce se conserva en cada reintento; límites prolongados o persistentes dejan la ejecución pendiente sin cachearla como éxito.

Al cargar `announcements` con sesión SaveState se programa la revisión con `after()`; la respuesta del chat no espera su ejecución. También existe `GET`/`POST /api/cron/discord-freebies`, protegido por `Authorization: Bearer <CRON_SECRET>` y sin caché HTTP.

`vercel.json` configura una revisión diaria a las 13:00 UTC (`0 13 * * *`), compatible con Hobby. Ese plan puede ejecutarla dentro de la hora programada; la revisión por visitas cubre comprobaciones adicionales con caché de una hora. No requiere nuevas tablas, migraciones ni claves de proveedor.

Referencias: [nonce de Discord](https://docs.discord.com/developers/resources/message#jsonform-params), [cron en Vercel Hobby](https://vercel.com/docs/cron-jobs/usage-and-pricing).
