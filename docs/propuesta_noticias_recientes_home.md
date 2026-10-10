# Especificación Técnica: Módulo de Noticias Recientes de la Industria Gamer en Home (/)

**Fecha:** 10 de octubre de 2026  
**Rama de origen:** `research/antigravity`  
**Rama de destino:** `implementation/chatgpt` (Codex)  
**Objetivo:** Reemplazar en la página principal (`/` - `src/app/page.tsx`) la sección Arcade («Preparando el próximo duelo») y las 3 tarjetas estáticas de herramientas («01 Tu biblioteca», «02 Tu diario», «03 Tu comunidad») por un **módulo central de Noticias Recientes (Recent News)**, consumiendo en tiempo real feeds oficiales de prensa especializada (Vandal, IGN España, VGC) mediante Server Components de Next.js.

---

## 1. Justificación y Selección de Fuente de Datos

Tras la auditoría técnica de APIs:
* Las APIs de noticias genéricas (NewsAPI, GNews) imponen cuotas de 100 peticiones/día y bloquean dominios de producción (como Vercel) en sus planes gratuitos.
* Las APIs de videojuegos abiertas (FreeToGame, MMOBomb) no ofrecen noticias de la industria, solo listados de títulos F2P.
* **Solución óptima y probada:** Consumo de **Feeds RSS de prensa especializada de primer nivel** (Vandal para cobertura 100% gamer en español, IGN España para lanzamientos y cultura gamer, y VGC para noticias corporativas de la industria internacional).
  * 100% gratuito, sin API keys ni riesgo de agotamiento de cuotas.
  * Se cachea de forma nativa en Next.js con `{ next: { revalidate: 1800 } }` (actualización cada 30 minutos sin saturar la red).

---

## 2. Arquitectura de Implementación

### 2.1. Servicio de Noticias: `src/services/gaming-news.ts`
Función `getRecentGamingNews()` encargada de:
1. Consultar en paralelo:
   * **Vandal Videojuegos:** `https://vandal.elespanol.com/xml.cgi`
   * **IGN España:** `https://es.ign.com/feed.xml`
2. Extraer títulos, enlaces originales, fechas de publicación y snippets de descripción limpiando entidades HTML (`&apos;`, `&quot;`, `&amp;`, tags `<[^>]+>`).
3. Calcular tiempo relativo (`hace 1 h`, `hace 4 h`, `ayer`).
4. Unificar y ordenar los artículos cronológicamente (más recientes primero) devolviendo los primeros 10-12 titulares.
5. Devolver fallback vacío `[]` resiliente en caso de fallo de red puntual.

### 2.2. Componente Visual: `src/components/recent-news-section.tsx`
* **Cabecera Terminal:**
  * Indicador parpadeante: `● LIVE WIRE // TRANSMISIÓN ACTIVA`.
  * Título: `Noticias Recientes`.
  * Subtítulo: `Actualidad de consolas, estudios, lanzamientos y la industria gamer al minuto.`
* **Selector de Fuente:**
  * Pestañas de filtrado rápido con soporte accesible: `[ Todas ]` `[ Vandal ]` `[ IGN ]`.
* **Tabla / Wire de Noticias:**
  * **Columna 1 (Tiempo):** `HACE 2H`, `HACE 4H`.
  * **Columna 2 (Badge de Fuente):** `[VANDAL]` (tono cian), `[IGN]` (tono retro-ámbar).
  * **Columna 3 (Titular y Resumen):** Titular en negrita con enlace directo (`target="_blank" rel="noopener noreferrer"`), acompañado de un snippet de 1 línea atenuado.
  * **Columna 4 (Acción):** Icono flecha externa `↗`.

### 2.3. Actualización de `src/app/page.tsx`
* Retirar las importaciones y bloques de:
  * `<ArcadeSection />`
  * `<section className="intro-strip">`
  * `<section className="feature-grid">`
* Insertar `<Suspense fallback={<NewsSkeleton />}> <RecentNewsSection /> </Suspense>` inmediatamente después del Hero terminal.

### 2.4. Estilos en `src/app/globals.css`
Añadir clases:
* `.news-section`: contenedor con margen vertical y fondo de panel.
* `.news-pulse-dot`: punto verde neón con animación sutil de pulso.
* `.news-table` / `.news-list`: estructura de tabla responsive con hover neón.
* `.news-source-tag`: badges coloreados según la fuente (`vandal`, `ign`).
* `.news-time`: tipografía mono atenuada.

---

## 3. Plan de Verificación

1. Ingresar a la página principal (`/`).
2. Comprobar que ya no aparece el recuadro de arcade ni las 3 tarjetas estáticas.
3. Verificar que se despliegan noticias del día reales con fecha, fuente, titular legible y enlace funcional que abre la noticia externa en nueva pestaña.
4. Probar los filtros por fuente (`Todas`, `Vandal`, `IGN`).
5. Ejecutar `npm run check` para confirmar compilación limpia con 0 errores.
