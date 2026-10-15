# Especificación Técnica: Actualización de Directos de Worlds 2026 — Reemplazo LLA por YouTube y Retiro de Demacia Cup (`/worlds`)

## 1. Contexto y Objetivos

### 1.1. Motivo del Cambio
- **Canal de Twitch `lla` inactivo**: Con la reestructuración de ligas de Riot Games y el cierre de la LLA, el canal de Twitch `https://www.twitch.tv/lla` ya no se encuentra en servicio ni transmite los eventos oficiales.
- **Reemplazo oficial por YouTube**: Se reemplazó la señal de *Español Latam* por la transmisión verificada en YouTube: `https://www.youtube.com/watch?v=iFmz2yFuQbw` (Video ID: `iFmz2yFuQbw`).
- **Retiro de "Demacia Cup" de la web**: A petición explícita del usuario, la señal y enlaces hacia "Demacia Cup" se retiraron completamente de la plataforma para mantener el foco 100% exclusivo en los Worlds 2026 y sus tres señales canónicas oficiales.

---

## 2. Decisiones de Arquitectura y Seguridad

### 2.1. Catálogo Oficial de Señales (`src/domain/worlds-features.ts`)
Se formalizó el modelo de señales con soporte directo para las plataformas de emisión (`twitch` y `youtube`):
```typescript
export interface WorldsBroadcastSignal {
  id: string;
  label: string;
  kind: 'twitch' | 'youtube';
  channel?: string;
  videoId?: string;
  href: string;
}
```

El catálogo canónico `WORLDS_BROADCAST_SIGNALS` define las 3 señales oficiales de Worlds:
1. `lvpes`: `🇪🇸 Español · LVPes` (`kind: 'twitch'`, `channel: 'lvpes'`, `https://www.twitch.tv/lvpes`).
2. `latam-yt`: `🇲🇽 Español Latam · YouTube` (`kind: 'youtube'`, `videoId: 'iFmz2yFuQbw'`, `https://www.youtube.com/watch?v=iFmz2yFuQbw`).
3. `riotgames`: `🇺🇸 Inglés oficial · Riot Games` (`kind: 'twitch'`, `channel: 'riotgames'`, `https://www.twitch.tv/riotgames`).

Se excluye `demacia-cup` y `lla`. `DEFAULT_WORLDS_BROADCAST_SIGNAL` provee el fallback seguro a `lvpes` y `findWorldsBroadcastSignal(id)` garantiza tipado estricto sin valores `undefined`.

### 2.2. Construcción Segura de URLs para `iframe` (`buildWorldsFrameUrl`)
La función pura `buildWorldsFrameUrl(signal, hostname, activeVodId)`:
- Si hay un VOD activo, construye el embed seguro en `https://www.youtube-nocookie.com/embed/{activeVodId}`.
- Si la señal es de YouTube (`latam-yt`), genera `https://www.youtube-nocookie.com/embed/{videoId}?autoplay=0&rel=0`.
- Si la señal es de Twitch (`lvpes`, `riotgames`), construye `https://player.twitch.tv/?channel={channel}&parent={hostname}&autoplay=false`.

### 2.3. Experiencia de Usuario en el Hub (`src/components/worlds-hub.tsx`)
- **Barra de selección de señal**: Botones limpios que alternan entre `🇪🇸 Español · LVPes`, `🇲🇽 Español Latam · YouTube` y `🇺🇸 Inglés oficial · Riot Games`, además de los botones `🎬 Juego X` cuando hay VODs disponibles.
- **Sin rastros de Demacia Cup**: Se eliminaron botones, enlaces y tabs de Demacia Cup en toda la interfaz de Worlds.
- **Botonera inferior**: Enlaces a `LoL Esports Live ↗`, enlace directo a la transmisión activa en su plataforma nativa (`Twitch` o `YouTube`), y enlace al canal oficial de YouTube de LoL Esports.

---

## 3. Pruebas Unitarias y Verificación

En `tests/unit/worlds-features.test.ts`:
- Se valida la existencia exacta de `lvpes`, `latam-yt` y `riotgames`.
- Se valida que ni `demacia-cup` ni `lla` formen parte del catálogo de señales.
- Se comprueba la construcción de embeds nativos de YouTube, Twitch y VODs oficiales.
