# Discord Interactions y Linked Roles

## Configuración

Copiar los valores públicos de `DISCORD_APPLICATION_ID` y `DISCORD_PUBLIC_KEY` desde `.env.example` a `.env.local` y al entorno de Vercel. Configurar `DISCORD_CLIENT_SECRET` únicamente en el servidor. Nunca copiar secretos al chat ni usar `NEXT_PUBLIC_*`.

En Discord Developer Portal, para la aplicación `1557446548982464652`:

1. Interactions Endpoint URL: `https://savestate-eight.vercel.app/api/discord/interactions`.
2. OAuth2 Redirect URI: `https://savestate-eight.vercel.app/api/discord/role-connection/callback`.
3. Linked Roles Verification URL: `https://savestate-eight.vercel.app/community/discord`.
4. Registrar comandos y metadatos, con el token del bot de esa misma aplicación, mediante:

```powershell
node --env-file=.env.local scripts/register-discord-application.mjs
```

El script verifica la identidad de la aplicación antes de modificarla y conserva comandos/metadatos ajenos a SaveState. El registro no se ejecuta automáticamente durante un build o una visita a la web.

Después, el administrador del servidor debe crear un rol vinculado y configurar sus requisitos sobre Nivel SaveState, Juegos Terminados o Juegos Platinados. Publicar metadatos no asigna un rol directamente.

Para desarrollo local, `NEXT_PUBLIC_APP_URL` debe apuntar al dominio local correcto; Discord requiere un endpoint público para enviar interacciones. Este endpoint es serverless: funciona cuando recibe solicitudes, no mantiene un proceso de bot o una conexión Gateway permanente.

## Seguridad y comportamiento

- Ed25519 nativo de Node verifica el timestamp y el cuerpo crudo antes de parsear JSON, sin comprobar la antigüedad del timestamp para admitir los valores sintéticos de validación. Cuerpo limitado a 64 KB y aplicación validada. Las firmas inválidas devuelven 401.
- PING devuelve PONG inmediatamente. `/web` y `/savestate` usan respuesta pública tipo 4. `/perfil` y `/juego` confirman con tipo 5 público y completan la tarjeta usando `after()`, para cumplir el límite de tres segundos de Discord. Los errores son efímeros; tras un ACK público se envían como un mensaje separado y se retira el mensaje de carga.
- `/perfil` muestra estado terminal y, solo en bibliotecas públicas, totales, juegos `cleared`, platinos y Top 4 ordenado por la columna existente `favorite_position`. `/juego` muestra géneros, hasta cinco plataformas y usuarios con el título en bibliotecas públicas.
- Las opciones `usuario` y `titulo` tienen autocompletado: interacciones tipo 4 reciben una respuesta tipo 8 con hasta cinco sugerencias. Las búsquedas usan el cliente anónimo con RLS, escapan comodines y tienen timeout de 1,5 segundos; los errores o entradas vacías devuelven una lista vacía.
- El proxy no consulta una sesión Supabase para este webhook. Los comandos consultan Supabase con la clave anónima y RLS, sin cookies ni service role. Las bibliotecas privadas no revelan conteos. La ficha de juegos enlaza mediante el slug existente.
- Linked Roles requiere una sesión SaveState y OAuth dedicado con `identify role_connections.write`, incluso si el usuario inició sesión usando Discord sin ese alcance. El state es aleatorio, expira a los cinco minutos y está vinculado a la sesión.
- El token de usuario se guarda cifrado con AES-GCM en una cookie HttpOnly, SameSite Lax, Secure en HTTPS y restringida al endpoint. Caduca como máximo en una hora; no se guarda refresh token ni se devuelve el token al navegador. El callback debe ser utilizado por el propio usuario mediante el consentimiento de Discord.
- Cuando SaveState tiene una identidad Discord de inicio de sesión, el callback comprueba que se autorice esa misma identidad. Los conteos se calculan desde la sesión propietaria: terminados incluye `cleared` y `platinum`; platinos incluye solo `platinum`.
- La interfaz explica que esos conteos se comparten con Discord al autorizar, incluso si la biblioteca es privada. Las estadísticas nunca se aceptan desde el cuerpo de la solicitud del cliente.

Referencias oficiales: [Interacciones](https://docs.discord.com/developers/interactions/receiving-and-responding), [OAuth2](https://docs.discord.com/developers/topics/oauth2), [Linked Roles](https://docs.discord.com/developers/tutorials/configuring-app-metadata-for-linked-roles).
