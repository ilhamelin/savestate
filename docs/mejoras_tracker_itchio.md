# Especificación Técnica: Mejoras Clave para el Rastreador de itch.io

**Versión:** 2.0  
**Fecha:** 10 de octubre de 2026  
**Módulos Afectados:** `src/domain/itch-tracker.ts`, `src/integrations/itch/server.ts`, `src/app/api/cron/check-itch/route.ts`, `vercel.json`, `src/components/profile-indie-tracker.tsx`  
**Destino:** Implementación en Savestate (`savestate 2` / Codex)  

---

## 1. Resumen de Mejoras Aprobadas

Para maximizar la precisión y la comodidad del rastreador de versiones sin requerir intervención manual constante, se implementan tres funciones clave:

1. **Filtro Inteligente contra Falsas Alarmas:** Distingue entre comunicados/artículos de noticias y actualizaciones reales con archivos descargables.
2. **Detector de Archivos e Instaladores (`upload_id` / peso):** Detecta cuando el desarrollador sube un nuevo archivo `.zip` o `.exe` a itch.io, incluso antes de que publique el devlog.
3. **Vigilancia Automática 24/7 (Vercel Cron Job):** Revisa automáticamente en segundo plano y envía alertas a Discord y a la campana web sin necesidad de pulsar botones en la página.

---

## 2. Detalle de Implementación Técnica

### 2.1. Filtro Inteligente: "Alerta Solo si es Nueva Versión" (`src/domain/itch-tracker.ts`)

#### Lógica de Detección:
Un devlog solo dispara la alarma si cumple alguna de estas condiciones:
1. Contiene un número de versión explícito (ej. `v1.9`, `1.8E`, `1.8.4`).
2. El título incluye palabras clave inequívocas de lanzamiento:
   `/(release|update|patch|hotfix|build|versión|nueva versión|actualización)/i`.

Si un devlog es de tipo social o noticia (ej: *"Fanart Contest"*, *"Happy Holidays"*, *"Q&A"*):
- Se almacena y se muestra en la tarjeta como *"Última noticia del autor"*.
- **NO activa la alarma ni envía spam a Discord** porque no hay juego nuevo que descargar.

```typescript
export function isReleaseDevlog(title: string, version: string | null): boolean {
  if (version !== null) return true;
  return /(release|update|patch|hotfix|build|versión|actualización)/i.test(title);
}
```

---

### 2.2. Detector de Cambio de Archivo (`upload_id` y tamaño) (`src/integrations/itch/server.ts`)

En la página HTML de itch.io, los ejecutables descargables tienen la siguiente estructura:
```html
<a data-upload_id="16488290" class="button download_btn">...</a>
<span class="file_size"><span>554 MB</span></span>
```

#### Extracción y Seguimiento:
Al consultar la web o en las comprobaciones periódicas:
- Se extrae:
  - `latestUploadId`: `"16488290"`
  - `latestUploadSize`: `"554 MB"`
- Si el `upload_id` cambia respecto al guardado, se reconoce inmediatamente un **Nuevo Build Subido**.
- La alarma se activa indicando:
  `📦 ¡Nuevo archivo instalador detectado en itch.io! (554 MB)`.

---

### 2.3. Vigilancia Automática en Segundo Plano (Cron Job de Vercel)

#### Configuración en `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/check-itch",
      "schedule": "0 */12 * * *"
    }
  ]
}
```
*(Se ejecuta cada 12 horas automáticamente en los servidores de Vercel).*

#### Endpoint del Cron: `src/app/api/cron/check-itch/route.ts`
1. **Seguridad:** Valida el encabezado de autorización contra `CRON_SECRET` de Vercel.
2. **Proceso:**
   - Lee todos los juegos rastreados en la base de datos Supabase (`itch_trackers`).
   - Para cada juego, consulta de forma asíncrona y respetuosa (con rate limit y pausas) el `/devlog.rss` y la página de descarga.
   - Si detecta una versión superior a la jugada o un cambio en `upload_id`:
     - Inserta una notificación interna en Savestate (`notifications`).
     - Si `DISCORD_WEBHOOK_URL` está activo, envía la alerta a Discord.
     - Actualiza `last_checked_at` y `metadata`.
3. Devuelve respuesta JSON de resumen: `{ success: true, checkedCount: N, notifiedCount: M }`.

---

## 3. Experiencia Visual Actualizada en el Perfil (`src/components/profile-indie-tracker.tsx`)

1. **Panel de Alarma Enriquecido:**
   - `🔔 Alarma de versión: ACTIVA`
   - Si el creador sube un archivo nuevo antes de redactar el post:
     `📦 Archivo actualizado en itch.io: 554 MB (detectado por el radar).`
   - Si se publica la v1.9:
     `🚨 ¡ALARMA DISPARADA: NUEVA VERSIÓN DISPONIBLE! (v1.9)`
2. **Cero Hitos:** Tarjeta completamente despejada de barras de tareas o checklists innecesarios.
3. **Garantía Automática:** Texto informativo al pie:
   `🤖 Monitoreo 24/7 activo vía Savestate Bot: Te avisaremos por Discord y en tu buzón web sin que tengas que comprobar manualmente.`
