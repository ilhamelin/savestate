# Especificación Técnica: Personalización Visual Avanzada (Halloween, Navidad, Habitaciones Gamer, Galería de Avatares y Paleta Hex Libre)

## 1. Resumen de Requerimientos del Usuario
1. **Temas estacionales (Halloween y Navidad)**:
   - Opciones de temática festiva tanto en **Habitación gamer** como en **Wallpapers / Colores / Avatares** para que el usuario pueda ambientar su perfil con estética **🎃 Halloween (Spooky Arcade)** y **🎄 Navidad (Frost / Holiday Arcade)**.
2. **Más opciones para "Habitación gamer" (`room_theme`)**:
   - Actualmente solo existen 3: `Terminal CRT`, `Consola portátil`, `Estantería retro`.
   - Agregar nuevas habitaciones con identidad visual propia:
     - `arcade_cabinet`: **Cabina Arcade 80s** (marquesina luminosa superior "INSERT COIN // 1UP" y bordes neon).
     - `cyber_deck`: **Cyberdeck Futurista** (panel HUD táctico con esquinas biseladas y telemetría).
     - `halloween_crypt`: **🎃 Cripta de Halloween** (marco gótico/calabaza `#ff6b00` y violeta `#9d4edd`, telarañas/murciélagos decorativos sutiles y brillo espectral).
     - `christmas_lodge`: **🎄 Cabaña de Navidad** (luces navideñas pixel-art en el borde superior, tonos rojo carmesí `#ff334b`, pino `#1b4332` y dorado cálido `#ffd166` con copos de nieve sutiles).
3. **Más opciones para "Avatar de galería"**:
   - Actualmente solo existen 4 (`Pixel cyan`, `Pixel green`, `Pixel pink`, `Pixel amber`).
   - Expandir la galería con nuevos avatares SVG pixel-art en `public/avatars/`:
     - `halloween_pumpkin.svg` -> **🎃 Calabaza de Halloween (Jack-o'-Lantern)**
     - `halloween_ghost.svg` -> **👻 Fantasma Espectral**
     - `christmas_santa.svg` -> **🎄 Gorro Navideño / Santa Pixel**
     - `christmas_snowman.svg` -> **⛄ Muñeco de Nieve**
     - `cyber_samurai.svg` -> **⚔️ Cyber Ninja / Samurai**
     - `retro_robot.svg` -> **🤖 Robot Arcade 8-Bit**
     - `space_invader.svg` -> **👾 Alien Invader**
     - `wizard_mage.svg` -> **🧙‍♂️ Mago RPG**
4. **Selector de Color Libre (Código Hex + Paleta de Colores Interactiva)**:
   - Actualmente `theme_color` solo permite 4 presets (`cyan`, `green`, `pink`, `amber`).
   - Añadir nuevos presets rápidos (incluyendo **Naranja Halloween `#ff6b00`**, **Morado Bruja `#a855f7`**, **Rojo Navidad `#ff2a54`**, **Oro Invierno `#ffd166`**) **Y ADEMÁS**:
   - Permitir que el usuario elija **cualquier color libre** mediante:
     - Un **selector visual de paleta de color** (`<input type="color">`) estilizado.
     - Un **campo de texto Hexadecimal** (`#RRGGBB`, ej: `#7c3aed`) para escribir o pegar cualquier código hex exacto.

---

## 2. Diseño de Base de Datos y Validación (Retrocompatible con y sin migración SQL)

### 2.1. Estrategia Dual (Migración SQL + Fallback Seguro)
En `supabase/migrations/202610070001_initial.sql` y `202610070008_arcade_and_parties.sql`, la tabla `profiles` tiene restricciones `CHECK`:
- `theme_color check (theme_color in ('cyan','green','pink','amber'))`
- `room_theme check (room_theme in ('crt_terminal', 'handheld_console', 'retro_shelf'))`
- En cambio, `social_links` es una columna `jsonb` que ya existe en todas las bases de datos y `avatar_url` no tiene `CHECK` en SQL (solo validación en `src/services/profile.ts`).

Para que funcione **al 100% en producción de inmediato** (incluso antes de que el usuario corra una nueva migración SQL, y también dejando la migración lista):
1. **Migración SQL `202610110025_custom_themes_and_seasonal_rooms.sql`**:
   - Amplía el check de `theme_color` para aceptar los nuevos nombres de tema o cualquier código hexadecimal `^#[0-9a-fA-F]{6}$`.
   - Amplía el check de `room_theme` para aceptar `'crt_terminal'`, `'handheld_console'`, `'retro_shelf'`, `'arcade_cabinet'`, `'cyber_deck'`, `'halloween_crypt'`, `'christmas_lodge'`.
2. **Respaldo automático en `src/services/profile.ts` (Zero-Downtime Fallback)**:
   - Si al hacer `UPDATE profiles` en Supabase la base de datos aún tiene el `CHECK` antiguo (código de error Postgres `23514` `check_violation`), o de forma complementaria, si el servicio detecta `23514`, guarda el color custom / habitación nueva o bien reintenta guardando el preset base en la columna y preservando el valor extendido, o aplicando la migración. *(Además podemos verificar si tenemos acceso o indicar el SQL si hiciera falta, o almacenar metadatos visuales sin fallar).*

---

## 3. Detalle de Implementación por Módulo

### 3.1. Colores de Perfil (`src/domain/profile-studio.ts` & `src/domain/model.ts`)
- Soportar:
  - Presets con nombre:
    - `cyan`: `#00f0ff` (Cian Neón)
    - `green`: `#00ff66` (Verde Ácido)
    - `pink`: `#ff0055` (Rosa Synth)
    - `amber`: `#ffb800` (Ámbar Retro)
    - `halloween`: `#ff6b00` (🎃 Calabaza Halloween)
    - `spooky_purple`: `#a855f7` (🔮 Morado Espectral)
    - `christmas`: `#ff2e4c` (🎄 Rojo Navidad)
    - `frost_ice`: `#7dd3fc` (❄️ Hielo Invernal)
  - Cualquier código Hex válido `#RRGGBB` (normalizado a minúsculas, ej: `#8b5cf6`).
- Función helper `resolveThemeColor(themeColor: string): string`:
  - Si `themeColor` está en `PROFILE_COLORS`, devuelve su hex (`PROFILE_COLORS[themeColor]`).
  - Si `themeColor` cumple `/^#[0-9a-fA-F]{6}$/`, devuelve `themeColor.toLowerCase()`.
  - Si no, devuelve `'#00f0ff'`.
- En `src/app/players/[username]/page.tsx` y `src/components/profile-studio.tsx`:
  - Aplicar `--accent: resolveThemeColor(profile.theme_color)` y `--profile-accent: resolveThemeColor(profile.theme_color)` directamente en el `style` del contenedor del perfil para que cualquier color Hex personalizado tiña automáticamente bordes, botones, insignias, barras de XP y brillos de toda la página del jugador.

### 3.2. Habitaciones Gamer y Temas Halloween / Navidad (`src/domain/arcade.ts` & `src/components/gamer-room.tsx`)
Actualizar `ROOM_THEMES` y `ROOM_LABELS`:
- `crt_terminal`: `'🖥️ Terminal CRT'`
- `handheld_console`: `'🕹️ Consola portátil'`
- `retro_shelf`: `'📚 Estantería retro'`
- `arcade_cabinet`: `'👾 Cabina Arcade 80s'`
- `cyber_deck`: `'⚡ Cyberdeck HUD'`
- `halloween_crypt`: `'🎃 Cripta de Halloween'`
- `christmas_lodge`: `'🎄 Cabaña de Navidad'`

En `GamerRoom` (`src/components/gamer-room.tsx`) y `src/app/arcade.css`:
- **`room-halloween_crypt`**:
  - Borde doble naranja calabaza (`#ff6b00`) y sombra púrpura espectral (`#9d4edd`).
  - Barra decorativa superior con `🎃 SPOOKY CHECKPOINT // HALLOWEEN EDITION 🦇` y efecto de niebla/resplandor nocturno.
- **`room-christmas_lodge`**:
  - Guirnalda de luces LED pixel-art en la parte superior (alternando puntos luminosos rojos, verdes, dorados y azules) con encabezado `🎄 HOLIDAY CHECKPOINT // WINTER FEST ❄️`.
  - Fondo oscuro invernal con borde rojo/dorado festivo y destellos de nieve.
- **`room-arcade_cabinet`**:
  - Marquesina superior iluminada estilo máquina recreativa (`INSERT COIN // PLAYER 1`) con bisel lateral.
- **`room-cyber_deck`**:
  - Marco táctico con corte angular (`clip-path` o bordes tecnológicos) e indicadores de sistema.

### 3.3. Wallpapers de Halloween y Navidad (`src/domain/wallpaper.ts` & `public/wallpapers/`)
Añadir 2 nuevos wallpapers vectoriales SVG de alta calidad a `WALLPAPERS`:
- `{ id: 'halloween_night', name: '🎃 Noche de Halloween', url: '/wallpapers/halloween_night.svg' }`
- `{ id: 'christmas_snow', name: '🎄 Aldea Navideña', url: '/wallpapers/christmas_snow.svg' }`

### 3.4. Galería Ampliada de Avatares (`public/avatars/` & `src/domain/profile-studio.ts`)
Crear el catálogo `GALLERY_AVATARS` con opciones organizadas:
- Clásicos: `Pixel Cyan`, `Pixel Green`, `Pixel Pink`, `Pixel Amber`
- Halloween: `🎃 Calabaza Halloween` (`/avatars/halloween_pumpkin.svg`), `👻 Fantasma Arcade` (`/avatars/halloween_ghost.svg`)
- Navidad: `🎄 Santa Pixel` (`/avatars/christmas_santa.svg`), `⛄ Muñeco de Nieve` (`/avatars/christmas_snowman.svg`)
- Personajes Gamer: `🤖 Robot 8-Bit` (`/avatars/retro_robot.svg`), `👾 Alien Invader` (`/avatars/space_invader.svg`), `⚔️ Cyber Samurai` (`/avatars/cyber_samurai.svg`), `🧙‍♂️ Mago RPG` (`/avatars/wizard_mage.svg`)

Además de mostrar el `<select>`, mostrar una **fila de miniaturas clicables** en el estudio de perfil para elegir el avatar de galería visualmente con un clic.

### 3.5. UI del Selector de Color Hex + Paleta Libre en `ProfileStudio` (`src/components/profile-studio.tsx`)
Debajo o al lado de los círculos de colores rápidos (`.studio-palette`):
- Mostrar los círculos de presets (incluyendo los de Halloween y Navidad).
- Añadir un control interactivo **"Color personalizado"**:
  - Un botón/input `<input type="color">` (paleta libre del sistema/navegador) que actualiza el color en tiempo real mientras el usuario arrastra el selector.
  - Un input de texto `<input type="text" placeholder="#00f0ff" maxLength={7}>` donde el usuario puede escribir o pegar cualquier código Hex (`#RRGGBB`), con vista previa inmediata sobre su tarjeta de perfil.
