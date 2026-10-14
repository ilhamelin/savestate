# Propuesta Técnica: Integración de Instant Gaming y Conversión USD a Peso Chileno (CLP)

## 1. Análisis del Requerimiento

El usuario solicita dos mejoras para el panel de **"Ofertas PC · USD"** dentro del componente de telemetría en vivo del juego (`GameLiveTelemetryView`):
1. **Agregar la tienda Instant Gaming (`https://www.instant-gaming.com/es/`):** Incorporar Instant Gaming al radar de ofertas para que los jugadores puedan contrastar los precios de distribuidores oficiales con las ofertas de claves de PC.
2. **Conversión precisa de Dólar (USD) a Peso Chileno (CLP):** Mostrar visualmente y de forma precisa la equivalencia de cada precio en moneda local chilena (CLP), tanto en precios de oferta como en el mínimo histórico.

---

## 2. Diagnóstico Técnico y Desafíos

### 2.1 Tienda Instant Gaming
- **Estado actual:** El radar de ofertas se alimenta de la API pública de **CheapShark** (`https://www.cheapshark.com/api/1.0/deals`), la cual indexa únicamente distribuidores oficiales autorizados (Steam, Epic Games Store, GreenManGaming, GOG, Humble, Fanatical).
- **Particularidad de Instant Gaming:** Instant Gaming es una plataforma de venta de claves (keyshop) que no está en la base de datos de CheapShark y protege su sitio web con Cloudflare Bot Management (`HTTP 403` a scrapers de backend).
- **Solución Arquitectónica:**
  - Agregar una fila de oferta dedicada para **Instant Gaming** dentro del bloque de ofertas de PC.
  - Generar el enlace directo a la búsqueda del título en español:
    `https://www.instant-gaming.com/es/busqueda/?q=${encodeURIComponent(title)}`
  - Etiquetar la tienda con un badge distintivo `KEYSHOP // CÓDIGOS PC`, ofreciendo al usuario la opción de comparar y consultar el stock de claves con un solo clic hacia la tienda oficial.

### 2.2 Conversión en Tiempo Real de USD a CLP
- **Fuente de Tasa de Cambio:** 
  Utilizar la API de tipos de cambio de bancos centrales `https://open.er-api.com/v6/latest/USD` (abierta, sin clave, ultra-rápida y con soporte nativo de `rates.CLP`).
- **Rendimiento y Resiliencia:**
  - Cachear el valor del dólar a nivel de servidor por 1 hora (`revalidate: 3600`) mediante `unstable_cache`.
  - Incluir un valor de contingencia (*fallback*) a 975 CLP en caso de indisponibilidad temporal de la API externa.
- **Formateo Visual:**
  - Utilizar el formateador estándar chileno con separador de miles:
    `Math.round(usd * rate).toLocaleString('es-CL')` (ej: `$19.79 USD` ➔ `(~$19.317 CLP)`).
  - Incluir la conversión en:
    1. Precios rebajados (`salePrice`).
    2. Precios normales tachados (`normalPrice`).
    3. Badge superior de Mínimo Histórico (`historicalLow`).
    4. Subtítulo o pill de cabecera indicando la tasa de cambio de referencia: `1 USD ≈ $976 CLP`.

---

## 3. Plan de Modificaciones en el Código

### 3.1 Dominio: `src/domain/game-live-telemetry.ts`
- Agregar `usdToClpRate?: number | null;` a la interfaz `GameLiveTelemetry`.
- Crear función utilitaria `formatClp(usdAmount: string | number, rate?: number | null): string`:
  Convierte montos y devuelve formato `~$X.XXX CLP`.

### 3.2 Servicio: `src/services/game-live-telemetry.ts`
- Implementar la función de obtención de tasa de cambio `getUsdToClpRate()` con caché de 1 hora.
- Integrar la tasa obtenida en el objeto devuelto por `fetchGameLiveTelemetry(title)`.

### 3.3 Vista: `src/components/game-live-telemetry-view.tsx`
- Actualizar el título de la sección a:
  `Ofertas PC · USD y CLP` con indicador de tipo de cambio `(1 USD ≈ $X CLP)`.
- En cada tarjeta de oferta, renderizar junto al precio en USD el valor estimado en CLP:
  ```tsx
  <span className="accent">
    ${deal.salePrice} USD
    {rate && <span className="clp-price font-mono text-xs text-muted ml-1">(~{formatClp(deal.salePrice, rate)})</span>}
  </span>
  ```
- Agregar el botón o tarjeta de **Instant Gaming**:
  ```tsx
  <article className="instant-gaming-deal">
    <div>
      <strong>Instant Gaming</strong>
      <span className="tag keyshop-tag">KEYSHOP</span>
    </div>
    <span className="muted">Catálogo & Códigos PC</span>
    <a
      className="button outline small"
      href={`https://www.instant-gaming.com/es/busqueda/?q=${encodeURIComponent(title)}`}
      target="_blank"
      rel="noopener noreferrer"
    >
      Ver en Instant Gaming ↗
    </a>
  </article>
  ```
- En el badge superior de mínimo histórico:
  `🏷️ Mínimo histórico: $12.90 USD (~$12.590 CLP)`.
