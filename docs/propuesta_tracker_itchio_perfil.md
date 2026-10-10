# Especificación Técnica: Rastreador de Juegos Indie y Notificaciones de Versión (Itch.io Tracker)

**Fecha:** 9 de octubre de 2026  
**Origen:** Auditoría e Investigación (`research/antigravity`)  
**Destino:** Implementación en Savestate (`savestate 2` / Codex)  
**Propósito:** Permitir a los usuarios rastrear cualquier juego de `itch.io` desde su perfil de Savestate, monitorizar versiones nuevas (devlogs/parches), saber con certeza si la alarma de nueva versión está activa y recibir alertas automáticas en la web y en Discord, sin sobrecargar la interfaz con sistemas de hitos innecesarios.

---

## 1. Visión General de la Función

Los juegos independientes en itch.io (visual novels, juegos episódicos, acceso anticipado) se actualizan frecuentemente sin un cliente centralizado. Esta función agrega un módulo en el Perfil del Jugador enfocado 100% en la detección de versiones:
1. **Rastrea la URL de cualquier juego de itch.io**: Obtiene automáticamente portada, título, autor, capturas y devlogs mediante `/data.json` y `/devlog.rss`.
2. **Alerta de Nuevas Versiones**: Detecta cuando se publica un devlog o versión nueva (ej: cuando *Starmaker Story* pase de `v1.8E` a `v1.9`).
3. **Indicador de Alarma / Radar Activo**: Un panel visual destacado que confirma al usuario que Savestate está vigilando activamente el juego y le avisará en cuanto se detecte una versión superior a la que está jugando.
4. **Notificación Dual (Web + Discord)**:
   - **Savestate**: Notificación en el buzón/campanita (`/notifications`).
   - **Discord**: Mensaje embed enriquecido mediante el bot/webhook ya configurado en Savestate.
5. **Control de Estado y Notas de Guardado**:
   - Selector de "Versión que juegas" vs. "Última versión detectada".
   - Estado de juego (*Jugando*, *Completado*, *Esperando versión*).
   - Notas privadas para partidas guardadas (slots, decisiones, claves).
   *(Nota: Se remueve la función de hitos/checklists para mantener la tarjeta limpia y centrada en las alarmas de versión).*

---

## 2. Flujo de Datos y Endpoints

### 2.1. Endpoints de itch.io Utilizados
Para cualquier juego `https://{usuario}.itch.io/{slug}`:
- **Metadatos e Imágenes:** `https://{usuario}.itch.io/{slug}/data.json`
- **Registro de Actualizaciones:** `https://{usuario}.itch.io/{slug}/devlog.rss`

### 2.2. Endpoints en Savestate: `src/app/api/tracker/itch/route.ts`

#### `POST /api/tracker/itch/inspect`
Recibe `{ url: string }`.
1. Normaliza la URL (ej: `https://arvusgames.itch.io/starmakerstory`).
2. Consulta `/data.json` y `/devlog.rss`.
3. Devuelve portada, título, autor, capturas y última versión registrada en devlog.

#### `POST /api/tracker/itch/check-updates`
Compara la versión actual del usuario con el RSS remoto.
Si detecta una versión superior:
1. Registra una notificación en el almacén de notificaciones de Savestate para el usuario.
2. Si `DISCORD_WEBHOOK_URL` está activo, envía un embed a Discord con el nuevo parche y enlace directo.

---

## 3. Componente de UI en el Perfil (`src/components/profile-indie-tracker.tsx`)

### 3.1. Elementos que se Remueven
* ❌ Barra de progreso de hitos (`Hitos: 0 / 0 · 0%`).
* ❌ Lista de hitos (Checkboxes).
* ❌ Campo de texto *"Nuevo hito"* y botón *"Añadir hito"*.

### 3.2. Elementos que se Mantienen
* ✔️ Cabecera con portada oficial, título, autor, devlogs y botones a la web de itch.io.
* ✔️ Selector de "Versión que estoy jugando" con botón "Estoy jugando la última detectada".
* ✔️ Selector de estado (*Esperando actualización*, *Jugando*, etc.).
* ✔️ Notas privadas de guardado (desplegable).
* ✔️ Botones: *Guardar checkpoint*, *Comprobar actualizaciones*, *Dejar de rastrear*.

### 3.3. Elemento Nuevo: Panel de Alarma de Nueva Versión
Un bloque visual destacado (estilo terminal cyber):
* **Estado Normal (Al día):**
  `🔔 Alarma de versión: ACTIVA`
  `Savestate está vigilando itch.io para este juego. Cuando el desarrollador publique una versión superior a la tuya (actualmente [1.8D]), te notificará automáticamente en la campana de Savestate y en tu canal de Discord.`
* **Estado Disparado (Nueva versión detectada):**
  `🚨 ¡ALARMA DISPARADA: NUEVA VERSIÓN DETECTADA! (v1.9)`
  `El desarrollador ha publicado una versión más reciente. Revisa tus notificaciones y descarga la actualización.`
