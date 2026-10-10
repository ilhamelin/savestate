# Especificación Técnica: Incorporación de Fuente Anime & Manga a Noticias Recientes

**Fecha:** 10 de octubre de 2026  
**Rama de origen:** `research/antigravity`  
**Rama de destino:** `implementation/chatgpt` (Codex)  
**Objetivo:** Añadir una nueva categoría y fuente de **Anime, Manga y Cultura Geek en Español** (`AreaJugones Anime`) a la tabla de Noticias Recientes de la portada, complementando a Vandal e IGN con cobertura de estrenos, adaptaciones de videojuegos y series, con imágenes HD y cumplimiento total con las normativas de hosting en Vercel.

---

## 1. Fuente Seleccionada: AreaJugones Anime

* **URL del Feed:** `https://areajugones.sport.es/anime/feed/`
* **Contenido:** Noticias de actualidad de anime, manga, adaptaciones de videojuegos, series y cultura otaku en español.
* **Imágenes:** Proporciona imágenes HD (1024x576) en cada publicación alojadas en su CDN oficial.
* **Seguridad y compatibilidad:** Apta para todo público, sin riesgos de suspensión por políticas de contenido NSFW en Vercel.

---

## 2. Modificaciones en el Código

### 2.1. Actualizar `src/domain/gaming-news.ts`
1. Ampliar el tipo de fuentes:
   ```ts
   export type GamingNewsSource = 'vandal' | 'ign' | 'anime';
   ```
2. Añadir la validación de host en `parseGamingRss`:
   ```ts
   const hosts =
     source === 'vandal'
       ? ['vandal.elespanol.com', 'www.vandal.elespanol.com']
       : source === 'ign'
         ? ['es.ign.com']
         : ['areajugones.sport.es'];
   ```

### 2.2. Actualizar `src/services/gaming-news.ts`
Incluir la nueva fuente en la consulta paralela de feeds:
```ts
const sources = [
  { name: 'Vandal', url: 'https://vandal.elespanol.com/xml.cgi', source: 'vandal' as const },
  { name: 'IGN', url: 'https://es.ign.com/feed.xml', source: 'ign' as const },
  { name: 'Anime', url: 'https://areajugones.sport.es/anime/feed/', source: 'anime' as const },
];
```

### 2.3. Actualizar `src/components/recent-news-section.tsx`
1. Añadir el botón de filtro en la barra superior:
   ```tsx
   { [
     ['all', 'Todas'],
     ['vandal', 'Vandal'],
     ['ign', 'IGN'],
     ['anime', 'Anime & Manga'],
   ] as const }
   ```
2. Renderizar el badge `[ANIME]` con su color temático correspondiente.

### 2.4. Estilos en `src/app/globals.css`
Añadir el badge temático rosa/synthwave para la categoría Anime:
```css
.badge-anime {
  color: #ff0055;
}
```

---

## 3. Plan de Verificación

1. En la Home (`/`), verificar que la barra de filtros ahora tiene la pestaña `[ Anime & Manga ]`.
2. Comprobar que al hacer clic en `Anime & Manga`, se despliegan noticias de anime/manga con sus imágenes HD y badge `[ANIME]` en color fucsia/synthwave.
3. Verificar que al seleccionar `Todas`, las noticias se mezclan cronológicamente.
4. Ejecutar `npm run check`.
