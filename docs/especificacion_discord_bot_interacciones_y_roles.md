# Especificación e Integración del Bot Oficial de Discord (Slash Commands, Linked Roles, Bridge Multicanal y Anuncios de Juegos Gratis)

**Fecha:** 12 de octubre de 2026  
**Origen:** Auditoría e Investigación Técnica (`research/antigravity`)  
**Propósito:** Documentar la arquitectura completa de la integración con Discord en **SaveState**: el puente bidireccional multi-frecuencia (`Discord Bridge`), el endpoint criptográfico de interacciones (`Slash Commands`), los roles vinculados (`Linked Roles`) y el anunciador automático de juegos gratuitos (`GamerPower`).

---

## 1. Arquitectura General de Discord en SaveState

SaveState cuenta con una integración nativa de Discord dividida en cuatro pilares:
1. **Discord Bridge Multicanal (`/community` y `/forum`)**: Lectura de múltiples frecuencias del servidor de Discord (`general`, `checkpoints`, `announcements`) y envío desde la web mediante Webhook/Bot, con presencia de miembros conectados en vivo.
2. **Discord Interactions Webhook (`/api/discord/interactions`)**: Endpoint HTTP verificado con firma **Ed25519** (`DISCORD_PUBLIC_KEY`) que procesa comandos Slash (`/`) sin requerir un proceso Gateway WebSocket permanente.
3. **Discord Linked Roles (`/api/discord/role-connection`)**: Flujo OAuth2 (`identify` + `role_connections.write`) que publica los metadatos de SaveState del jugador (nivel, juegos completados, platinos) directamente en su perfil del servidor de Discord.
4. **Anuncios Automáticos de Juegos Gratis (`/api/cron/discord-freebies`)**: Publicación automatizada y deduplicada de ofertas 100% gratuitas de GamerPower en el canal `#anuncios-savestate`.

---

## 2. Comandos Slash Registrados (`scripts/register-discord-application.mjs`)

El bot oficial registra **8 comandos Slash** globales:

| Comando | Parámetros | Descripción y Fuente de Datos |
|---|---|---|
| `/web` | — | Devuelve el enlace directo a SaveState (`https://savestate-eight.vercel.app`) y acceso rápido a las secciones principales. |
| `/savestate` | — | Muestra la tarjeta de estado de la plataforma, versión activa y resumen de módulos disponibles. |
| `/perfil` | `usuario` | Busca un jugador en SaveState (`@username`), mostrando su nivel, XP, título equipado, estado de terminal y enlace a su habitación gamer. |
| `/juego` | `titulo` | Consulta el catálogo de SaveState / IGDB y devuelve una tarjeta rica con portada, año, plataformas, géneros y nota de la comunidad. |
| `/gratis` | — | Muestra hasta 3 ofertas activas del radar **GamerPower** con precio original, plataforma, fecha límite y enlace directo para reclamar. |
| `/lol` | `usuario`, `region` | Consulta Riot Games API (`la1`, `la2`, `na1`, `br1`, `euw1`, por defecto `la2`) y muestra nivel de invocador, rango Solo/Dúo, LP, victorias/derrotas y winrate. |
| `/valorant` | `usuario`, `region` | Consulta el tracker competitivo dual (HenrikDev + Riot fallback, `latam` por defecto), presentando nivel, rango/RR y winrate reciente. |
| `/genshin` | `uid` | Consulta el escaparate público de **Enka.Network** para un UID de 9 dígitos, mostrando Adventure Rank, Abismo Espiral y hasta 8 personajes públicos con nivel. |

### Protocolo de Respuesta Diferida (Deferred ACK)
- Para evitar el límite estricto de 3 segundos de Discord en llamadas a APIs externas (Riot, Enka, IGDB, GamerPower), los comandos de consulta envían inmediatamente un **ACK diferido (`type: 5`, `DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE`)** y completan la respuesta editando el mensaje original (`PATCH /webhooks/{application_id}/{interaction_token}/messages/@original`) dentro de `after()`.

---

## 3. Puente de Frecuencias (`Discord Bridge`) y Presencia en Vivo

- **Frecuencias soportadas**:
  - `general`: Canal principal de conversación (`DISCORD_CHANNEL_ID`).
  - `checkpoints`: Canal de actividad y logros (`DISCORD_CHECKPOINTS_CHANNEL_ID` o autodescubrimiento por nombre).
  - `announcements`: Canal de noticias y juegos gratis (`DISCORD_ANNOUNCEMENTS_CHANNEL_ID` o autodescubrimiento por nombre).
- **Estabilidad y Smart Scroll**:
  - Polling estabilizado con caché corta, pausa automática cuando la pestaña está en segundo plano y preservación de posición de scroll cuando el usuario inspecciona mensajes anteriores.
- **Widget de Presencia de Discord**:
  - Muestra en la barra lateral de comunidad cuántos miembros están en línea en el servidor de Discord y el enlace directo de invitación (`DISCORD_INVITE_URL`).

---

## 4. Anunciador Automático de Juegos Gratis (`announceNewFreebiesToDiscord`)

- **Deduplicación inteligente sin tabla adicional**:
  - Antes de publicar en el canal de anuncios, inspecciona los últimos 100 mensajes del canal y compara el ID de oferta en el footer, el título y la URL de reclamación.
  - Utiliza un `nonce` determinista por oferta con `enforce_nonce: true` para impedir publicaciones duplicadas en ejecuciones concurrentes.
- **Control de Rate Limits**:
  - Respeta `X-RateLimit-Remaining` y `X-RateLimit-Reset-After`, con hasta 2 reintentos ante respuestas HTTP 429 (`Retry-After` acotado a 30s).
- **Ejecución**:
  - Se dispara en segundo plano con `after()` al visitar la frecuencia `announcements` con sesión iniciada (cacheado por 1 hora) o mediante el cron diario `GET/POST /api/cron/discord-freebies` (`0 13 * * *` en `vercel.json`) protegido por `CRON_SECRET`.
