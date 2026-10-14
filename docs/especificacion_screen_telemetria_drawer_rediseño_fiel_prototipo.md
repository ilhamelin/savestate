# Especificación Técnica: Rediseño Fiel de la Ficha de Telemetría Lateral ("TELEMETRÍA // TV") en Screen (`/screen`)

## 1. Resumen y Objetivos

Alinear visual y funcionalmente el panel lateral de telemetría de series y películas (`ScreenTelemetryDrawer`) con el prototipo de alta fidelidad provisto por el usuario, preservando todas las funcionalidades existentes (guardado de progreso, calificación, checklist de episodios, tráiler, sincronización de radar y compartir en Chat Global):

1. **Cabecera Ciberpunk / HUD**:
   - `// TELEMETRÍA DETALLADA`: Badge con borde cian neón y tipografía monospace.
   - `[ LIVE HUD ]`: Badge verde esmeralda brillante (`#00ff66`) a la derecha.
   - Botón de cierre `[ ✕ ]` integrado en la esquina superior derecha.
2. **Backdrop y Cabecera de la Serie**:
   - Arte oficial con bordes redondeados (6px) y viñeta sutil.
   - Título de la obra en tipografía bold nítida.
   - Subtítulo de estudio / creador en cian: `Studio Trigger × CD Projekt Red` (obtenido de `adaptation.developerOrPublisher` o credits).
3. **Píldoras de Metadatos Enriquecidas**:
   - Fila 1: `[ 10 Episodios ]` · `[ 24 min/ep ]` · `[ 2022 ]` (pastillas oscuras `#111a24` con texto claro).
   - Fila 2: `[ Dual Audio (JP/LAT) ]` o `[ Audio Original + Doblaje ]` en pastilla con borde cian.
4. **Botonera Rápida de Acciones**:
   - `[ ✓ Siguiendo en Radar ]` / `[ 🔔 Seguir en Radar ]`.
   - `[ ▶ Ver Tráiler ]` (reproductor modal YouTube).
5. **Estado en tu Bitácora (Grid 2x2 de Checkpoints)**:
   - Encabezado: `ESTADO EN TU BITÁCORA:` (monospace).
   - 4 botones estilizados con iconos:
     - `👁 Viendo (ACTIVO)` -> Estado seleccionado: borde y texto cian con resplandor neón (`border: 1px solid #00f0ff; box-shadow: 0 0 10px rgba(0, 240, 255, 0.3)`).
     - `🔖 Por ver (Backlog)`
     - `✓ Completada`
     - `✕ Abandonada`
6. **Tu Calificación Personal**:
   - Encabezado: `TU CALIFICACIÓN PERSONAL`.
   - 5 estrellas doradas (`⭐`) con escala de puntuación: `4.5 / 5.0` (o `9.0 / 10.0`).
   - Botón lateral para abrir/editar notas privadas.
7. **Checklist // Temporada X**:
   - Encabezado: `📑 CHECKLIST // TEMPORADA X` a la izquierda y `X / Y VISTOS` en negrita cian/esmeralda a la derecha.
   - Selector discreto de temporada si la serie tiene más de 1 temporada.
   - Lista de episodios:
     - Checkbox cian estilizado.
     - Si está visto: número y título con tachado suave (`text-decoration: line-through; opacity: 0.65;`) y badge `VISTO` en verde esmeralda `#00ff66`.
     - Si no está visto: texto limpio con fecha de emisión o duración.
8. **Dónde Ver Hoy (JustWatch)**:
   - Encabezado: `DÓNDE VER HOY:` a la izquierda y `Powered by JustWatch` a la derecha.
   - Tarjeta de plataforma de streaming:
     - Badge/logo oficial (ej. `NETFLIX`).
     - Calidad y audio: `4K Ultra HD & Dolby Atmos` / `Sub y Doblaje disponibles`.
     - Icono externo `↗` con enlace a JustWatch.
9. **Tarjeta Destacada de IP Original / Juego Base**:
   - Si la obra es una adaptación de videojuego (`adaptation`):
     - Encabezado: `🎮 IP ORIGINAL // [NOMBRE DEL JUEGO]`.
     - Texto de lore/horas registradas en SaveState.
     - Botón directo: `Ir a ficha de juego de [Juego] →`.
10. **Compartir en Chat Global**:
    - Botón `[ 💬 Compartir en Chat Global ]` con toast de confirmación `¡Compartido en el Chat Global! [Ir al chat →]`.
11. **Barra de Telemetría Inferior**:
    - `🟢 SYNC: CLOUD OK` a la izquierda.
    - `LATENCY: 14MS // CORE-04` a la derecha.
12. **Scrollbar Suave**:
    - Reemplazar la barra nativa gruesa por una barra delgada y elegante (`scrollbar-width: thin; scrollbar-color: #00f0ff33 transparent`).

---

## 2. Componente `src/components/screen/screen-telemetry-drawer.tsx`

Se reestructura el renderizado manteniendo intactas las props y callbacks:
```tsx
export function ScreenTelemetryDrawer({
  detail,
  progress,
  busy,
  canEdit,
  onSave,
  onSeason,
  onToggle,
  onNotes,
  onClose,
  openMobile,
}: {
  detail: ScreenDetail;
  progress: ScreenUserProgress;
  busy: boolean;
  canEdit: boolean;
  onSave: (patch: Partial<ScreenUserProgress>) => void;
  onSeason: (season: number) => void;
  onToggle: (key: number) => void;
  onNotes: (notes: string) => void;
  onClose: () => void;
  openMobile: boolean;
})
```

---

## 3. Estilos en `src/app/screen.css`

- `.screen-drawer-heading`: Flex con el badge `// TELEMETRÍA DETALLADA` a la izquierda y `[ LIVE HUD ]` con el botón de cierre a la derecha.
- `.screen-drawer-pills`: Flex wrap de píldoras `#111a24` y píldora especial cian para audio dual.
- `.screen-drawer-status-grid`: Grid 2 columnas x 2 filas con botones interactivos y hover/active neón.
- `.screen-drawer-rating-row`: Flex con estrellas doradas, puntaje numérico y botón de notas.
- `.screen-drawer-checklist-header`: Justify between con contador de vistos.
- `.screen-drawer-episode-item`: Checkbox cian, tachado suave cuando está visto y etiqueta verde neón `VISTO`.
- `.screen-drawer-where-card`: Tarjeta JustWatch con logo de plataforma, características 4K y enlace externo.
- `.screen-drawer-game-card`: Caja destacada con acento verde/cian para el juego base.
- `.screen-drawer-footer-hud`: Barra inferior con estado de sincronización y latencia.
