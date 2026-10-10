# Especificación Técnica: Rastreador de Juegos Indie y Notificaciones de Versión (Itch.io Tracker)

**Fecha:** 9 de octubre de 2026  
**Origen:** Auditoría e Investigación (`research/antigravity`)  
**Destino:** Implementación en Savestate (`savestate 2` / Codex)  
**Propósito:** Permitir a los usuarios rastrear cualquier juego de `itch.io` desde su perfil de Savestate, monitorizar versiones nuevas (devlogs/parches), llevar su progreso personal y recibir alertas automáticas en la web y en Discord.

---

## 1. Visión General de la Función

Los juegos independientes en itch.io (visual novels, juegos episódicos, acceso anticipado) se actualizan frecuentemente sin un cliente centralizado. Esta función agrega un módulo en el Perfil del Jugador que:
1. **Rastrea la URL de cualquier juego de itch.io**: Obtiene automáticamente portada, título, autor, capturas y devlogs mediante `/data.json` y `/devlog.rss`.
2. **Alerta de Nuevas Versiones**: Detecta cuando se publica un devlog o versión nueva (ej: cuando *Starmaker Story* pase de `v1.8E` a `v1.9`).
3. **Notificación Dual (Web + Discord)**:
   - **Savestate**: Notificación en el buzón/campanita (`/notifications`).
   - **Discord**: Mensaje embed enriquecido mediante el bot/webhook ya configurado en Savestate.
4. **Seguimiento de Progreso Personalizado**:
   - Selector de "Versión que juegas" vs. "Última versión disponible".
   - Estado de juego (*Jugando*, *Completado*, *Esperando versión*).
   - Lista de hitos/objetivos con casillas de verificación (Checklist) y barra de porcentaje.
   - Notas privadas para partidas guardadas (slots, decisiones, claves).

---

## 2. Flujo de Datos y Endpoints

### 2.1. Endpoints de itch.io Utilizados
Para cualquier juego `https://{usuario}.itch.io/{slug}`:
- **Metadatos e Imágenes:** `https://{usuario}.itch.io/{slug}/data.json`
- **Registro de Actualizaciones:** `https://{usuario}.itch.io/{slug}/devlog.rss`
- **Widget Interactivo Opcional:** `https://itch.io/embed/{game_id}?dark=true`

### 2.2. Nueva API Route en Savestate: `src/app/api/tracker/itch/route.ts`

#### `POST /api/tracker/itch/inspect`
Recibe `{ url: string }`.
1. Normaliza la URL (ej: `https://arvusgames.itch.io/starmakerstory`).
2. Realiza fetch a `/data.json` y al RSS `/devlog.rss`.
3. Devuelve:
```json
{
  "id": 2854233,
  "title": "Starmaker Story",
  "author": "Arvus Games",
  "coverImage": "https://img.itch.zone/...",
  "latestDevlog": {
    "title": "Starmaker 1.8D Bugfix",
    "link": "https://arvusgames.itch.io/starmakerstory/devlog/...",
    "pubDate": "2026-02-15T10:18:33.000Z"
  },
  "url": "https://arvusgames.itch.io/starmakerstory"
}
```

#### `POST /api/tracker/itch/check-updates`
Compara el último devlog registrado con el RSS actual.
Si detecta una entrada nueva:
1. Registra una notificación en el almacén de notificaciones de Savestate para el usuario.
2. Si `DISCORD_WEBHOOK_URL` está activo, envía un embed a Discord:
   - Titulo: `🔔 ¡Nueva actualización en itch.io!`
   - Campo: `Juego: Starmaker Story`
   - Campo: `Novedad: Starmaker 1.9 Release`
   - Enlace directo al parche/descarga.

---

## 3. Modelo de Dominio (`src/domain/itch-tracker.ts`)

```typescript
export interface ItchTrackedGame {
  id: string; // itch game id
  url: string;
  title: string;
  author: string;
  coverImage: string;
  currentPlayedVersion: string; // ej: "1.8E"
  latestDetectedVersion: string; // ej: "1.8E" o "1.9"
  latestDevlogTitle?: string;
  latestDevlogUrl?: string;
  latestDevlogDate?: string;
  status: 'playing' | 'waiting_update' | 'completed' | 'on_hold';
  milestones: { id: string; title: string; completed: boolean }[];
  privateNotes?: string;
  lastCheckedAt: string;
}
```

---

## 4. Componente de UI en el Perfil (`src/components/profile-indie-tracker.tsx`)

Ubicado dentro del Perfil (`/players/[username]` o pestaña dedicada en la biblioteca/perfil):
- **Formulario de Agregar:** Campo de entrada *"Pega cualquier enlace de itch.io..."* + botón *"Rastrear Juego"*.
- **Tarjeta de Juego Retro:**
  - Portada oficial con efecto scanline/borde cyber.
  - Indicador de estado:
    - 🟢 *Al día (v1.8E)* si la versión jugada coincide con la última.
    - 🟡 *¡Nueva versión disponible! (v1.9)* si el devlog tiene novedades.
  - **Barra de Progreso Personal:** Muestra el `%` de hitos completados.
  - **Checklist:** Botón para agregar hitos rápidos (ej: `Ruta Anna`, `Final Harem`, `Galería 100%`).
  - **Botón "Comprobar Actualizaciones":** Consulta manualmente el RSS y avisa si hay cambios.

---

## 5. Integración con el Bot de Discord (`src/domain/discord-bridge.ts`)

Se agrega la función helper:
```typescript
export async function notifyItchUpdateToDiscord(gameTitle: string, updateTitle: string, updateUrl: string) {
  // Envía un embed con el color acento retro (#ff5d96 o #8fccff) al webhook de Discord
}
```
