# Especificación Técnica: Miniaturas e Imágenes en Noticias Recientes (/ y RecentNewsSection)

**Fecha:** 10 de octubre de 2026  
**Rama de origen:** `research/antigravity`  
**Rama de destino:** `implementation/chatgpt` (Codex)  
**Objetivo:** Enriquecer visualmente cada fila de noticias en la portada extrayendo la imagen/carátula de la noticia desde los feeds RSS (Vandal e IGN) y mostrándola como una miniatura panorámica 16:9 (`88x50px`) integrada en la cuadrícula de la tabla.

---

## 1. Análisis de Fuentes RSS y Extracción de Imágenes

En la auditoría técnica de los feeds:
* **IGN España (`https://es.ign.com/feed.xml`):** Proporciona la imagen principal dentro del tag `<description>` como un elemento `<img>` con `src="https://sm.ign.com/..."`.
* **Vandal (`https://vandal.elespanol.com/xml.cgi`):** Incluye imágenes alojadas en `https://media.vandal.net/...` o `https://videos.vandalimg.com/...` dentro del texto de la noticia (tanto en tags directos como entidades escapadas `&lt;img ... &gt;`).

### Regla de extracción robusta (`extractNewsImage`):
1. Detectar tags `<enclosure url="..." />` o `<media:content / media:thumbnail url="..." />`.
2. Detectar tags directos `<img src="..." />`.
3. Detectar tags escapados `&lt;img src=&quot;...&quot;` o `&#34;`.
4. Fallback por expresión regular a URLs que terminen en `.jpg`, `.jpeg`, `.png`, `.webp`, `.avif`.

---

## 2. Modificaciones Requeridas

### 2.1. Actualizar `src/domain/gaming-news.ts`

1. Añadir `imageUrl` opcional en la interfaz:
   ```ts
   export interface GamingNewsItem {
     title: string;
     url: string;
     publishedAt: string;
     description: string;
     source: GamingNewsSource;
     relativeTime: string;
     imageUrl?: string | null;
   }
   ```
2. Añadir función extractora antes de `parseGamingRss`:
   ```ts
   export function extractNewsImage(itemXml: string): string | null {
     const enclosure = itemXml.match(/<enclosure\b[^>]*\burl=(["'])(.*?)\1/i)?.[2];
     if (enclosure && /^https?:\/\//i.test(enclosure)) return enclosure;

     const media = itemXml.match(/<media:(?:thumbnail|content)\b[^>]*\burl=(["'])(.*?)\1/i)?.[2];
     if (media && /^https?:\/\//i.test(media)) return media;

     const imgRaw = itemXml.match(/<img\b[^>]*\bsrc=(["'])(.*?)\1/i)?.[2];
     if (imgRaw && /^https?:\/\//i.test(imgRaw)) return imgRaw;

     const imgEncoded = itemXml.match(/&lt;img\b[^&]*\bsrc=(?:&quot;|&#34;|['"])(https?:\/\/[^&"'\s>]+)(?:&quot;|&#34;|['"])/i)?.[1];
     if (imgEncoded) return imgEncoded;

     const anyImg = itemXml.match(/https?:\/\/[^"'\s<>&]+?\.(?:jpg|jpeg|png|webp|avif)/i)?.[0];
     if (anyImg) return anyImg;

     return null;
   }
   ```
3. En `parseGamingRss`, asignar:
   ```ts
   imageUrl: extractNewsImage(item),
   ```

### 2.2. Actualizar `src/components/recent-news-section.tsx`

Renderizar la miniatura en cada fila de noticias:
```tsx
<li className="news-row" key={item.url}>
  <time className="news-time" dateTime={item.publishedAt}>
    {item.relativeTime}
  </time>
  <span className={`news-source-tag badge-${item.source}`}>
    [{item.source.toUpperCase()}]
  </span>
  <div className="news-thumbnail">
    {item.imageUrl ? (
      <img
        src={item.imageUrl}
        alt=""
        className="news-thumb-img"
        loading="lazy"
      />
    ) : (
      <span className="news-thumb-placeholder" aria-hidden="true">
        🎮
      </span>
    )}
  </div>
  <div className="news-copy">
    <a className="news-title" href={item.url} target="_blank" rel="noopener noreferrer">
      {item.title}
      <span className="sr-only"> (abre en otra pestaña)</span>
    </a>
    {item.description ? <p className="news-desc">{item.description}</p> : null}
  </div>
  <span className="news-arrow" aria-hidden="true">
    ↗
  </span>
</li>
```

### 2.3. Actualizar `src/app/globals.css`

Añadir estilos para `.news-thumbnail` y actualizar la cuadrícula `.news-row`:
```css
.news-row {
  display: grid;
  grid-template-columns: 80px 70px 88px minmax(0, 1fr) 20px;
  align-items: center;
  gap: 1rem;
  padding: 0.85rem 0;
  border-top: 1px solid var(--line);
}

.news-thumbnail {
  width: 88px;
  height: 50px;
  flex-shrink: 0;
  border-radius: 4px;
  overflow: hidden;
  background: #0d1117;
  border: 1px solid var(--line);
  display: flex;
  align-items: center;
  justify-content: center;
}

.news-thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.news-thumb-placeholder {
  font-size: 1.1rem;
  opacity: 0.35;
}

@media (max-width: 700px) {
  .news-row {
    grid-template-columns: 80px minmax(0, 1fr) 20px;
    gap: 0.5rem;
  }
  .news-thumbnail {
    display: none;
  }
}
```

---

## 3. Plan de Verificación

1. Comprobar que en `/` cada fila muestra su miniatura gráfica en formato 16:9 (`88x50px`).
2. Comprobar que al pasar el mouse sobre la fila se mantiene el hover neón y la transición fluida.
3. Ejecutar `npm run check` para asegurar 0 errores de compilación o linter.
