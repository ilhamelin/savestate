# Especificación Técnica y de Diseño UX/UI: Reproductor Musical Premium de Worlds & K/DA (`/worlds`)

## 1. Resumen Ejecutivo y Objetivos

Esta especificación consolida la evolución técnica y de experiencia de usuario (UX/UI) del reproductor musical de Worlds (`/worlds`), transformándolo de un widget básico de video en miniatura a un **centro musical gamer de alto impacto** inspirado en la estética de League of Legends (Hextech Gold y K/DA Cyberpunk Neón).

### Objetivos Principales:
1. **Modo Dual Inmersivo ("Carátula Hi-Fi / Vinilo" vs "Videoclip 🎬")**:
   - Por defecto, el reproductor opera en modo audio mostrando la carátula oficial en alta definición con un **disco de vinilo giratorio con resplandor adaptativo**.
   - Evita la saturación visual de los controles nativos de YouTube (logos, barra roja, avatars, botones de compartir) en espacios reducidos (200px).
   - Permite alternar en 1 clic al video musical completo de YouTube cuando el usuario lo desee mediante el botón `[ 🎬 Ver Video ]`.

2. **Barra de Transporte Multimedia Completa (`⏮` | `⏯` | `⏭`)**:
   - Elimina la fricción de tener que desplegar la lista para cambiar de pista.
   - Navegación secuencial circular (`nextTrackIndex`, `prevTrackIndex`) que permite recorrer los 17 temas fluidamente.

3. **Segmentación Rápida por Píldoras Temáticas (Tabs)**:
   - Filtro instantáneo mediante botones píldora:
     * `[ Todos (17) ]`
     * `[ 🏆 Worlds (11) ]` (Himnos oficiales 2014–2026)
     * `[ 👑 K/DA (6) ]` (Discografía oficial K/DA de Riot Games)

4. **Estética Reactiva Dinámica (Hextech Gold ↔ K/DA Neón)**:
   - **Himno de Worlds**: El widget adquiere bordes y sombras en **Oro Hextech** (`#f5d061`), insignias de campeonato y partículas cálidas.
   - **K/DA**: El widget conmuta a **Cyberpunk Neón Magenta** (`#ff2a85`), sombras holográficas violetas (`#9b51e0`) y acentos cian.

5. **Audio Continuo en Segundo Plano y Mini-Dock Flotante**:
   - Al minimizar, la música **no se detiene**. El `<iframe>` permanece vivo en el DOM bajo la clase `.worlds-music-stream-hidden` (`opacity: 0; pointer-events: none; width: 1px; height: 1px; position: absolute;`).
   - El widget se colapsa en una **barra cápsula ultra-delgada** con mini-carátula giratoria, título, ecualizador animado, controles directos `[⏮ ⏯ ⏭]` y botón de expandir.

6. **Mitigación y Escape de Restricciones Regionales (LatinAutor - UMPG)**:
   - Migración al host estándar `https://www.youtube.com/embed/` con `referrerPolicy="strict-origin-when-cross-origin"`.
   - Botón directo de escape `[ ↗ Abrir en YouTube ]` e icono `[ ℹ ]` con popover amigable para explicar restricciones de derechos de autor en países de Latinoamérica.

---

## 2. Catálogo Oficial de Pistas Verificadas (17 Pistas)

### A. Himnos Oficiales de Worlds (`WORLDS_ANTHEMS`)
| Año | Título | Artista / Intérprete | YouTube ID |
| :---: | :--- | :--- | :---: |
| **2026** | *Know My Name* | True Damage | `mlFxxNsExJc` |
| **2025** | *Sacrifice* | G.E.M. (鄧紫棋) | `pzt6SmvGpXk` |
| **2024** | *Heavy Is The Crown* | Linkin Park | `5FrhtahQiRc` |
| **2023** | *GODS* | NewJeans | `C3GouGa0noM` |
| **2022** | *STAR WALKIN'* | Lil Nas X | `HYsz1hP0BFo` |
| **2021** | *Burn It All Down* | PVRIS | `1Z6CHioIn3s` |
| **2020** | *Take Over* | Jeremy McKinnon, MAX, Henry | `KbNL9ZyB49c` |
| **2019** | *Phoenix* | Cailin Russo & Chrissy Costanza | `i1IKnWDecwA` |
| **2018** | *RISE* | The Glitch Mob, Mako, The Word Alive | `fB8TyLTD7EE` |
| **2017** | *Legends Never Die* | Against The Current | `4Q46xYqUwZQ` |
| **2014** | *Warriors* | Imagine Dragons | `fmI_Ndrxy14` |

### B. Universo K/DA (`KDA_TRACKS`)
| Año | Título | Álbum / Colaboradores | YouTube ID |
| :---: | :--- | :--- | :---: |
| **2018** | *POP/STARS* | Single Debut (ft. Madison Beer, (G)I-DLE, Jaira Burns) | `UOxkGD8qRB4` |
| **2020** | *MORE* | EP ALL OUT (ft. Madison Beer, (G)I-DLE, Lexie Liu, Jaira Burns, Seraphine) | `3VTkBuxU4yk` |
| **2020** | *THE BADDEST* | EP ALL OUT (ft. (G)I-DLE, Bea Miller, Wolftyla) | `RkID8_gnTxw` |
| **2020** | *VILLAIN* | EP ALL OUT (ft. Madison Beer, Kim Petras) | `xoWxv2yZXLQ` |
| **2020** | *DRUM GO DUM* | EP ALL OUT (ft. Aluna, Wolftyla, Bekuh BOOM) | `E_PbH5y70Tc` |
| **2020** | *I'LL SHOW YOU* | EP ALL OUT (ft. TWICE, Bekuh BOOM, Annika Wells) | `WW1BpABbzHs` |

---

## 3. Arquitectura del Componente `WorldsMusicPlayer`

```mermaid
graph TD
    User([Usuario]) --> Player[WorldsMusicPlayer]
    Player --> StateMin{¿Minimizado?}
    StateMin -->|Sí| MiniDock[Mini-Dock Flotante: Mini-Artwork + Título + Eq + ⏮ ⏯ ⏭ + ▴]
    StateMin -->|No| FullHUD[HUD Expandido]

    FullHUD --> Tabs[Tabs de Categoría: Todos | Worlds | K/DA]
    FullHUD --> Selector[Select Agrupado con optgroup]
    FullHUD --> ViewMode{¿Modo de Vista?}
    ViewMode -->|Carátula Hi-Fi| ArtCard[Cover HQ + Vinilo Giratorio + Botón '🎬 Ver Video']
    ViewMode -->|Video Clip| VideoFrame[Iframe YouTube Visible + Botón '🎵 Modo Carátula']
    FullHUD --> Transport[Transporte Multimedia: ⏮ Anterior | ⏯ Play-Pause | ⏭ Siguiente]
    FullHUD --> Footer[Escape '↗ YouTube' + Info Tooltip 'ℹ']

    MiniDock -.->|Preserva Audio| AudioIframe[(Iframe Oculto: .worlds-music-stream-hidden)]
    ArtCard -.->|Preserva Audio| AudioIframe
```

---

## 4. Funciones Auxiliares de Dominio (`src/domain/worlds-features.ts`)

```ts
export function trackThumbnailUrl(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

export function nextTrackIndex(current: number, total: number): number {
  return (current + 1) % total;
}

export function prevTrackIndex(current: number, total: number): number {
  return (current - 1 + total) % total;
}
```

---

## 5. Diseño Visual y Clases CSS (`src/app/globals.css`)

- `.worlds-music-hud.theme-worlds`: Acentos y resplandor Hextech dorado (`#f5d061`).
- `.worlds-music-hud.theme-kda`: Acentos y resplandor neón magenta/violeta (`#ff2a85` / `#9b51e0`).
- `.worlds-tab-pill`: Píldoras con micro-interacciones hover y estado `.is-active`.
- `.worlds-vinyl-disc.is-spinning`: Animación `@keyframes worlds-vinyl-spin 8s linear infinite`.
- `.worlds-music-stream-hidden`: Ocultamiento accesible sin desmontar del DOM.
- `.worlds-music-hud.is-minimized`: Contenedor compacto en dock inferior con ancho adaptable a móviles y escritorio.

---

## 6. Pruebas y Validación de Calidad

- Archivo de pruebas: `tests/unit/worlds-features.test.ts`.
- Cobertura de pruebas:
  1. Catálogo íntegro de 11 himnos y 6 pistas de K/DA (17 pistas con IDs válidos de 11 caracteres).
  2. Generación de URLs de inserción con el host oficial `https://www.youtube.com`.
  3. Cálculo de carátulas `trackThumbnailUrl`.
  4. Navegación secuencial circular con `nextTrackIndex` y `prevTrackIndex`.
  5. Conmutación limpia de modos de pantalla completa (`normal`, `cinema`, `theater`).
