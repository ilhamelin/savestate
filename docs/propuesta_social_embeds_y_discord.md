# Propuesta Técnica: Integración Social (Instagram/Twitter oEmbed) y Discord Bridge

**Fecha:** 9 de octubre de 2026  
**Origen:** Auditoría, Diseño e Investigación (`research/antigravity`)  
**Destino:** Equipo de Implementación (`implementation/chatgpt` / Codex)  
**Propósito:** Especificar la arquitectura para incrustar publicaciones interactivas de Instagram y Twitter/X mediante el protocolo oEmbed gratuito en Foros y Momentos, e implementar la conexión bidireccional con Discord (ver/enviar mensajes en canales sincronizados y notificaciones automáticas de hitos de jugadores).

---

## 1. Alcance y Arquitectura General

La propuesta se compone de dos módulos independientes y complementarios:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        SAVESTATE SOCIAL HUB                            │
├──────────────────────────────────┬─────────────────────────────────────┤
│   MÓDULO 1: SOCIAL OEMBEDS       │   MÓDULO 2: DISCORD BRIDGE          │
│   • Instagram Post Embeds        │   • Chat sincronizado (Web <-> Dsc) │
│   • Twitter / X Tweet Cards      │   • Checkpoint Bot (Notificaciones) │
│   • Detección en Foros/Momentos  │   • Visualizador de canal retro     │
└──────────────────────────────────┴─────────────────────────────────────┘
```

---

## 2. Módulo 1: Enriquecedor de Publicaciones oEmbed (Instagram & Twitter/X)

### 2.1. Justificación Técnica
* **Twitter / X:** La API v2 de pago ($100 USD/mes) es inviable para lectura masiva. Sin embargo, el endpoint oficial `https://publish.twitter.com/oembed` es **100% gratuito, público y no requiere API keys**.
* **Instagram:** Las APIs de mensajería están bloqueadas para cuentas personales por Meta. El protocolo oficial `oEmbed` de Instagram permite obtener el HTML interactivo y responsivo de cualquier publicación pública o reel.

### 2.2. Detección y Flujo de Servidor
1. **Ruta Proxy de Servidor (`GET /api/embeds/oembed?url={targetUrl}`):**
   * El cliente o el renderizador de Markdown detecta una URL de Instagram o Twitter en una línea individual:
     * Twitter / X: `https://twitter.com/*/status/*` o `https://x.com/*/status/*`
     * Instagram: `https://www.instagram.com/p/*`, `https://www.instagram.com/reel/*`
   * El servidor valida el dominio con una lista blanca (`x.com`, `twitter.com`, `instagram.com`).
   * Consulta el proveedor oficial de oEmbed:
     * Para Twitter: `https://publish.twitter.com/oembed?url=${encodeURIComponent(targetUrl)}&omit_script=true&theme=dark`
     * Para Instagram: `https://api.instagram.com/oembed?url=${encodeURIComponent(targetUrl)}&omit_script=true`
   * Retorna el objeto JSON con el HTML de la tarjeta y metadatos del autor.
   * **Caché en servidor (Next.js `unstable_cache`):** La respuesta se cachea durante 7 días para evitar llamadas innecesarias al navegar.

### 2.3. Componente de Interfaz: `<SocialEmbed url={url} />`
* **Estados de la tarjeta:**
  1. *Cargando:* Marco retro con efecto de scanlines y texto animado `[ Descifrando transmisión de X / Instagram… ]`.
  2. *Renderizado:* Contenedor seguro sanitizado con `isomorphic-dompurify` que inyecta la tarjeta oficial del tweet o publicación.
  3. *Fallback de error:* Si la publicación es privada o fue borrada, muestra un enlace retro seguro: `[ ↗ Ver publicación original en X / Instagram ]`.
* **Integración en Foros y Momentos:**
  * En `src/services/markdown.ts` y `src/components/moment-card.tsx`, si el texto contiene una URL directa a una publicación, se renderiza automáticamente el componente `<SocialEmbed />`.

---

## 3. Módulo 2: Discord Bridge (Chat Sincronizado y Bot de Checkpoints)

### 3.1. Arquitectura de Conexión con Discord
Se utiliza la API oficial de Discord v10 mediante un Bot dedicado y Webhooks:

```
┌─────────────────────────────────┐                 ┌─────────────────────────────────┐
│          WEB SAVESTATE          │                 │       SERVIDOR DE DISCORD       │
│                                 │                 │                                 │
│  [ Usuario escribe en la web ]  │ ── POST API ──► │  [ Bot publica en canal #chat ] │
│                                 │                 │                                 │
│  [ Pantalla de chat en la web ] │ ◄── GET API ─── │  [ Mensajes de los usuarios ]   │
│                                 │                 │                                 │
│  [ Jugador platina un juego ]   │ ── Webhook ───► │  [ Embed retro en #checkpoints ]│
└─────────────────────────────────┘                 └─────────────────────────────────┘
```

### 3.2. Variables de Entorno Requeridas (`.env.local`)
```env
# Discord Bot & Webhooks
DISCORD_BOT_TOKEN=        # Token privado del bot (Discord Developer Portal)
DISCORD_CHANNEL_ID=       # ID del canal de texto sincronizado con la web
DISCORD_WEBHOOK_URL=      # URL del webhook para el canal de notificaciones automáticas
```

### 3.3. Funcionalidad A: Chat Sincronizado en la Web (`/community/discord` o pestaña en Arcade)
1. **Lectura de Mensajes (`GET /api/discord/messages`):**
   * Endpoint protegido que consulta:
     `GET https://discord.com/api/v10/channels/${DISCORD_CHANNEL_ID}/messages?limit=30`
     con encabezado `Authorization: Bot ${DISCORD_BOT_TOKEN}`.
   * Filtra y normaliza la respuesta:
     * Nombre de usuario y avatar del autor.
     * Contenido textual (convirtiendo menciones y emojis estándar).
     * Archivos adjuntos o imágenes.
     * Fecha y hora en formato relativo.
2. **Envío de Mensajes desde la Web (`POST /api/discord/messages`):**
   * Requiere usuario autenticado en Savestate.
   * Aplica un rate limit estricto de 1 mensaje cada 3 segundos por usuario.
   * Envía a Discord:
     `POST https://discord.com/api/v10/channels/${DISCORD_CHANNEL_ID}/messages`
     con el cuerpo:
     `"**[@${profile.username} en Savestate]:** ${texto}"`
3. **Componente de Interfaz `<DiscordChat />`:**
   * Diseño de ventana retro CRT / terminal de chat.
   * Botón de refresco manual o intervalo inteligente de sondeo (polling cada 10 segundos cuando la pestaña está activa).
   * Input de texto con tecla `Enter` para enviar.
   * Botón directo con enlace para unirse al servidor de Discord.

### 3.4. Funcionalidad B: Checkpoint Webhook (Avisos Automáticos)
Servicio `notifyDiscordCheckpoint(event)` en `src/services/discord.ts` que dispara un mensaje formateado con Embed retro cuando ocurren eventos destacados en Savestate:

1. **Juego Platinado (100% de logros/trofeos):**
   * Título: `🏆 ¡NUEVO PLATINO DESBLOQUEADO!`
   * Descripción: `@username acaba de platinar **${game.title}** (${hours} horas registradas).`
   * Color del embed: `#FFD700` (Oro).
2. **Subida de Nivel Destacada:**
   * Título: `⚡ LEVEL UP`
   * Descripción: `@username alcanzó el **Nivel ${level}** y equipó el marco **[${frame}]**.`
   * Color del embed: `#00F0FF` (Cian Neón).
3. **Nuevo Hilo en la Comunidad:**
   * Título: `💬 Nuevo debate en el Foro`
   * Descripción: `@username abrió el tema: **${thread.title}** en la categoría #${category}.`
   * Color del embed: `#39FF14` (Verde fósforo).

---

## 4. Seguridad, Gobernanza y Rendimiento

1. **Aislamiento de Secretos:**  
   `DISCORD_BOT_TOKEN` se maneja exclusivamente en el servidor (`server-only`). El navegador nunca tiene acceso al token.
2. **Protección contra Spam y Abusos:**  
   * Validación de longitud en mensajes (máximo 500 caracteres).
   * Cooldown de 3 segundos entre envíos por usuario.
   * Si un usuario no está logueado en Savestate, solo puede leer los mensajes en modo espectador.
3. **Sanitización HTML:**  
   Todas las tarjetas oEmbed recibidas de Twitter e Instagram se procesan con `isomorphic-dompurify` antes de inyectarse en el DOM para neutralizar cualquier intento de XSS.

---

## 5. Plan de Implementación para Codex

### 1. Dominio y Servicios
* **`src/domain/social-embed.ts`**: Validador de URLs de Instagram y Twitter/X.
* **`src/services/embeds.ts`**: Cliente de consulta a los endpoints de oEmbed con caché `unstable_cache`.
* **`src/services/discord.ts`**: Cliente de la API de Discord v10 (lectura/envío de mensajes y despachador de webhooks para eventos).

### 2. Endpoints de Servidor (`src/app/api/`)
* **`src/app/api/embeds/oembed/route.ts`**: Endpoint proxy para obtener el HTML de Twitter e Instagram.
* **`src/app/api/discord/messages/route.ts`**: Endpoint `GET` (leer canal) y `POST` (enviar mensaje al canal).

### 3. Componentes de Frontend
* **`src/components/social-embed.tsx`**: Componente visual para renderizar tweets y posts de Instagram con estilo retro y skeleton de carga.
* **`src/components/discord-chat.tsx`**: Widget interactivo de chat sincronizado con Discord.
* Integrar `<SocialEmbed />` en los componentes de foros y momentos.
* Disparar `notifyDiscordCheckpoint` en `award_xp` o en los commits de la biblioteca.

### 4. Verificación
* Ejecutar `npm run check` asegurando 0 errores de TypeScript, ESLint y tests unitarios.
* Desplegar a Vercel con `npx vercel --prod`.
