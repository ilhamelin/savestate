# Especificación Técnica: Fondos de Pantalla Dinámicos por Juego en `/rift`

## 1. Archivos Copiados a `public/wallpapers/`

Se copiaron los 4 wallpapers descargados en `C:\Users\benja\Downloads\ABDM\Pictures\Instagram_Picture` hacia `C:\Users\benja\OneDrive\Documentos\ChatGPT\savestate 2\public\wallpapers\`:

- **League of Legends (`lol`)**: `/wallpapers/rift_arcane.jpg` *(se mantiene el fondo actual sin cambios)*
- **Valorant (`valorant`)**: `/wallpapers/rift_valorant.jpg` *(desde `valorant-all-agents-hd-wallpaper-uhdpaper.com-585@1@g.jpg`)*
- **Genshin Impact (`genshin`)**: `/wallpapers/rift_genshin.jpg` *(desde `mavuika-genshin-impact-hd-wallpaper-uhdpaper.com-218@5@c.jpg`)*
- **Honkai: Star Rail (`hsr`)**: `/wallpapers/rift_hsr.jpg` *(desde `honkai-star-rail-characters-hd-wallpaper-uhdpaper.com-586@1@k.jpg`)*
- **Rust (`rust`)**: `/wallpapers/rift_rust.jpg` *(desde `rust-hazmat-suit-hd-wallpaper-1920x1080-uhdpaper.com-388.1_a.jpg`)*

---

## 2. Integración en `src/components/competitive-hub-tabs.tsx` y `src/app/rift/page.tsx`

1. En `src/components/competitive-hub-tabs.tsx`:
   - Importar `ProfileWallpaper` desde `'@/components/profile-wallpaper'`.
   - Definir el mapa de fondos por pestaña:
     - `lol`: `'/wallpapers/rift_arcane.jpg'`
     - `valorant`: `'/wallpapers/rift_valorant.jpg'`
     - `genshin`: `'/wallpapers/rift_genshin.jpg'`
     - `hsr`: `'/wallpapers/rift_hsr.jpg'`
     - `rust`: `'/wallpapers/rift_rust.jpg'`
   - Envolver el contenido de `CompetitiveHubTabs` dentro de `<ProfileWallpaper url={RIFT_WALLPAPERS[tab]} fullScreen>...</ProfileWallpaper>`.
2. En `src/app/rift/page.tsx`:
   - Quitar el envoltorio estático `<ProfileWallpaper url="/wallpapers/rift_arcane.jpg" fullScreen>` que rodeaba a `<CompetitiveHubTabs>` para evitar duplicar dos capas de `.profile-wallpaper-fullscreen` y permitir que `CompetitiveHubTabs` cambie dinámicamente el wallpaper según el juego seleccionado.
3. En `src/domain/wallpaper.ts` (si también se desea ofrecer estos fondos en el selector de perfil), opcionalmente añadirlos a `WALLPAPERS`.
