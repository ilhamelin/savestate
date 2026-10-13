# Especificación Técnica: Incorporación de 3DJuegos a Noticias Recientes (`/` y `RecentNewsSection`)

**Fecha:** 12 de octubre de 2026  
**Rama de origen:** `research/antigravity`  
**Rama de destino:** `implementation/chatgpt` (Codex)  
**Objetivo:** Integrar **3DJuegos (`https://www.3djuegos.com/`)** como nueva fuente oficial en tiempo real dentro del módulo `GLOBAL GAMING WIRE // LIVE TICKER` (**Noticias Recientes**) de la portada (`/`), con soporte completo de extracción de imágenes HD, validación estricta de dominios/orígenes, pestaña de filtro dedicada `[ 3DJuegos ]` y badge cromático `[3DJUEGOS]`.

---

## 1. Auditoría Técnica del Feed RSS de 3DJuegos

Se auditaron los endpoints públicos de `https://www.3djuegos.com/` bajo las restricciones de seguridad de `readFeed` en `src/services/gaming-news.ts` (`redirect: 'error'`, límite de `1 MB` y timeout de `6000 ms`):

1. **Endpoint RSS Directo (sin redirección HTTP 301/302):**
   - **URL Oficial:** `https://www.3djuegos.com/feedburner.xml`
   - *(Nota técnica importante: `https://www.3djuegos.com/index.xml` devuelve redirección hacia `/feedburner.xml`, lo cual fallaría con `redirect: 'error'`. Por ello se debe consumir directamente `https://www.3djuegos.com/feedburner.xml`, que responde `200 OK` con `Content-Type: text/xml; charset=UTF-8` y ~27 noticias recientes).*
2. **Estructura XML de cada `<item>`:**
   - `<title><![CDATA[...]]></title>`: Título de la noticia en español.
   - `<link>https://www.3djuegos.com/...</link>`: Enlace canónico con hostname `www.3djuegos.com` (o `3djuegos.com`).
   - `<pubDate>Mon, 12 Oct 2026 23:16:25 +0200</pubDate>`: Fecha RFC-2822 compatible con `Date.parse`.
   - `<description><![CDATA[ <p><img src="https://i.blogs.es/.../1024_2000.jpeg" alt="..."></p><p>Resumen...</p> ]]></description>`:
     - Incluye en el primer párrafo la **imagen de portada en alta definición (`1024_2000.jpeg`)** alojada en el CDN editorial de Webedia/3DJuegos (`i.blogs.es` e `i.3djuegos.com`), seguida de los párrafos de resumen.

---

## 2. Modificaciones Requeridas en el Código

### 2.1. Actualizar el Dominio (`src/domain/gaming-news.ts`)

1. **Ampliar el tipo `GamingNewsSource`:**
   ```ts
   export type GamingNewsSource = 'vandal' | '3djuegos' | 'ign' | 'anime';
   ```

2. **Permitir los CDNs de imágenes de 3DJuegos en `extractNewsImage`:**
   Añadir `'i.blogs.es'` e `'i.3djuegos.com'` a la lista blanca de hostnames seguros dentro de `safeImage`:
   ```ts
   ![
     'sm.ign.com',
     'media.vandal.net',
     'videos.vandalimg.com',
     'areajugones.sport.es',
     'i.blogs.es',
     'i.3djuegos.com',
   ].includes(url.hostname)
   ```

3. **Validar los hostnames de artículos de 3DJuegos en `parseGamingRss`:**
   ```ts
   const hosts =
     source === 'vandal'
       ? ['vandal.elespanol.com', 'www.vandal.elespanol.com']
       : source === '3djuegos'
         ? ['www.3djuegos.com', '3djuegos.com']
         : source === 'ign'
           ? ['es.ign.com']
           : ['areajugones.sport.es'];
   ```

---

### 2.2. Actualizar el Servicio RSS (`src/services/gaming-news.ts`)

Incorporar `3djuegos` al arreglo `feeds` que se consulta concurrentemente con `Promise.allSettled` y caché ISR de 30 minutos (`revalidate: 1800`):

```ts
const feeds: { source: GamingNewsSource; url: string }[] = [
  { source: 'vandal', url: 'https://vandal.elespanol.com/xml.cgi' },
  { source: '3djuegos', url: 'https://www.3djuegos.com/feedburner.xml' },
  { source: 'ign', url: 'https://es.ign.com/feed.xml' },
  { source: 'anime', url: 'https://areajugones.sport.es/anime/feed/' },
];
```

---

### 2.3. Actualizar el Componente UI (`src/components/recent-news-section.tsx`)

1. Añadir el botón de filtro `['3djuegos', '3DJuegos']` en la barra `.news-filters`:
   ```tsx
   {(
     [
       ['all', 'Todas'],
       ['vandal', 'Vandal'],
       ['3djuegos', '3DJuegos'],
       ['ign', 'IGN'],
       ['anime', 'Anime & Manga'],
     ] as const
   ).map(([value, label]) => (
   ```
2. El badge de cada fila seguirá renderizando automáticamente:
   ```tsx
   <span className={`news-source-tag badge-${item.source}`}>
     [{item.source.toUpperCase()}]
   </span>
   ```
   Lo que generará `<span class="news-source-tag badge-3djuegos">[3DJUEGOS]</span>`.

---

### 2.4. Actualizar Estilos (`src/app/globals.css`)

1. **Ampliar ligeramente la columna del tag de fuente en `.news-row`** de `70px` a `88px` para que `[3DJUEGOS]` (10 caracteres) quepa en una sola línea sin truncarse ni solaparse con la miniatura:
   ```css
   .news-row {
     display: grid;
     grid-template-columns: 80px 88px 88px minmax(0, 1fr) 20px;
     align-items: center;
     gap: 1rem;
     padding: 0.85rem 0;
     border-top: 1px solid var(--line);
   }
   ```
2. **Añadir el color distintivo para `.badge-3djuegos`** (naranja/coral energético característico de 3DJuegos `#ff5722` / `#ff6b35`, diferenciándose del cian de Vandal `#00f0ff`, el ámbar de IGN `#ffb000` y el fucsia de Anime `#ff0055`):
   ```css
   .badge-3djuegos {
     color: #ff6b35;
   }
   ```

---

### 2.5. Actualizar Pruebas Unitarias (`tests/unit/gaming-news.test.ts` y `tests/unit/gaming-news-service.test.ts`)

1. En `tests/unit/gaming-news.test.ts`:
   - Añadir prueba verificando que `parseGamingRss` con `source = '3djuegos'` acepta enlaces de `https://www.3djuegos.com/...`, extrae imágenes de `https://i.blogs.es/...` e `https://i.3djuegos.com/...`, y rechaza dominios falsos (`www.3djuegos.com.evil.example`).
2. En `tests/unit/gaming-news-service.test.ts`:
   - Actualizar el mock de `globalThis.fetch` para mapear `url.includes('3djuegos.com')` al host `'www.3djuegos.com'`, verificando que ahora se realizan `4` peticiones en paralelo (`maxActive === 4`, `news.length === 4` en modo `'ok'` y `partial.length === 3` cuando falla `'es.ign.com'`).

---

## 3. Plan de Verificación

1. Ejecutar `npm test` y comprobar que `tests/unit/gaming-news.test.ts` y `tests/unit/gaming-news-service.test.ts` pasan al 100%.
2. Verificar en `/` que la barra de filtros muestra `[ Todas ]`, `[ Vandal ]`, `[ 3DJuegos ]`, `[ IGN ]`, `[ Anime & Manga ]`.
3. Hacer clic en `3DJuegos` y comprobar que se listan las noticias con su miniatura `88x50px` cargada desde `https://i.blogs.es/...`, badge `[3DJUEGOS]` en color `#ff6b35`, resumen limpio sin HTML y enlace externo funcional.
