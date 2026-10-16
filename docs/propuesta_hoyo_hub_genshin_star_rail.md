# Propuesta de Arquitectura y Diseño: HoYo Hub (Genshin Impact & Honkai: Star Rail)

## 1. Visión y Propósito

Crear una nueva vista dedicada en SaveState (propuesta: `/hoyo` o `/astral`) diseñada como el **centro de mando definitivo para la comunidad de HoYoverse**:
1. Seguir en directo los **Programas Especiales de Versión** (Livestreams oficiales de actualización).
2. Capturar y canjear en 1-clic los **Códigos de Recompensa** de 300 Protogemas / Jades Estelares antes de que expiren (16 horas).
3. Leer las **Noticias, Notas de Parche y Banners Oficiales en Español** directamente desde la API pública de HoYoLAB.
4. Consultar la **Cuenta Regresiva de la Versión** y los banners activos (Fase 1 vs Fase 2).
5. Conectar con el **Showcase de Personajes** ya integrado en SaveState vía UID / Enka.Network.

---

## 2. Mockup Visual de la Interfaz

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  HOYOVERSE PORTAL // TEYVAT & ASTRAL EXPRESS                                     │
│  [ 🌌 Genshin Impact (v5.1) ]             [ 🚂 Honkai: Star Rail (v2.6) ]        │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  🔴 EN DIRECTO / PROGRAMA ESPECIAL DE VERSIÓN:                                   │
│  ┌────────────────────────────────────────────────────────────────────────────┐  │
│  │                                                                            │  │
│  │                     [ REPRODUCTOR TWITCH / YOUTUBE ]                       │  │
│  │                  "Programa Especial de la Versión 5.2"                     │  │
│  │                                                                            │  │
│  └────────────────────────────────────────────────────────────────────────────┘  │
│  Señales: [ 🇪🇸 Twitch Oficial ] [ 🇲🇽 YouTube Oficial ] [ Modo Cine ]             │
│                                                                                  │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  💎 CÓDIGOS DE LA VERSIÓN (300 PROTOGEMAS / JADES):                              │
│  ┌─────────────────────────┐ ┌─────────────────────────┐ ┌────────────────────┐ │
│  │ 🔑 GENSHIN52LIVE1       │ │ 🔑 GENSHIN52LIVE2       │ │ 🔑 GENSHIN52LIVE3  │ │
│  │ 100 Protogemas + 10 Min │ │ 100 Protogemas + 5 Exp  │ │ 100 Protogemas     │ │
│  │ [📋 Copiar] [↗ Canjear] │ │ [📋 Copiar] [↗ Canjear] │ │ [📋 Copiar] [↗]    │ │
│  └─────────────────────────┘ └─────────────────────────┘ └────────────────────┘ │
│                                                                                  │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ⏳ CRONOGRAMA DE VERSIÓN:                                                       │
│  ▸ Parche Actual: v5.1 (Fase 2) · Faltan 11 días para v5.2                       │
│  ▸ Banners Activos: Xilonen / Chiori · Finaliza el 29 de Octubre                 │
│                                                                                  │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  📰 NOTICIAS OFICIALES HOYOLAB (ESPAÑOL):                                        │
│  • [Actualización] Detalles de la versión 5.2 «Nombre del Parche»     · hace 2h │
│  • [Aviso] Mantenimiento y optimizaciones del sistema                 · hace 1d │
│  • [Gachapón] Avance de personajes y armas de la Fase 1               · hace 3d │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Pilares y Características Clave

### Pilar A: Selector de Universo (`Genshin` vs `Star Rail`)
- **Diseño bimodal:**
  - Modo Genshin: Acentos en dorado y azul celestial Teyvat (`#f4c462`), con fondo de pantalla de Natlan/Fontaine (`rift_genshin.jpg`).
  - Modo Star Rail: Acentos en violeta y oro cósmico Astral (`#a855f7` / `#f3ba59`), con fondo espacial (`rift_hsr.jpg`).
- Guarda la preferencia en URL (`/hoyo?game=genshin` o `/hoyo?game=hsr`) para poder compartir enlaces directos.

### Pilar B: Transmisiones Oficiales y VODs
- **Canales Oficiales:**
  - **Genshin Impact:** Twitch `genshinimpactofficial` y YouTube `@GenshinImpact`.
  - **Honkai: Star Rail:** Twitch `honkaistarrail` y YouTube `@HonkaiStarRail`.
- Controles de Modo Cine y Modo Teatro (aprovechando los estilos probados en Worlds).

### Pilar C: Generador y Canjeador de Códigos Express
- Los códigos de directo duran apenas 16 horas y otorgan 300 Protogemas / Jades Estelares.
- **Acción 1:** Botón de copiado al portapapeles con feedback instantáneo (`¡Copiado!`).
- **Acción 2:** Botón de canje automático:
  - Genshin: `https://genshin.hoyoverse.com/es/gift?code=${code}`
  - Star Rail: `https://hsr.hoyoverse.com/gift?code=${code}`
  Al hacer clic, abre la página oficial de canje con el código ya rellenado en el formulario.

### Pilar D: Feed de Noticias Oficiales (API Abierta HoYoLAB)
- Hemos comprobado que HoYoLAB ofrece una API pública y oficial sin necesidad de credenciales complejas:
  - Genshin Impact: `https://bbs-api-os.hoyolab.com/community/post/wapi/getNewsList?gids=2&type=1&page_size=6`
  - Honkai: Star Rail: `https://bbs-api-os.hoyolab.com/community/post/wapi/getNewsList?gids=6&type=1&page_size=6`
  - Header `'x-rpc-language': 'es-es'` para recibir títulos y descripciones traducidos oficialmente al español.
- Caching con revalidación cada 15 minutos en Next.js.

### Pilar E: Conexión con el Perfil Gamer en SaveState
- Si el usuario tiene guardado su UID de Genshin o HSR en SaveState, un botón rápido le permite ver su vitrina de personajes (`Enka.Network`) directamente en el hub.
