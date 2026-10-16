# Especificación Técnica y Plan de Implementación: HoYo Hub (`/hoyo`)

## 1. Resumen Ejecutivo
Implementación de una nueva vista dedicada en SaveState (`/hoyo`) para seguir de forma centralizada y en tiempo real:
1. **Directos de Versión (Programas Especiales):** Reproductores oficiales de YouTube y Twitch para Genshin Impact y Honkai: Star Rail con Modo Cine y Modo Teatro.
2. **Radar de Códigos de Recompensa (300 Protogemas / Jades Estelares):** Botón de copiado en 1 clic y enlace directo que abre el formulario oficial de canje con el código autorellenado.
3. **Noticias y Notas de Parche Oficiales en Español:** Consumo de la API pública oficial de HoYoLAB (`bbs-api-os.hoyolab.com`) sin dependencias externas ni scraping, con caché inteligente de 15 minutos.
4. **Cronograma y Cuenta Regresiva de Versión:** Monitor de fase activa (Fase 1 vs Fase 2) y cuenta regresiva al próximo parche/directo.
5. **Integración con Trackers (Enka.Network):** Acceso rápido a las vitrinas de personajes de Genshin y HSR guardadas en el perfil del usuario.

---

## 2. Arquitectura de Archivos y Responsabilidades

```
src/
├── domain/
│   └── hoyo-hub.ts              # Modelos, constantes de canales, códigos y parser de noticias HoYoLAB
├── services/
│   └── hoyo-news.ts             # Cliente de API HoYoLAB con caché y fallback
├── components/
│   ├── hoyo-hub.tsx             # Componente de cliente: selector de juego, stream, códigos y feed
│   └── header-nav.tsx           # Enlace "HoYo" añadido a la barra de navegación
├── app/
│   ├── hoyo/
│   │   └── page.tsx             # Página /hoyo con SSR y metadatos SEO
│   └── hoyo.css                 # Estilos específicos del hub (temas Teyvat y Astral)
tests/
└── unit/
    └── hoyo-hub.test.ts         # Pruebas unitarias de parsing, URLs de canje y lógica de códigos
```

---

## 3. Especificación Detallada por Capa

### A. Capa de Dominio (`src/domain/hoyo-hub.ts`)
- **Tipo de juego:** `type HoyoGame = 'genshin' | 'hsr'`
- **Configuración de juegos:**
  - `genshin`:
    - Título: `Genshin Impact`
    - Color acento: `#f4c462` (Dorado Teyvat)
    - Wallpaper: `/wallpapers/rift_genshin.jpg`
    - Canales: Twitch `genshinimpactofficial`, YouTube `@GenshinImpact`
    - URL de Canje: `https://genshin.hoyoverse.com/es/gift?code=`
  - `hsr`:
    - Título: `Honkai: Star Rail`
    - Color acento: `#c084fc` (Púrpura Astral)
    - Wallpaper: `/wallpapers/rift_hsr.jpg`
    - Canales: Twitch `honkaistarrail`, YouTube `@HonkaiStarRail`
    - URL de Canje: `https://hsr.hoyoverse.com/gift?code=`
- **Función `buildHoyoRedeemUrl(game: HoyoGame, code: string): string`:**
  Retorna la URL oficial de canje con el código incluido como parámetro.
- **Función `parseHoyoNews(json: unknown): HoyoNewsItem[]`:**
  Extrae de forma segura `id`, `subject`, `summary`, `coverUrl`, `createdAt` y clasifica por tipo (`actualizacion`, `evento`, `aviso`).

### B. Capa de Servicios (`src/services/hoyo-news.ts`)
- Función `fetchHoyoNews(game: HoyoGame): Promise<HoyoNewsItem[]>`
- Endpoint oficial:
  - Genshin: `https://bbs-api-os.hoyolab.com/community/post/wapi/getNewsList?gids=2&type=1&page_size=8`
  - HSR: `https://bbs-api-os.hoyolab.com/community/post/wapi/getNewsList?gids=6&type=1&page_size=8`
- Header: `'x-rpc-language': 'es-es'` para recibir todo en español oficial.
- Caché en memoria con revalidación de 15 minutos (`next: { revalidate: 900 }`).

### C. Componente Cliente (`src/components/hoyo-hub.tsx`)
- Selector de juego bimodal (`Genshin Impact` / `Honkai: Star Rail`) sincronizado con `useSearchParams` (`?game=genshin` o `?game=hsr`).
- Reproductor de video oficial embebido con selector de señal (Twitch / YouTube) y botones de Modo Cine / Modo Teatro.
- Panel de Códigos Activos:
  - Tarjetas con el código en tipografía monospace destacada.
  - Botón `[ 📋 Copiar ]` con estado reactivo de 2 segundos (`¡Copiado!`).
  - Botón `[ ↗ Canjear en Web Oficial ]` que abre la web de HoYoverse en pestaña nueva con el código pre-cargado.
- Cronograma de Versión:
  - Versión actual, fase de banners y cuenta regresiva de días restantes.
- Cuadrícula de Noticias:
  - Tarjetas con miniatura oficial, tag de categoría, título, fecha relativa y enlace al post oficial en HoYoLAB.

### D. Navegación e Integración
- `src/components/header-nav.tsx`: Agregar `{ href: '/hoyo', label: 'HoYo', icon: Orbit }`.
- `src/components/command-menu.tsx`: Agregar `['HoYo Hub · Genshin Impact & Star Rail', '/hoyo']`.
- `src/app/layout.tsx`: Agregar enlace a `HoYo Hub` en la sección Explorar del pie de página.
