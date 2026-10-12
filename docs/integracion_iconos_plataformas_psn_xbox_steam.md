# Especificación Técnica: Integración de Iconos Oficiales de PlayStation, Xbox y Steam

## 1. Objetivo
Reemplazar los iconos falsos basados en emojis (`🎮`, `🟩`, `🖥️`, `▣`) o etiquetas de texto plano en los `div`/`span`/`a` que mencionan **PlayStation (PSN)**, **Xbox** y **Steam** por los iconos gráficos proporcionados en `C:\Users\benja\Downloads\ABDM\Pictures\Instagram_Picture`.

---

## 2. Assets Copiados al Proyecto (`public/platforms/`)
Los iconos ya han sido copiados tanto en `savestate 2` como en `savestate-research` bajo la ruta pública `/platforms/`:

| Plataforma | Origen en `Instagram_Picture` | Ruta en el proyecto | Dimensiones origen |
| :--- | :--- | :--- | :--- |
| **PlayStation / PSN** | `Icon for PlayStation Now by Vackz\imgi_2_9d86d83f925f2149e9edb0ac3b49229c.png` | `/platforms/playstation.png` | 128×128 px (PNG) |
| **Xbox** | `Icon for Microsoft Xbox by r_dsgnd\imgi_3_128x128.png` | `/platforms/xbox.png` | 128×128 px (PNG) |
| **Steam** | `Icon for Steam by cyberbobgr\imgi_3_128x128.png` | `/platforms/steam.png` | 128×128 px (PNG) |

---

## 3. Helper de Resolución de Iconos de Plataforma
Crear o exportar un helper reutilizable (por ejemplo en `src/domain/platform-icons.ts` o junto a un componente `<PlatformIcon />`) que resuelva la ruta del icono según el identificador o nombre de plataforma:

```ts
export type BrandPlatform = 'playstation' | 'xbox' | 'steam';

export const PLATFORM_ICON_PATHS: Record<BrandPlatform, string> = {
  playstation: '/platforms/playstation.png',
  xbox: '/platforms/xbox.png',
  steam: '/platforms/steam.png',
};

export function resolvePlatformIcon(input: string): string | null {
  const normalized = input.trim().toLowerCase();
  if (
    normalized.includes('playstation') ||
    normalized.includes('psn') ||
    /\bps[1-5v]\b/.test(normalized)
  ) {
    return PLATFORM_ICON_PATHS.playstation;
  }
  if (normalized.includes('xbox')) {
    return PLATFORM_ICON_PATHS.xbox;
  }
  if (normalized.includes('steam')) {
    return PLATFORM_ICON_PATHS.steam;
  }
  return null;
}
```

---

## 4. Componentes y Vistas a Actualizar

### 4.1. Banner de Cuenta Regresiva de GTA VI (`src/components/gta6-countdown.tsx`)
- **Estado actual**:
  ```tsx
  <div className="gta6-platforms">
    <span>🎮 PlayStation 5</span>
    <span>🟩 Xbox Series X|S</span>
  </div>
  ```
- **Nuevo estado**:
  Reemplazar `🎮` y `🟩` por `<Image>` con los iconos reales:
  ```tsx
  <div className="gta6-platforms">
    <span className="platform-tag">
      <Image src="/platforms/playstation.png" alt="" width={18} height={18} unoptimized />
      PlayStation 5
    </span>
    <span className="platform-tag">
      <Image src="/platforms/xbox.png" alt="" width={18} height={18} unoptimized />
      Xbox Series X|S
    </span>
  </div>
  ```

### 4.2. Etiquetas de Identidad en el Perfil de Jugador (`src/app/players/[username]/page.tsx`) y Estudio de Perfil (`src/components/profile-studio.tsx`)
- **Estado actual**:
  - `{profile.psn_id ? <span className="tag">🎮 PSN: @{profile.psn_id}</span> : null}`
  - `{profile.xbox_gamertag ? <span className="tag">🟩 Xbox: @{profile.xbox_gamertag}</span> : null}`
  - `{Object.entries(externalLinks).map(([label, url]) => (<a className="tag" ...>{label} ↗</a>))}` (donde `steam ↗` aparece sin icono mientras que `Genshin UID` y `HSR UID` sí tienen icono `16x16`).
- **Nuevo estado**:
  - En la etiqueta de **PSN** (`profile.psn_id` y `draft.psn_id`):
    ```tsx
    <span className="tag platform-tag">
      <Image src="/platforms/playstation.png" alt="" width={16} height={16} unoptimized />
      PSN: @{profile.psn_id}
    </span>
    ```
  - En la etiqueta de **Xbox** (`profile.xbox_gamertag` y `draft.xbox_gamertag`):
    ```tsx
    <span className="tag platform-tag">
      <Image src="/platforms/xbox.png" alt="" width={16} height={16} unoptimized />
      Xbox: @{profile.xbox_gamertag}
    </span>
    ```
  - En los enlaces de `externalLinks` (`steam`, o si el usuario configura `playstation`/`xbox`):
    Si `resolvePlatformIcon(label)` devuelve un icono (por ejemplo para `steam`), renderizar `<Image src={icon} alt="" width={16} height={16} unoptimized />` dentro del `<a className="tag platform-tag">`, alineado exactamente igual que `.tracker-uid-tag`.

### 4.3. Tarjetas del Directorio de Jugadores (`src/components/player-card.tsx`)
- **Estado actual**:
  ```tsx
  <div className="tags" aria-label="Plataformas conectadas">
    {profile.steam_id ? <span className="tag">🖥️ Steam</span> : null}
    {profile.xbox_gamertag ? <span className="tag">🟩 Xbox</span> : null}
    {profile.psn_id ? <span className="tag">🎮 PSN</span> : null}
  </div>
  ```
- **Nuevo estado**:
  Reemplazar `🖥️`, `🟩` y `🎮` por `<Image>` (`16×16`) apuntando a `/platforms/steam.png`, `/platforms/xbox.png` y `/platforms/playstation.png` con la clase `tag platform-tag`.

### 4.4. Inventario de Hardware del Perfil (`HardwareBadges` en `src/components/profile-dossier.tsx`)
- **Estado actual**:
  ```tsx
  {platforms.map((platform) => (
    <span className="hardware-badge" key={platform}>
      <span aria-hidden="true">▣</span> {platform}
    </span>
  ))}
  ```
- **Nuevo estado**:
  Si `resolvePlatformIcon(platform)` devuelve un icono (ej. `PC / Steam`, `Steam Deck / Portátil PC`, `PlayStation 5`, `PlayStation 4`, `PlayStation 2`, `PlayStation 1`, `Xbox Series`, `Xbox 360`), mostrar `<Image src={icon} alt="" width={16} height={16} unoptimized />` en lugar de `<span aria-hidden="true">▣</span>`.

### 4.5. Insignias de Progreso de Consola y Filtros (`src/components/console-progress-badge.tsx`, `src/components/achievements-showcase.tsx`, `src/components/import-hub.tsx`)
- En `ConsoleProgressBadge` (`src/components/console-progress-badge.tsx`):
  Mostrar el icono oficial (`/platforms/steam.png`, `/platforms/xbox.png`, `/platforms/playstation.png`) en `.console-progress-heading` reemplazando el emoji falso `🎮` en Gamerscore.
- En `AchievementsShowcase` (`src/components/achievements-showcase.tsx`) e `ImportHub` (`src/components/import-hub.tsx`):
  Incluir el icono `16×16` correspondiente en los botones de filtro de plataforma (`Steam`, `Xbox`, `PlayStation`).

---

## 5. Estilos CSS (`src/app/globals.css`)
Unificar la alineación de etiquetas con icono de plataforma junto con `.tracker-uid-tag` y `.gta6-platforms span`:

```css
.platform-tag,
.gta6-platforms span,
.hardware-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.platform-tag img,
.gta6-platforms span img,
.hardware-badge img,
.console-progress-heading img {
  width: 16px;
  height: 16px;
  object-fit: contain;
  flex-shrink: 0;
  border-radius: 50%;
}

.gta6-platforms span img {
  width: 18px;
  height: 18px;
}
```
