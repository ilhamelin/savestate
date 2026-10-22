# SPEC-04: Retro Radio Deck & Reproductor Cassette Personalizado (Chiptune / Lo-Fi / Tu Propia Música)

> **Documento:** Especificación Técnica Quirúrgica de Entrega  
> **Rama de Especificación:** `research/antigravity`  
> **Rama Destino de Implementación:** `implementation/chatgpt` (crear `feature/retro-radio-deck`)  
> **Destinatario:** OpenAI Codex / Lead Engineer  
> **Prioridad:** Alta (Retención In-App, Inmersión Gamer, 0 Costo Servidor, 0 Responsabilidad Copyright)

---

## 1. Objetivo y Contexto

SaveState es un diario gamer inmersivo. Mientras el usuario explora el catálogo, consulta guías, revisa fichas técnicas o gestiona su biblioteca de juegos, una banda sonora retro complementa la experiencia sin obligarlo a abandonar la pestaña o abrir Spotify/YouTube.

Esta especificación detalla la implementación de un **Dock de Audio Retro Flotante y Persistente en la Barra Inferior** con dos modalidades principales y un procesador de audio DSP integrado:

1. **Modo Radio Chiptune / Lofi Gamer:**
   * **Sintetizador 8-bit Procedimental:** Generación de arpegios y melodías retro en tiempo real utilizando la API nativa `AudioContext` de los navegadores (osciladores `square` y `sawtooth`). **0 descargas, 0 bytes de ancho de banda, 0 problemas de licencias**.
   * **Emisoras Curadas:** Selección entre Chiptune 8-bit, Lo-fi Ambient y Synthwave nocturno.
2. **Modo Cassette Deck ("Tu Propia Música" - Local):**
   * El usuario puede arrastrar o cargar sus propios archivos de música locales (`.mp3`, `.ogg`, `.flac`, `.wav`, etc.).
   * Se reproduce directamente en el navegador mediante `URL.createObjectURL(file)` y el nodo `HTMLAudioElement`.
   * **100% Privado y Gratuito:** Los archivos del usuario **nunca** se suben a Vercel ni a Supabase. Costo de almacenamiento = $0, ancho de banda = $0, sin riesgos de derechos de autor ni cuotas de API.
3. **Filtros de Procesamiento de Audio Vintage (DSP BiquadFilterNode):**
   * **Hi-Fi Master:** Sonido limpio, bypass directo.
   * **Game Boy / GBA Speaker:** Filtro pasa-banda (*Bandpass* ~800 Hz - 3.5 kHz) que emula la fidelidad de altavoz mono de una consola portátil clásica de los 90.
   * **Warm Tape / Cassette:** Filtro pasa-bajos suave (~4.2 kHz) con calidez analógica.
   * **Lofi Rain FX:** Capa sutil opcional de ruido ambiental simulando lluvia o crepitar de vinilo.
4. **Visualizador de Espectro Dinámico (VU Meter / Equalizer):**
   * 8 a 12 barras animadas conectadas a un `AnalyserNode` en tiempo real con degradado Cyberpunk (Cian `#00f0ff` -> Magenta `#ff0055` -> Ámbar `#ffe600`).
5. **Persistencia y Experiencia de Usuario en Next.js:**
   * Montado en el `RootLayout` (`src/app/layout.tsx`). Gracias al modelo de navegación SPA de Next.js App Router, **la música no se corta ni reinicia al cambiar de página** (por ejemplo, navegando de `/` a `/explore` o `/library`).
   * **Modo Minimizador:** Se pliega en una discreta cápsula retro `[ 📼 Chiptune 44.1kHz ▶ ]` para no obstruir botones ni contenido en pantallas reducidas.
   * Atajos de teclado rápidos: `Espacio` (play/pause con foco en dock), `M` (mute/unmute instantáneo).

---

## 2. Lista Exacta de Archivos a Crear / Modificar

| Acción | Archivo | Responsabilidad |
|---|---|---|
| **Crear** | `src/domain/retro-audio.ts` | Definición de tipos TypeScript, emisoras predefinidas, presets de filtros DSP y validaciones. |
| **Crear** | `src/lib/retro-audio/synth-chiptune.ts` | Sintetizador de Web Audio 8-bit procedimental ligero (sin dependencias npm). |
| **Crear** | `src/lib/retro-audio/audio-engine.ts` | Singleton / controlador de Web Audio (`AudioContext`, `AnalyserNode`, `BiquadFilterNode`, `HTMLAudioElement`). |
| **Crear** | `src/components/retro-radio/retro-radio-deck.tsx` | Componente de cliente Next.js principal (Barra expandida, modo cápsula minimizada, controles y display LCD). |
| **Crear** | `src/components/retro-radio/cassette-slot.tsx` | Dropzone y selector de archivos locales (`<input type="file" accept="audio/*">`) con animación de inserción de cinta. |
| **Crear** | `src/components/retro-radio/equalizer-visualizer.tsx` | Renderizador del espectro de audio (Canvas 2D o barras SVG/CSS reactivas al `AnalyserNode`). |
| **Crear** | `src/styles/retro-radio.css` | Estilos retro scanline, animación de bobinas giratorias de cassette, display LCD fluorescente y dock flotante. |
| **Modificar** | `src/app/layout.tsx` | Importar y montar `<RetroRadioDeck />` al final del body en vistas no-standalone. |
| **Crear** | `tests/unit/retro-audio.test.ts` | Pruebas unitarias para el dominio de audio, presets de ecualización, persistencia en `localStorage` y manejo de archivos de audio. |

---

## 3. Contratos de Tipos Estrictos (TypeScript)

En `src/domain/retro-audio.ts`:

```typescript
export type AudioFilterPreset = 'hifi' | 'gameboy' | 'tape_warmth';

export type RadioStationId = 'chiptune_procedural' | 'lofi_ambient' | 'synthwave_pulse' | 'user_cassette';

export interface RadioStation {
  id: RadioStationId;
  name: string;
  genre: string;
  description: string;
  isProcedural: boolean;
  streamUrl?: string;
}

export interface UserCassetteTrack {
  name: string;
  fileSize: number;
  format: string; // 'mp3', 'wav', 'ogg', 'flac', etc.
  objectUrl: string;
}

export interface RetroRadioState {
  isPlaying: boolean;
  isMuted: boolean;
  volume: number; // 0.0 a 1.0
  activeStationId: RadioStationId;
  activeFilter: AudioFilterPreset;
  isMinimized: boolean;
  rainFxEnabled: boolean;
  userTrack: UserCassetteTrack | null;
}

export const RADIO_STATIONS: RadioStation[] = [
  {
    id: 'chiptune_procedural',
    name: '8-Bit Odyssey',
    genre: 'Chiptune FM',
    description: 'Arpegios retro generados procedimentalmente con Web Audio osciladores.',
    isProcedural: true,
  },
  {
    id: 'lofi_ambient',
    name: 'Neo Akihabara',
    genre: 'Lo-Fi Chill',
    description: 'Melodías lentas y nostálgicas para concentrarse mientras organizas tu backlog.',
    isProcedural: true,
  },
  {
    id: 'synthwave_pulse',
    name: 'Cyber Horizon',
    genre: 'Outrun Synth',
    description: 'Bajos pulsantes y secuencias synthwave estilo 1986.',
    isProcedural: true,
  },
];

export const AUDIO_FILTER_CONFIGS: Record<
  AudioFilterPreset,
  { label: string; filterType: BiquadFilterType; frequency: number; Q: number }
> = {
  hifi: {
    label: 'Hi-Fi Master',
    filterType: 'allpass',
    frequency: 20000,
    Q: 1,
  },
  gameboy: {
    label: 'Game Boy Speaker',
    filterType: 'bandpass',
    frequency: 1800,
    Q: 1.8,
  },
  tape_warmth: {
    label: 'Cassette Warmth',
    filterType: 'lowpass',
    frequency: 4200,
    Q: 0.7,
  },
};
```

---

## 4. Algoritmo y Flujo de Lógica Paso a Paso

### 4.1. Respeto al Autoplay Policy de los Navegadores
1. Los navegadores modernos bloquean cualquier reproducción automática sin interacción previa del usuario (`AudioContext was not allowed to start`).
2. El reproductor inicia en estado `isPlaying: false`.
3. Al hacer clic por primera vez en **Play** o al seleccionar una emisora/casete:
   ```typescript
   if (audioContext.state === 'suspended') {
     await audioContext.resume();
   }
   ```
4. El estado visual se sincroniza de inmediato reflejando la reproducción en marcha.

### 4.2. Topología del Grafo de Web Audio (Audio Graph)
El motor de audio (`audio-engine.ts`) conecta los nodos en la siguiente cadena:
```
[Fuente de Audio]
 (Sintetizador Procedural O <audio> de Casete Local)
         │
         ▼
[Rain FX Generator] (Opcional, nodo de ruido blanco filtrado con ganancia baja 0.03)
         │
         ▼
[BiquadFilterNode] (Hi-Fi: allpass / Game Boy: bandpass 1.8kHz / Tape: lowpass 4.2kHz)
         │
         ▼
[AnalyserNode] (fftSize: 64, smoothingTimeConstant: 0.8) ───► [Equalizer Visualizer Canvas]
         │
         ▼
[Master GainNode] (Control de volumen 0.0 - 1.0 y silenciado)
         │
         ▼
[AudioContext.destination] (Altavoces / Auriculares)
```

### 4.3. Carga y Desecho de Casetes Locales (Zero Memory Leaks)
1. El usuario arrastra un archivo de audio o usa el input de archivo:
   ```typescript
   const handleFile = (file: File) => {
     if (!file.type.startsWith('audio/') && !/\.(mp3|wav|ogg|flac|m4a|aac)$/i.test(file.name)) {
       return; // Formato no compatible
     }
     // Liberar URL previa para evitar fuga de memoria en el navegador
     if (currentTrack?.objectUrl) {
       URL.revokeObjectURL(currentTrack.objectUrl);
     }
     const objectUrl = URL.createObjectURL(file);
     audioEngine.loadMediaSource(objectUrl);
     setUserTrack({
       name: file.name.replace(/\.[^/.]+$/, ''),
       fileSize: file.size,
       format: file.name.split('.').pop()?.toUpperCase() ?? 'AUDIO',
       objectUrl,
     });
     setActiveStationId('user_cassette');
     audioEngine.play();
   };
   ```
2. Al desmontar el componente o cerrar la pestaña, se llama `URL.revokeObjectURL`.

### 4.4. Sintetizador Procedural Chiptune (8-bit)
1. Para el modo `chiptune_procedural`, un temporizador de intervalos programa notas en una escala pentatónica menor (frecuencias base `[220, 261.63, 293.66, 329.63, 392, 440, 523.25]`).
2. Se instancian nodos `OscillatorNode` de tipo `'square'` (melodía) y `'sawtooth'` (bajo) con envolventes rápidas de decay (`gain.exponentialRampToValueAtTime`).
3. Esto garantiza que la radio suene inmediatamente al encenderse, **incluso sin conexión a internet y sin descargar ningún archivo externo**.

### 4.5. Persistencia y Navegación sin Cortes en Next.js
1. `<RetroRadioDeck />` se monta una sola vez en `src/app/layout.tsx` dentro de `<body>`.
2. Las transiciones entre páginas (`/explore`, `/library`, `/players/saturn`, etc.) en Next.js App Router son navegaciones cliente suaves (*Soft Navigation*), por lo que `RootLayout` **no se desmonta ni se refresca**.
3. Las preferencias del usuario se guardan en `localStorage`:
   * `savestate_radio_minimized`: booleano.
   * `savestate_radio_volume`: flotante entre 0.0 y 1.0.
   * `savestate_radio_filter`: `'hifi' | 'gameboy' | 'tape_warmth'`.
   * `savestate_radio_rain`: booleano.

---

## 5. Diseño Visual y Estilos (Retro Cyberpunk & Cassette Deck)

1. **Chasis de Cassette:**
   * Fondo oscuro metálico `#0c1017` con borde de neón cian `#00f0ff` y sombra glow `box-shadow: 0 -4px 20px rgba(0, 240, 255, 0.15)`.
   * Ventana de cinta cassette con dos bobinas circulares (spools) con pequeños dientes que rotan continuamente (`animation: spin-cassette 3s linear infinite`) cuando la música está activa.
2. **Display LCD Retro:**
   * Tipografía `--font-pixel` (Silkscreen) o monospace (`JetBrains Mono`).
   * Color verde fósforo `#00ff88` o cian eléctrico sobre display digital con efecto scanlines.
   * Muestra: `[STATION / CASSETTE]`, frecuencia `44.1 kHz`, duración/tiempo transcurrido y modo de ecualizador activo.
3. **Selector de Efecto DSP:**
   * 3 micro-botones conmutadores retro estilo interruptor táctil:
     * `[ HI-FI ]`
     * `[ GAME BOY ]` (aplica el filtro bandpass con sonido de parlante nostálgico)
     * `[ TAPE ]`
4. **Cápsula Minimizada (Float Pill):**
   * En la esquina inferior derecha `bottom: 1.25rem; right: 1.25rem; z-index: 50`.
   * Píldora compacta: `[ 📼 SaveState Radio · 8-Bit ▶ ]` con ecualizador miniatura animado de 4 barras. Un clic la expande al deck completo.
   * En móviles, la barra se pliega para no obstruir el teclado ni menús inferiores.

---

## 6. Criterios de Aceptación Deterministas y Casos Borde

1. **Cero Dependencias Pesadas:** No usar Howler.js, Tone.js ni paquetes externos pesados. Utilizar exclusivamente el estándar nativo Web Audio API del navegador. Incremento de bundle estimado < 8 KB.
2. **Gestión de Memoria y Rendimiento:**
   * Cada archivo local de música cargado revoca su `objectUrl` anterior con `URL.revokeObjectURL()`.
   * Si el usuario pausa la reproducción, el bucle de animación del ecualizador (`requestAnimationFrame`) se cancela para mantener el uso de CPU en 0%.
3. **Manejo de Errores de Audio:**
   * Si un archivo arrastrado no es de audio o falla la decodificación, mostrar un mensaje en el display LCD: `ERR: INVALID CASSETTE FORMAT` y restablecer sin romper la interfaz.
4. **Respeto a Preferencias del Sistema:**
   * Si el usuario tiene `prefers-reduced-motion: reduce`, las bobinas de cassette permanecen estáticas y el visualizador reduce su tasa de refresco a barras fijas.
5. **Suite de Pruebas Unitarias (`tests/unit/retro-audio.test.ts`):**
   * Validar inicialización de estado de la radio con valores por defecto seguros.
   * Validar configuración de frecuencias y tipos para los filtros `hifi`, `gameboy` y `tape_warmth`.
   * Validar serialización y deserialización de preferencias en `localStorage`.
   * Validar función de sanitización y extracción de metadatos de archivos de audio locales.
6. **Verificación de Calidad CI en GitHub Actions:**
   * `npm run lint` sin advertencias.
   * `npx tsc --noEmit` sin errores de tipado.
   * `npm test` exitoso en todos los tests (>= 348 tests).
