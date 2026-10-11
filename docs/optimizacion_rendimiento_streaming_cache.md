# Especificación Técnica: Optimización General de Rendimiento (Streaming SSR, Caché en Cliente, Deduplicación y GPU Scroll)

**Fecha:** 11 de octubre de 2026  
**Rama de origen:** `research/antigravity`  
**Rama de destino:** `implementation/chatgpt` (Codex)  
**Objetivo:** Aplicar cuatro optimizaciones clave de rendimiento técnico en SaveState para reducir el TTFB/FCP de la portada, eliminar latencias innecesarias en el catálogo `/explore`, deduplicar consultas de perfil en el servidor y garantizar un scroll constante a 60/120 FPS.

---

## 1. Streaming SSR con `<Suspense>` en la Portada (`src/app/page.tsx`)

### 1.1. Problema Detectado
* `Home()` ejecutaba `await Promise.all([getRecentGamingNews(), getActiveFreebies()])` antes de retornar el árbol JSX, bloqueando el renderizado inicial del Hero hasta que respondieran todos los feeds externos.

### 1.2. Solución
* Dividir la carga de datos externos en dos Server Components asíncronos internos (`NewsStream` y `FreebiesStream`) envueltos en `<Suspense>` con esqueletos ligeros de carga.
* **Resultado:** El Hero principal y el Header se envían al navegador en el primer chunk de forma inmediata (~0ms de bloqueo por APIs externas).

---

## 2. Caché en Memoria y Eliminación de Debounce en Pestañas de `/explore` (`src/components/explore.tsx`)

### 2.1. Problema Detectado
* Todos los cambios de filtro (incluidos los clics en pestañas de modo `Populares`, `Próximos Estrenos`, `Recientes`, `Clásicos` y `<select>`) pasaban por un `setTimeout(..., 350)` pensado para inputs de texto.
* Cambiar de una pestaña a otra y regresar disparaba una nueva petición de red y mostraba el skeleton aunque los datos ya se hubieran descargado segundos antes.

### 2.2. Solución
1. **Caché de sesión en memoria (`useRef<Map<string, Result>>`):**
   * Almacenar la respuesta de `/api/catalogue?${params}` indexada por su query string.
   * Si la clave ya existe en el `Map` (y no es un reintento manual), restaurar el resultado de inmediato (`0ms`) sin activar el skeleton de carga.
2. **Debounce selectivo:**
   * Aplicar espera (`300ms`) únicamente cuando cambian campos de escritura (`q`, `platform`, `year`).
   * Ejecutar la consulta en `0ms` cuando el usuario cambia `sort`, `genre`, `rating` o `offset`.

---

## 3. Deduplicación de Perfil del Usuario Autenticado (`src/lib/session.ts` y `src/components/header.tsx`)

### 3.1. Problema Detectado
* `Header` realizaba una consulta directa a `profiles` en cada renderizado para obtener el `username`, independiente de otras consultas en la misma petición HTTP.

### 3.2. Solución
* Exportar en `src/lib/session.ts` la función `currentViewerProfile` envuelta en `React.cache()`:
  ```ts
  export const currentViewerProfile = cache(async () => {
    const user = await currentUser();
    if (!user) return null;
    const db = await serverClient();
    const { data } = await db
      .from('profiles')
      .select('id, username, avatar_url, level')
      .eq('id', user.id)
      .maybeSingle();
    return data ?? null;
  });
  ```
* Consumir `currentViewerProfile()` en `src/components/header.tsx`.

---

## 4. Optimización de GPU Paint y Scroll a 60/120 FPS (`src/app/globals.css`)

### 4.1. Problema Detectado
* `background-attachment: fixed` en el `body` combinado con múltiples elementos con `backdrop-filter: blur()` puede causar *repaint* costoso en dispositivos móviles y pantallas de alta densidad durante el desplazamiento vertical.

### 4.2. Solución
* En pantallas móviles y tablets (`@media (max-width: 1024px)`), cambiar `background-attachment: scroll` en `body` para liberar la composición de capas en GPU.

---

## 5. Plan de Verificación

1. Verificar que la portada (`/`) renderiza el bloque Hero de inmediato mientras las secciones de Noticias y Juegos Gratis se resuelven vía `<Suspense>`.
2. En `/explore`, alternar entre `Populares` y `Próximos Estrenos` comprobando que el cambio es instantáneo al volver a una pestaña ya visitada.
3. Ejecutar `npm run check` asegurando que los tests, tipos y reglas de linter pasen con 0 errores.
