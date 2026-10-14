# Especificación Técnica: Modo Cine (Estilo YouTube), Reproducción en Segundo Plano y Catálogo Musical Worlds + K/DA (`/worlds`)

## 1. Resumen de Mejoras y Novedades

Esta actualización implementa tres mejoras clave en el hub de Worlds (`/worlds`):

1. **Incorporación de la Discografía de K/DA (Riot Games Music)**:
   - Se añade la discografía oficial del grupo virtual K/DA con sus videos y audios verificados en YouTube.
   - En el selector de temas, la música se organiza visualmente en grupos (`<optgroup>`):
     * 🏆 **Himnos Oficiales de Worlds** (11 pistas: 2014 a 2026).
     * 👑 **K/DA Universe (Riot Games)** (6 pistas: *POP/STARS*, *MORE*, *THE BADDEST*, *VILLAIN*, *DRUM GO DUM*, *I'LL SHOW YOU*).

2. **Reproducción Continua en Segundo Plano al Minimizar (Background Mini-Dock)**:
   - Al hacer clic en **Minimizar**, el audio no se interrumpe: el iframe se mantiene montado en el DOM en un contenedor oculto visualmente (`.worlds-music-stream-hidden`), permitiendo que el streaming de audio continúe sonando mientras el usuario navega y consulta información de los Worlds.
   - El widget se comprime a una elegante **barra flotante (mini-player dock)** en la esquina inferior con:
     * Icono y nombre de la pista actual: `🎵 [Año] · [Título]`.
     * Ecualizador visual animado `||||`.
     * Botón rápido `[⏸ / ▶]` para pausar o reanudar.
     * Botón `[▴ Expandir]` para restaurar el video completo sin reiniciar la reproducción.

3. **Mitigación de Restricciones Regionales (LatinAutor - UMPG / YouTube)**:
   - Se utiliza el dominio estándar `https://www.youtube.com/embed/` con `referrerPolicy="strict-origin-when-cross-origin"`.
   - Se incluye un enlace de escape destacado `[ ↗ Abrir en YouTube ]` junto con un mensaje claro si el sello discográfico bloquea el iframe en ciertos países de Latinoamérica.

---

## 2. Catálogo Oficial de Pistas Musicales

### A. Himnos Oficiales de Worlds (`WORLDS_ANTHEMS`)
```ts
export const WORLDS_ANTHEMS = [
  { category: 'anthem', year: 2026, title: 'Know My Name', artist: 'True Damage', id: 'mlFxxNsExJc' },
  { category: 'anthem', year: 2025, title: 'Sacrifice', artist: 'G.E.M.', id: 'pzt6SmvGpXk' },
  { category: 'anthem', year: 2024, title: 'Heavy Is The Crown', artist: 'Linkin Park', id: '5FrhtahQiRc' },
  { category: 'anthem', year: 2023, title: 'GODS', artist: 'NewJeans', id: 'C3GouGa0noM' },
  { category: 'anthem', year: 2022, title: "STAR WALKIN'", artist: 'Lil Nas X', id: 'HYsz1hP0BFo' },
  { category: 'anthem', year: 2021, title: 'Burn It All Down', artist: 'PVRIS', id: '1Z6CHioIn3s' },
  { category: 'anthem', year: 2020, title: 'Take Over', artist: 'Jeremy McKinnon, MAX, Henry', id: 'KbNL9ZyB49c' },
  { category: 'anthem', year: 2019, title: 'Phoenix', artist: 'Cailin Russo & Chrissy Costanza', id: 'i1IKnWDecwA' },
  { category: 'anthem', year: 2018, title: 'RISE', artist: 'The Glitch Mob, Mako, The Word Alive', id: 'fB8TyLTD7EE' },
  { category: 'anthem', year: 2017, title: 'Legends Never Die', artist: 'Against The Current', id: '4Q46xYqUwZQ' },
  { category: 'anthem', year: 2014, title: 'Warriors', artist: 'Imagine Dragons', id: 'fmI_Ndrxy14' },
] as const;
```

### B. Universo K/DA (`KDA_TRACKS`)
```ts
export const KDA_TRACKS = [
  { category: 'kda', year: 2018, title: 'POP/STARS', artist: 'K/DA ft. Madison Beer, (G)I-DLE, Jaira Burns', id: 'UOxkGD8qRB4' },
  { category: 'kda', year: 2020, title: 'MORE', artist: 'K/DA ft. Madison Beer, (G)I-DLE, Lexie Liu, Jaira Burns, Seraphine', id: '3VTkBuxU4yk' },
  { category: 'kda', year: 2020, title: 'THE BADDEST', artist: 'K/DA ft. (G)I-DLE, Bea Miller, Wolftyla', id: 'RkID8_gnTxw' },
  { category: 'kda', year: 2020, title: 'VILLAIN', artist: 'K/DA ft. Madison Beer, Kim Petras', id: 'xoWxv2yZXLQ' },
  { category: 'kda', year: 2020, title: 'DRUM GO DUM', artist: 'K/DA ft. Aluna, Wolftyla, Bekuh BOOM', id: 'E_PbH5y70Tc' },
  { category: 'kda', year: 2020, title: "I'LL SHOW YOU", artist: 'K/DA ft. TWICE, Bekuh BOOM, Annika Wells', id: 'WW1BpABbzHs' },
] as const;

export const ALL_WORLDS_TRACKS = [...WORLDS_ANTHEMS, ...KDA_TRACKS] as const;
```

---

## 3. Comportamiento del Reproductor y Mini-Dock en Segundo Plano

### Componente `WorldsMusicPlayer`
- **Estado de minimización**: `const [minimized, setMinimized] = useState(false);`
  * Al conmutar `minimized`, **no** se altera `isPlaying`.
  * Si `isPlaying === true`, el nodo `<iframe>` se preserva vivo en el árbol DOM.
- **Clase condicional para streaming oculto**:
  ```tsx
  {isPlaying && (
    <div className={minimized ? 'worlds-music-stream-hidden' : 'worlds-music-video-wrap'}>
      <iframe
        key={track.id}
        className="worlds-music-frame"
        src={worldsMusicUrl(track.id, origin)}
        title={`${track.year} · ${track.title} — ${track.artist}`}
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      />
    </div>
  )}
  ```
- **Estilos CSS**:
  ```css
  .worlds-music-stream-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    border: 0;
    opacity: 0;
    pointer-events: none;
  }
  .worlds-music-hud.is-minimized {
    width: auto;
    max-width: min(340px, calc(var(--worlds-viewport-width, 100vw) - 2rem));
    padding: 0.5rem 0.85rem;
  }
  ```

---

## 4. Pruebas Unitarias
- En `tests/unit/worlds-features.test.ts`:
  * Verificar los 11 himnos oficiales de Worlds y las 6 pistas de K/DA (total 17 canciones con IDs válidos de 11 caracteres).
  * Validar que `worldsMusicUrl` genera la URL con `https://www.youtube.com/embed/` y valida tracks válidos.
  * Mantener la prueba de modos de cine (`Escape`, `C`, `T`).
