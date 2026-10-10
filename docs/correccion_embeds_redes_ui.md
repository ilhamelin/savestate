# Propuesta Técnica: Corrección de Interfaz y Estilos para Embeds de Redes (Twitter/X e Instagram)

**Fecha:** 9 de octubre de 2026  
**Origen:** Auditoría e Investigación (`research/antigravity`)  
**Destino:** Equipo de Implementación (`implementation/chatgpt` / Codex)  
**Propósito:** Corregir los problemas visuales detectados en las incrustaciones de Twitter e Instagram (bloque blanco cegador en fondo oscuro, scrollbars, desbordamiento de ancho) y manejar limpiamente los enlaces de Instagram privados o con restricciones.

---

## 1. Diagnóstico de los Problemas

### 1.1. Bloque blanco gigante en el marco interactivo (Twitter / X)
* **Causa técnica:** En `src/app/globals.css`, `.social-embed-frame` tiene `width: 100%` y `height: 560px` sin `max-width` ni fondo definido.
* Como el widget de Twitter tiene un ancho máximo nativo de `550px`, el navegador rellena el resto del `iframe` (hasta el 100% del contenedor, que mide 800px o más) con el color de fondo por defecto del navegador: **blanco puro (`#FFFFFF`)**. Esto choca visualmente de forma agresiva con la estética cyber-retro oscura de Savestate.

### 1.2. Fallo en el embed de Instagram ("Es posible que el enlace sea incorrecto...")
* **Causa técnica:** Meta/Instagram no permite incrustar publicaciones de:
  1. Cuentas privadas.
  2. Publicaciones con restricción de edad (18+).
  3. Enlaces con parámetros de seguimiento externos (`?dlrf=...`, `?igsh=...`) que causan errores en la ruta de `/embed/`.
* Al fallar, Instagram inyecta una página de error dentro del iframe con fondo blanco cegador.

---

## 2. Arquitectura de la Solución

### 2.1. Ajuste de Estilos CSS (`src/app/globals.css`)
1. Centrar el contenedor del embed y evitar que se desborde o pinte fondos blancos.
2. Añadir `max-width: 550px`, centrado automático `margin: 0 auto`, `border-radius: 12px` y fondo negro transparente `background: #0d1117` con `color-scheme: dark`:

```css
.social-embed {
  min-width: 0;
  overflow-wrap: anywhere;
  margin: 1rem 0;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid var(--line);
  border-radius: 8px;
}

.social-embed-frame {
  display: block;
  width: 100%;
  max-width: 550px;
  min-height: 500px;
  height: 600px;
  border: 0;
  border-radius: 12px;
  background: #000;
  color-scheme: dark;
  margin: 0 auto 1rem;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6);
}
```

### 2.2. Limpieza de Parámetros en URLs de Instagram (`src/domain/social-embed.ts`)
Asegurar que al extraer la URL canónica de Instagram, se eliminen todos los parámetros query (`?dlrf=...`, `?igsh=...`) que puedan romper el endpoint de `/embed/`:
```ts
const instagram = /^\/(p|reel)\/([a-zA-Z0-9_-]{1,80})\/?/.exec(url.pathname);
if (host === 'instagram.com' && instagram) {
  const shortcode = instagram[2];
  const type = instagram[1];
  const canonical = `https://www.instagram.com/${type}/${shortcode}/`;
  return {
    provider: 'instagram',
    url: canonical,
    frameUrl: `https://www.instagram.com/${type}/${shortcode}/embed/captioned/`,
  };
}
```

### 2.3. Tarjeta de Fallback Elegante para Instagram / Twitter
En `src/components/social-embed.tsx`:
* Si la publicación no carga o el usuario prefiere no cargar el iframe, mostrar una tarjeta compacta estilo terminal retro con el logo de la red social, el enlace original y un botón para abrir en pestaña nueva sin romper el diseño del foro ni mostrar cajas blancas.
* Agregar `style={{ background: '#000', colorScheme: 'dark' }}` directamente al tag `<iframe>`.

---

## 3. Plan de Cambios para Codex

1. **`src/app/globals.css`**: Actualizar `.social-embed` y `.social-embed-frame` con `max-width: 550px`, centrado y fondo `#000` con `color-scheme: dark`.
2. **`src/domain/social-embed.ts`**: Limpiar parámetros query en enlaces de Instagram para evitar redirecciones fallidas de Meta.
3. **`src/components/social-embed.tsx`**: Aplicar atributos de estilo oscuro en el iframe y mejorar la presentación del fallback.
4. **Verificación**: `npm run check` y redespliegue con `npx vercel --prod`.
