# Especificación Técnica: Modo Cine (Estilo YouTube) y Reproductor de Música Oficial de Worlds (`/worlds`)

## 1. Resumen y Objetivos

Esta especificación detalla la implementación de dos nuevas características para la vista **Worlds 2026** (`/worlds`):

1. **Modo Cine (Cinema Mode estilo YouTube)**:
   - A diferencia del actual "Modo Teatro" (que solo oscurece el fondo con viñeta negra), el **Modo Cine** ensancha el reproductor de Twitch/VOD de borde a borde (`100vw` o hasta 1600px), aumentando su altura de forma panorámica (`calc(100vh - 160px)` o ratio 16:9 ampliado) para una inmersión visual total sin entrar en pantalla completa nativa.
   - La barra de navegación superior y el scroll hacia el dossier, rosters y calendario permanecen totalmente operativos.
   - Interfaz con selector de modos claros:
     - `[ 🎦 Modo Cine ]`: Expande el reproductor al ancho completo panorámico.
     - `[ 🌙 Modo Teatro ]`: Oscurece el entorno y focaliza la luz en la transmisión.
     - `[ ✕ Normal ]`: Restaura el tamaño estándar.
     - Atajos de teclado: `C` para Modo Cine, `T` para Modo Teatro, `Escape` para volver al modo normal.

2. **Reproductor de Música Oficial de Worlds (Soundtrack HUD)**:
   - Un widget flotante o acoplado con estética Hextech/Cyberpunk que permite al usuario escuchar los himnos oficiales del mundial de League of Legends mientras explora la plataforma.
   - **Análisis Legal y Técnico**:
     - *Legalidad*: Los himnos de Worlds involucran derechos fonográficos de Riot Games y sellos discográficos internacionales (Interscope, Atlantic, Sony, Warner, ADOR/HYBE). **No se deben alojar archivos MP3 directamente en el servidor** (riesgo de DMCA y demandas de discográficas).
     - *Solución 100% Legal y Segura*: Se integra mediante el reproductor oficial embebido de **YouTube** (o YouTube Iframe Player API) conectado a los videos oficiales del canal verificado de Riot Games / League of Legends. Las vistas y monetización le corresponden íntegramente a Riot y a los artistas, cumpliendo con la política de "Legal Jibber Jabber".
     - *Autoplay*: Respeta la política de los navegadores modernos (requiere que el usuario pulse `Play` para iniciar el audio).

---

## 2. Catálogo Oficial de Himnos de Worlds

| Año | Título | Artista(s) | Video Oficial YouTube ID |
|:---:|---|---|:---:|
| **2024** | *Heavy Is The Crown* | Linkin Park | `5SZ70oZl_v8` |
| **2023** | *GODS* | NewJeans | `C3GouGa0noM` |
| **2022** | *STAR WALKIN'* | Lil Nas X | `HYsz1hP0BFo` |
| **2021** | *Burn It All Down* | PVRIS | `fB8TyLTD7EE` |
| **2020** | *Take Over* | Jeremy McKinnon, MAX, Henry | `r6zIGXunKCg` |
| **2019** | *Phoenix* | Cailin Russo & Chrissy Costanza | `2y64D1U764o` |
| **2018** | *Rise* | The Glitch Mob, Mako, The Word Alive | `sVhyzYx4z18` |
| **2017** | *Legends Never Die* | Against The Current | `4Q46xYqUwZQ` |
| **2014** | *Warriors* | Imagine Dragons | `fmI_Ndrxy14` |

---

## 3. Arquitectura y Componentes Frontend

### 3.1. Modos de Visualización en `src/components/worlds-hub.tsx`
- Estado de visualización:
  ```ts
  type WorldsViewMode = 'normal' | 'cinema' | 'theater';
  const [viewMode, setViewMode] = useState<WorldsViewMode>('normal');
  ```
- Botonera en el reproductor:
  - `<button onClick={() => setViewMode(v => v === 'cinema' ? 'normal' : 'cinema')}>` -> `🎦 Modo Cine`
  - `<button onClick={() => setViewMode(v => v === 'theater' ? 'normal' : 'theater')}>` -> `🌙 Modo Teatro`
- Atajos de teclado en `useEffect`:
  - `Escape`: Vuelve a `'normal'`.
  - Tecla `c` / `C`: Alterna Modo Cine.
  - Tecla `t` / `T`: Alterna Modo Teatro.

### 3.2. Reproductor de Música `src/components/worlds-music-player.tsx`
- Componente cliente:
  - Selector de pista con lista desplegable de himnos (2014 - 2024).
  - Botón Play / Pause.
  - Animación de ecualizador de ondas de audio (`.worlds-eq-bar`).
  - Control de volumen / silenciar.
  - Renderiza un `<iframe>` de YouTube oculto u optimizado con `enablejsapi=1` y `origin` del sitio.
  - Botón para minimizar/expandir el reproductor en la esquina inferior derecha o en la cabecera de Worlds.

---

## 4. Estilos Visuales (`src/app/globals.css`)

```css
/* Modo Cine: Rompe el contenedor estándar y ocupa el ancho completo de la pantalla */
.worlds-player.is-cinema {
  position: relative;
  z-index: 25;
  width: 100vw;
  max-width: 100vw;
  margin-left: calc(-50vw + 50%);
  margin-right: calc(-50vw + 50%);
  border-radius: 0;
  border-left: none;
  border-right: none;
  border-top: 2px solid #f5d061;
  background: #030508;
  padding: 1.5rem calc(max(1.5rem, (100vw - 1440px) / 2));
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.9);
}

.worlds-player.is-cinema .worlds-video {
  max-height: calc(100vh - 170px);
  aspect-ratio: 16 / 9;
  border: 1px solid rgba(245, 208, 97, 0.3);
  box-shadow: 0 0 40px rgba(0, 0, 0, 0.8), 0 0 30px rgba(245, 208, 97, 0.2);
}

/* Modo Teatro: Focaliza y oscurece el entorno */
.worlds-player.is-theater {
  position: relative;
  z-index: 30;
  border-color: #f5d061;
  box-shadow:
    0 0 0 100vmax rgba(3, 5, 10, 0.85),
    0 0 65px rgba(212, 175, 55, 0.35);
}

/* Reproductor de Música Hextech */
.worlds-music-hud {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  z-index: 50;
  background: rgba(9, 14, 24, 0.92);
  border: 1px solid #d4af3766;
  border-radius: 6px;
  padding: 0.75rem 1rem;
  backdrop-filter: blur(12px);
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.7), 0 0 20px rgba(212, 175, 55, 0.2);
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
```
