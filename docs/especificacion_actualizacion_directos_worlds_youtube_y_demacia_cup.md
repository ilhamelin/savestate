# Especificación Técnica: Actualización de Directos de Worlds 2026 — Reemplazo LLA por YouTube y Señal Demacia Cup (`/worlds`)

## 1. Contexto y Objetivos

### 1.1. Motivo del Cambio
- **Canal de Twitch `lla` inactivo**: Con la reestructuración de ligas de Riot Games y el cierre de la LLA, el canal de Twitch `https://www.twitch.tv/lla` ya no se encuentra en servicio ni transmite los eventos oficiales.
- **Reemplazo oficial por YouTube**: Se solicitó reemplazar la señal de *Español Latam* por la transmisión verificada en YouTube: `https://www.youtube.com/watch?v=iFmz2yFuQbw` (Video ID: `iFmz2yFuQbw`).
- **Incorporación de Demacia Cup**: Se solicitó habilitar una pestaña/acceso directo para seguir la señal oficial de la Demacia Cup en LoL Esports: `https://lolesports.com/es-MX/live/demacia_cup/104481098073348078`.

---

## 2. Decisiones de Arquitectura y Seguridad

### 2.1. Tipado y Catálogo Extensible de Señales (`src/domain/worlds-features.ts`)
Se formalizó el modelo de señales con discriminante `kind`:
```typescript
export interface WorldsBroadcastSignal {
  id: string;
  label: string;
  kind: 'twitch' | 'youtube' | 'external';
  channel?: string;
  videoId?: string;
  href: string;
}
```

El catálogo canónico `WORLDS_BROADCAST_SIGNALS` define las 4 señales oficiales:
1. `lvpes`: `🇪🇸 Español · LVPes` (`kind: 'twitch'`, `channel: 'lvpes'`, `https://www.twitch.tv/lvpes`).
2. `latam-yt`: `🇲🇽 Español Latam · YouTube` (`kind: 'youtube'`, `videoId: 'iFmz2yFuQbw'`, `https://www.youtube.com/watch?v=iFmz2yFuQbw`).
3. `riotgames`: `🇺🇸 Inglés oficial · Riot Games` (`kind: 'twitch'`, `channel: 'riotgames'`, `https://www.twitch.tv/riotgames`).
4. `demacia-cup`: `🏆 Demacia Cup · LoL Esports` (`kind: 'external'`, `https://lolesports.com/es-MX/live/demacia_cup/104481098073348078`).

### 2.2. Construcción Segura de URLs para `iframe` (`buildWorldsFrameUrl`)
La función pura `buildWorldsFrameUrl(signal, hostname, activeVodId)`:
- Si hay un VOD activo, construye el embed seguro en `https://www.youtube-nocookie.com/embed/{activeVodId}`.
- Si la señal es de YouTube (`latam-yt`), genera `https://www.youtube-nocookie.com/embed/{videoId}?autoplay=0&rel=0`.
- Si la señal es de Twitch (`lvpes`, `riotgames`), construye `https://player.twitch.tv/?channel={channel}&parent={hostname}&autoplay=false`.
- Si la señal es externa (`demacia-cup`), devuelve su URL canónica.

### 2.3. Política de Seguridad de Contenido (`src/proxy.ts`)
Se agregó `https://lolesports.com` a la directiva `frame-src` del CSP:
```text
frame-src 'self' https://player.twitch.tv https://www.youtube.com https://www.youtube-nocookie.com https://lolesports.com https://platform.twitter.com https://www.instagram.com;
```

### 2.4. Experiencia de Usuario en el Hub (`src/components/worlds-hub.tsx`)
- **Pestaña en barra de señales**: Las señales locales renderizan botones interactivos que alternan el reproductor embebido. La señal de la Demacia Cup renderiza un botón/pestaña con atributo `target="_blank" rel="noopener noreferrer"` con ícono `↗`, abriendo de inmediato la transmisión en una nueva pestaña del navegador.
- **Enlaces de acceso rápido**: Al pie del reproductor se mantienen los enlaces directos a `LoL Esports Live`, `🏆 Demacia Cup Live`, la señal activa actual y el canal de YouTube.

---

## 3. Pruebas Unitarias y Verificación

En `tests/unit/worlds-features.test.ts`:
- Se valida la existencia de `lvpes`, `latam-yt`, `riotgames` y `demacia-cup`.
- Se valida que `lla` no se encuentre presente en el catálogo.
- Se comprueba la construcción de embeds de YouTube, Twitch y señal externa.
- Se verifica la inclusión estricta de `https://lolesports.com` dentro de la directiva `frame-src` del CSP de `src/proxy.ts`.
