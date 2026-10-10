# Investigación y Propuesta Técnica: Chat de Voz Web Retro-Cyber ("Savestate Comms")

**Fecha:** 10 de octubre de 2026  
**Área:** Comunicación en Tiempo Real, WebRTC y Experiencia de Usuario  
**Objetivo:** Diseñar un sistema de canales de voz interactivo integrado en la web (estilo Discord), pero con la personalidad, estética retro-cyber y arquitectura técnica de Savestate.

---

## 1. Visión y Concepto Temático

Discord utiliza un diseño minimalista, plano y gris. Para Savestate, el chat de voz no debe ser un clon genérico, sino sentirse como un **comunicador táctico de escuadrón, una radio de frecuencia arcade o un walkie-talkie cyber**:

```
+--------------------------------------------------------------------------+
|  [SAVESTATE COMMS // FRECUENCIA TÁCTICA]             🟢 EN LÍNEA: 4 JUG. |
+--------------------------------------------------------------------------+
|  CANALES DISPONIBLES:                                                    |
|  [►] CH-01: Lobby Arcade [88.5 MHz]  (2/10)                              |
|  [ ] CH-02: Co-op Squad  [94.2 MHz]  (0/4)                               |
|  [ ] CH-03: Chill & Lore [101.7 MHz] (2/8)                               |
|                                                                          |
|  CONECTADO A: CH-01 Lobby Arcade                                         |
|  ┌────────────────────────────────────────────────────────────────────┐  |
|  │  [AVATAR]  @Cristian131x   [ ▂▃▅▆▇ ] 🔊 HABLANDO (Glow Cyan)       │  |
|  │  [AVATAR]  @RetroPlayer    [ ░░░░░ ] 🔇 SILENCIADO                  │  |
|  └────────────────────────────────────────────────────────────────────┘  |
|                                                                          |
|  [🎙️ TRANSMITIR]   [🎧 ENSORDECER]   [⚙️ AJUSTES]   [❌ DESCONECTAR]    |
|  Ping: 24ms · Códec Opus 48kHz Stereo · Encriptado E2EE                  |
+--------------------------------------------------------------------------+
```

### 1.1. Metáforas Visuales y Sonoras
1. **Canales por Frecuencia:** En lugar de `#general`, los canales se organizan como frecuencias de radio (`CH-01: Lobby [88.5 MHz]`, `CH-02: Speedrun Co-op [94.1 MHz]`).
2. **VU Meter / Ecualizador Retro:** Cuando un usuario habla, en vez de un simple aro verde como Discord, su avatar emite un brillo de fósforo cyber y una pequeña barra de ecualizador gráfico (`▂▃▅▆`) vibra con su volumen.
3. **Efectos de Audio Analógico (Opcionales y Silenciables):**
   * Un leve *clic de walkie-talkie* o *chirp militar* al presionar la tecla de hablar o desconectarse.
4. **Dock Flotante Persistente:** Si el usuario entra a un canal de voz y navega al foro, perfiles o fichas de juegos, la barra de voz se mantiene en la esquina inferior (igual que en Discord).

---

## 2. Comparativa Técnica de Tecnologías de Voz en la Web

Para transmitir voz en tiempo real con baja latencia (<100ms) se utiliza el estándar **WebRTC** con el códec de audio de alta fidelidad **Opus**. Existen tres caminos arquitectónicos:

| Solución | Costo | Capacidad por Sala | Complejidad | Ventajas | Desventajas |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **A. LiveKit Cloud (Recomendada)** | **Gratis** (100 GB/mes) | Hasta 100+ personas | Baja (SDK oficial de React) | • Servidor SFU dedicado.<br>• Supresión de ruido AI.<br>• Detección nativa de quién habla.<br>• Hooks listos para React/Next.js. | Requiere cuenta gratuita en LiveKit Cloud. |
| **B. WebRTC P2P con Supabase Realtime** | **$0** (100% propio) | 2 a 5 personas máx. | Media / Alta | • Sin servicios externos ni límites.<br>• Corre directo sobre Supabase.<br>• STUN gratuito de Google. | Inviable para salas medianas o grandes (el ancho de banda sube exponencialmente $O(N^2)$). |
| **C. Daily.co / Agora** | Gratis (10,000 min/mes) | 50+ personas | Media | • Estable.<br>• Componentes preconstruidos. | El SDK añade peso y el límite en minutos se consume rápido con varios usuarios. |

---

## 3. Arquitectura Recomendada: LiveKit Cloud + Componentes Retro Propios

### ¿Por qué LiveKit Cloud es la opción perfecta para Savestate?
1. **El plan gratuito es gigantesco para audio:** La voz comprimida en Opus consume apenas `30-50 kbps`. Con **100 GB al mes de ancho de banda gratis**, LiveKit permite **más de 4,500 horas de chat de voz al mes sin pagar un solo centavo**.
2. **SDK nativo para Next.js y React:** Paquetes `@livekit/components-react` y `livekit-client`.
3. **Cero consumo de CPU en el servidor de Savestate:** El streaming de audio ocurre en la infraestructura global de LiveKit; Savestate solo genera un token JWT firmado de acceso (un endpoint ligero de Next.js que toma 10ms).
4. **Control total de la UI:** No estamos atados a una interfaz prediseñada. Usamos los hooks de LiveKit (`useIsSpeaking`, `useParticipants`, `useTrackToggle`) para renderizar componentes 100% personalizados con el estilo terminal cyber de Savestate.

---

## 4. Flujo de Datos y Conexión

```
┌────────────────┐                     ┌────────────────────────┐
│  Navegador     │  1. Entrar a canal  │  Savestate API         │
│  (Savestate)   ├────────────────────►│  /api/voice/token      │
│                │                     │  (Genera JWT LiveKit)  │
│                │◄────────────────────┤                        │
│                │  2. Token de acceso └────────────────────────┘
│                │
│                │  3. Conexión WebRTC SFU
│                ▼
│         ┌─────────────────────────────────┐
│         │   LiveKit Cloud WebRTC Server   │
│         │   (Ruteo de voz de baja lat.)   │
│         └───────┬─────────────────┬───────┘
│                 │                 │
│                 ▼                 ▼
│          [Jugador 2 (PC)]  [Jugador 3 (Móvil)]
```

### 4.1. Generación del Token de Canal (`src/app/api/voice/token/route.ts`)
Cuando un usuario hace clic en *"Conectarse a CH-01"*:
```typescript
import { AccessToken } from 'livekit-server-sdk';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { channelId, username } = await request.json();

  const at = new AccessToken(
    process.env.LIVEKIT_API_KEY,
    process.env.LIVEKIT_API_SECRET,
    { identity: username }
  );

  at.addGrant({
    roomJoin: true,
    room: channelId,
    canPublish: true,
    canSubscribe: true,
  });

  return NextResponse.json({ token: await at.toJwt() });
}
```

---

## 5. Características del Chat de Voz ("Savestate Comms")

### 5.1. Controles Esenciales del Jugador
* **Modo Transmisión:**
  * **Activación por Voz:** Detector automático con umbral de decibelios personalizable.
  * **Pulsar para Hablar (Push-To-Talk):** Permite configurar una tecla (ej. `Espacio`, `V`, `Ctrl`) para transmitir solo mientras se mantiene presionada.
* **Mute / Unmute:** Silenciar micrófono al instante con atajo de teclado.
* **Deafen (Ensordecer):** Silenciar todo el canal si el jugador necesita concentrarse en una cinemática del juego.
* **Volumen Individual por Participante:** Cada jugador puede ajustar el volumen de otros miembros si alguien habla muy bajo o muy alto.

### 5.2. Indicador de Habla Dinámico (VU Meter)
LiveKit proporciona el hook `useIsSpeaking(participant)`. Cuando devuelve `true`:
* La tarjeta del usuario se resalta con `border: 1px solid var(--accent); box-shadow: 0 0 10px rgba(0, 255, 200, 0.4);`.
* Se activa la animación CSS del ecualizador:
```css
@keyframes vumeter {
  0% { height: 4px; }
  50% { height: 16px; }
  100% { height: 8px; }
}
.voice-speaking-bar {
  animation: vumeter 0.2s infinite ease-in-out;
  background: var(--accent);
}
```

### 5.3. Dock Flotante Inferior (Comms Bar)
Un componente anclado al pie de página (Layout global):
* Permite navegar por toda la web de Savestate (leer hilos, ver guías, perfiles) sin que la llamada de voz se corte.
* Muestra el nombre del canal activo, los avatares que están hablando y el botón rojo `[Desconectar]`.

---

## 6. Plan de Implementación por Fases

### Fase 1: Motor WebRTC y Token Backend
* Crear cuenta gratuita en LiveKit Cloud y registrar las variables (`LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`).
* Endpoint `/api/voice/token` para generar pases de sala.

### Fase 2: Componente de Sala y Canales Fijos
* Crear la vista de canales de voz en `/community/voice` o en la barra lateral.
* Lista de 3 canales predefinidos (`Lobby Arcade`, `Co-op Escuadrón`, `Chill & RPGs`).
* Lista de miembros conectados en tiempo real con avatares e indicadores de mute.

### Fase 3: Dock Flotante Global y Personalización de Audio
* Montar el reproductor persistente en el layout para no perder la conexión al navegar.
* Selector de micrófono y prueba de eco (Loopback test).
* Ajuste de volumen individual por usuario.
* Configuración de *Pulsar para Hablar* (Push-to-Talk).

---

## 7. Conclusión

Implementar un chat de voz propio no solo es **100% viable y gratuito** (gracias al modelo SFU de LiveKit Cloud para audio), sino que transformará a Savestate: dejará de ser una simple web de perfiles para convertirse en un **punto de encuentro gamer completo**, donde los usuarios pueden jugar partidas cooperativas, charlar y coordinar partidas mientras navegan por la plataforma.
