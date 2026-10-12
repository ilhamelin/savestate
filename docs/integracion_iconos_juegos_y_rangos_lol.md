# Especificación Técnica: Integración de Iconos Oficiales de Juegos en `/rift` y Emblemas de Rango en League of Legends

## 1. Archivos Copiados al Proyecto (`public/icons/`)

Se copiaron directamente desde `C:\Users\benja\Downloads\ABDM\Pictures\Instagram_Picture` hacia `C:\Users\benja\OneDrive\Documentos\ChatGPT\savestate 2\public\icons\`:

1. **Iconos de Juegos (`public/icons/games/`)**:
   - `/icons/games/lol.png` (`Icon for League of Legends by Henko Hallows/imgi_3_128x128.png`)
   - `/icons/games/valorant.png` (`Icon for Valorant by gean123902/imgi_3_128x128.png`)
   - `/icons/games/genshin.png` (`Icon for Genshin Impact by Aquillo/imgi_2_54795ec619ebda94c86d00184861c96f.png`)
   - `/icons/games/hsr.png` (`Icon for Honkai_ Star Rail by zakuroangel/imgi_2_ec01a34f7fc3b03448cc52f2a89d52e8.png`)
   - `/icons/games/rust.png` (`Icon for Rust by BigHungryChicken/imgi_3_128x128.png`)
   - `/icons/games/zzz.png` (`Icon for Zenless Zone Zero by Sylverstone14/imgi_2_7029a498c4f596f73b35504df9bab02a.png`)

2. **Emblemas de Rango de League of Legends (`public/icons/lol-ranks/`)**:
   - `/icons/lol-ranks/unranked.png` (`imgi_266_240px-Season_2022_-_Unranked.png`)
   - `/icons/lol-ranks/iron.png` (`imgi_267_240px-Season_2022_-_Iron.png`)
   - `/icons/lol-ranks/bronze.png` (`imgi_268_240px-Season_2022_-_Bronze.png`)
   - `/icons/lol-ranks/silver.png` (`imgi_269_240px-Season_2022_-_Silver.png`)
   - `/icons/lol-ranks/gold.png` (`imgi_270_240px-Season_2022_-_Gold.png`)
   - `/icons/lol-ranks/platinum.png` (`imgi_260_240px-Season_2023_-_Platinum.png`)
   - `/icons/lol-ranks/emerald.png` (Emblema oficial Emerald)
   - `/icons/lol-ranks/diamond.png` (`imgi_262_240px-Season_2023_-_Diamond.png`)
   - `/icons/lol-ranks/master.png` (`imgi_273_240px-Season_2022_-_Master.png`)
   - `/icons/lol-ranks/grandmaster.png` (`imgi_274_240px-Season_2022_-_Grandmaster.png`)
   - `/icons/lol-ranks/challenger.png` (`imgi_275_240px-Season_2022_-_Challenger.png`)

---

## 2. Integración en el Frontend

### 2.1. Botones de Selección de Juego en `src/components/competitive-hub-tabs.tsx`

1. En `src/components/competitive-hub-tabs.tsx`, reemplazar los emojis de las pestañas por el icono correspondiente usando `<Image src={icon} alt="" width={22} height={22} className="tracker-tab-icon" unoptimized />`:
   - `lol`: `/icons/games/lol.png` + `'League of Legends'`
   - `valorant`: `/icons/games/valorant.png` + `'Valorant (Riot ID)'`
   - `genshin`: `/icons/games/genshin.png` + `'Genshin Impact'`
   - `hsr`: `/icons/games/hsr.png` + `'Honkai: Star Rail'`
   - `rust`: `/icons/games/rust.png` + `'Rust (Steam)'`
2. Además, en el encabezado `<h1>` de cada terminal competitivo (`Valorant`, `Genshin Impact`, `Honkai: Star Rail`, `Rust` y `League of Legends`), mostrar el icono oficial del juego a `36×36 px` junto al título.

### 2.2. Emblemas de Rango en `RankCard` (`src/components/profile-lol-tracker.tsx`)

1. En `RankCard` dentro de `src/components/profile-lol-tracker.tsx` (líneas 154–195), reemplazar el icono genérico `<Trophy size={30} />` por el emblema oficial de rango correspondiente en `/icons/lol-ranks/`:
   - Definir un mapa seguro `LOL_RANK_ICONS: Record<string, string>`:
     - `IRON`: `'/icons/lol-ranks/iron.png'`
     - `BRONZE`: `'/icons/lol-ranks/bronze.png'`
     - `SILVER`: `'/icons/lol-ranks/silver.png'`
     - `GOLD`: `'/icons/lol-ranks/gold.png'`
     - `PLATINUM`: `'/icons/lol-ranks/platinum.png'`
     - `EMERALD`: `'/icons/lol-ranks/emerald.png'`
     - `DIAMOND`: `'/icons/lol-ranks/diamond.png'`
     - `MASTER`: `'/icons/lol-ranks/master.png'`
     - `GRANDMASTER`: `'/icons/lol-ranks/grandmaster.png'`
     - `CHALLENGER`: `'/icons/lol-ranks/challenger.png'`
   - Cuando `rank` sea `null` o `status !== 'available'`, usar `'/icons/lol-ranks/unranked.png'`.
2. Renderizar dentro de `.lol-rank-emblem`:
   `<Image src={emblemSrc} alt={tier || 'Sin clasificar'} width={56} height={56} className="lol-rank-emblem-img" unoptimized />`
3. Ajustar `.lol-rank-emblem` en `src/app/globals.css` a `width: 64px; height: 64px;` con fondo sutil para que los emblemas de rango luzcan nítidos y proporcionados.
