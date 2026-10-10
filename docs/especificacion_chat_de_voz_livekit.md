# Especificación Técnica: Implementación de Savestate Comms (Chat de Voz Web)

**Versión:** 1.0  
**Fecha:** 10 de octubre de 2026  
**Origen:** Arquitectura e Investigación (`research/antigravity`)  
**Destino:** Implementación (`savestate 2` / Codex)  

---

## 1. Variables de Entorno Requeridas

Obtenidas de forma gratuita en [cloud.livekit.io](https://cloud.livekit.io) (plan Free, sin tarjeta de crédito):
```env
LIVEKIT_URL=wss://tu-proyecto.livekit.cloud
LIVEKIT_API_KEY=APIxxxxxxxxx
LIVEKIT_API_SECRET=sec_xxxxxxxxx
NEXT_PUBLIC_LIVEKIT_URL=wss://tu-proyecto.livekit.cloud
```

*(Si las variables no están presentes aún, el sistema debe mostrar una pantalla de bienvenida retro invitando a configurarlas o permitiendo un modo de prueba local).*

---

## 2. Dependencias de Node.js

Para instalar en `savestate 2`:
```bash
npm install livekit-client livekit-server-sdk @livekit/components-react
```

---

## 3. Arquitectura de Archivos y Componentes

### 3.1. API Backend (`src/app/api/voice/token/route.ts`)
Genera un token JWT seguro con permisos de audio para el usuario logueado en Supabase:
* Valida sesión del usuario (autenticado en Savestate).
* Recibe: `{ channelId: string }` (ej: `ch-lobby`, `ch-coop`, `ch-chill`).
* Configura `AccessToken` con `canPublish: true` (micrófono), `canPublishData: true`, `canSubscribe: true`.
* Devuelve: `{ token: string, url: string }`.

### 3.2. Dominio y Canales Fijos (`src/domain/voice.ts`)
```typescript
export interface VoiceChannel {
  id: string;
  name: string;
  frequency: string; // ej: "88.5 MHz"
  description: string;
  maxParticipants: number;
  category: 'general' | 'gaming' | 'chill';
}

export const DEFAULT_VOICE_CHANNELS: VoiceChannel[] = [
  {
    id: 'ch-lobby',
    name: 'Lobby Central',
    frequency: '88.5 MHz',
    description: 'Punto de reunión general para charlar de novedades.',
    maxParticipants: 16,
    category: 'general',
  },
  {
    id: 'ch-squad',
    name: 'Escuadrón Co-op',
    frequency: '94.2 MHz',
    description: 'Coordinación táctica para partidas multijugador.',
    maxParticipants: 6,
    category: 'gaming',
  },
  {
    id: 'ch-chill',
    name: 'Zona Retro & Chill',
    frequency: '101.7 MHz',
    description: 'Música, novelas visuales y charlas relajadas.',
    maxParticipants: 10,
    category: 'chill',
  },
];
```

### 3.3. Contexto Global de Voz (`src/contexts/voice-context.tsx`)
Mantiene la conexión activa a través de toda la aplicación Next.js:
* `activeChannel`: Canal actualmente sintonizado (o `null`).
* `isMuted`, `isDeafened`, `toggleMute()`, `toggleDeafen()`.
* `participants`: Lista de usuarios en la sala en tiempo real.
* `disconnect()`: Salir del canal.

### 3.4. Componentes Visuales
1. **Página Principal de Frecuencias (`src/app/community/voice/page.tsx`):**
   * Selector de canales con dial de sintonizador retro.
   * Vista de quién está conectado actualmente en cada frecuencia.
   * Botón *"Sintonizar Frecuencia"* / *"Conectar"*.
2. **Tarjeta de Participante con Ecualizador (`src/components/voice-participant.tsx`):**
   * Muestra el avatar del jugador con halo neón interactivo cuando habla.
   * Pequeñas barras de ecualizador (VU Meter) que se animan con decibelios reales.
   * Indicador de micrófono silenciado.
3. **Dock Flotante Persistente (`src/components/voice-dock.tsx`):**
   * Anclado en el layout principal (`src/app/layout.tsx`).
   * Solo visible cuando el usuario está en una llamada activa.
   * Muestra: `[📻 Sintonizado: CH-01 88.5 MHz]` + Botón Mute + Botón Deafen + Botón Rojo Desconectar.

---

## 4. Estilos Retro y Efectos CRT (`src/app/globals.css`)

```css
/* Ecualizador / VU Meter */
.vumeter-bars {
  display: inline-flex;
  gap: 2px;
  align-items: flex-end;
  height: 14px;
}
.vumeter-bar {
  width: 3px;
  background: var(--accent);
  border-radius: 1px;
  transition: height 0.1s ease;
}
.voice-speaking {
  box-shadow: 0 0 12px var(--accent);
  border-color: var(--accent) !important;
}
```
