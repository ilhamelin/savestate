# Especificación de Mejoras QoL: Paleta de Comandos Avanzada y Acciones en Notificaciones

**Fecha:** 9 de octubre de 2026  
**Rama de origen:** `research/antigravity`  
**Rama de destino:** `implementation/chatgpt` (Codex)  
**Objetivo:** Elevar los componentes ya existentes en la barra de navegación (`CommandMenu` y `NotificationBell`) a su versión más potente y útil para el usuario.

---

## 1. Módulo 1: Campana de Notificaciones con Acciones Directas (`NotificationBell`)

### 1.1. Estado actual
`src/components/notification-bell.tsx` ya cuenta con conexión Realtime y popover desplegable. Sin embargo, cuando una señal es de tipo `friend_request`, solo muestra un enlace de texto hacia el perfil del remitente.

### 1.2. Mejora interactiva
Añadir soporte de acciones inmediatas dentro del popover:
* Cuando `item.kind === 'friend_request'`:
  * Renderizar botones compactos inline:
    * `[ ✔ Aceptar ]` -> ejecuta `api('social', { action: 'respond', id: friendshipId, status: 'accepted' })`.
    * `[ ✖ Rechazar ]` -> ejecuta `api('social', { action: 'respond', id: friendshipId, status: 'rejected' })`.
  * Al responder, la notificación se actualiza al instante en la lista sin necesidad de recargar ni salir de la página actual.

---

## 2. Módulo 2: Paleta de Comandos Global Pro (`CommandMenu` - `Ctrl + K`)

### 2.1. Estado actual
`src/components/command-menu.tsx` ya abre el diálogo modal accesible mediante `Ctrl + K` / `Cmd + K`, busca en el catálogo IGDB y lista enlaces generales del sitio.

### 2.2. Mejoras de usabilidad
1. **Búsqueda de Jugadores / Amigos:**
   * Al escribir un nombre o prefijo con `@` (ej: `@ilhamelin`), consultar jugadores en `/api/players` o perfiles conocidos y permitir saltar a su perfil instantáneamente.
2. **Acciones Rápidas del Usuario:**
   * Si está autenticado, incluir acciones frecuentes en la lista:
     * `🎮 Ir a mi biblioteca`
     * `🏆 Ver mi vitrina de logros`
     * `⚙️ Ajustes de mi cuenta`
     * `🌓 Alternar efecto CRT` / `🔊 Conmutar audio arcade`

---

## 3. Plan de Verificación para Codex

1. En `src/components/notification-bell.tsx`, integrar los botones de acción rápida para solicitudes de amistad.
2. En `src/components/command-menu.tsx`, enriquecer los resultados de búsqueda para incluir jugadores y accesos directos de perfil.
3. Verificar con `npm run check`.
