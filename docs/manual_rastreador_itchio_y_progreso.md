# Savestate: Rastreador de Juegos Indie y Notificador de Versiones de itch.io

**Versión:** 1.1 (Actualizada: Sin hitos + Alarma de Versión Activa)  
**Fecha:** 9 de octubre de 2026  
**Área:** Perfil de Jugador, Automatizaciones y Puente de Notificaciones  
**Estado:** Documento de Especificación y Manual Funcional  

---

## 1. Resumen Ejecutivo

En juegos independientes distribuidos en `itch.io`, novelas visuales o títulos con actualizaciones periódicas:
1. **No hay aviso centralizado de nuevas versiones:** Cuando el desarrollador lanza un nuevo parche o capítulo (por ejemplo, el paso de la versión `1.8D/1.8E` a la `1.9` en *Starmaker Story*), el jugador suele enterarse tarde o debe revisar manualmente la página web.
2. **Falta de visibilidad sobre si el juego está siendo vigilado:** El jugador necesita tener la certeza de que el sistema realmente le avisará en cuanto esté lista la próxima entrega.

Esta implementación introduce en el **Perfil de Savestate** un **Rastreador de Versiones Indie**. Permite pegar la URL de cualquier proyecto de itch.io para monitorizar actualizaciones en tiempo real, mostrar claramente que la **Alarma de Notificación está ACTIVA**, y recibir avisos duales (en la campana de Savestate y en Discord) cuando el autor publique una versión más reciente.

*(A petición del diseño final, se ha retirado el sistema de hitos/checklists para ofrecer una interfaz limpia, directa y enfocada en lo verdaderamente importante: las actualizaciones de versión).*

---

## 2. Los Métodos Técnicos Descubiertos en itch.io

Durante la investigación técnica del sitio `https://arvusgames.itch.io/starmakerstory`, se identificaron los siguientes mecanismos nativos y gratuitos:

* **Endpoint de Metadatos (`/data.json`):** Extrae de manera oficial el ID único, título, autor, portada en alta resolución, etiquetas y capturas sin scraping.
* **Canal de Novedades y Parches (`/devlog.rss`):** Proporciona un feed XML en tiempo real con el título del último devlog, versión anunciada y fecha exacta de lanzamiento.

---

## 3. Experiencia de Usuario dentro del Perfil de Savestate

El módulo se ubica en el Perfil (`/players/[username]` o en la pestaña de Biblioteca/Rastreador):

### 3.1. Añadir un Juego al Rastreador
1. El usuario pega el enlace de itch.io en el campo de texto (ejemplo: `https://arvusgames.itch.io/starmakerstory`).
2. Savestate consulta `/data.json` y `/devlog.rss`, cargando automáticamente la portada, el título y la última versión disponible.
3. El juego queda anclado en la colección personal de seguimiento del perfil.

### 3.2. Comparador de Versiones Activo
La tarjeta muestra una comparativa visual clara entre la partida del usuario y el estado en la red:
* **Versión que estoy jugando:** Campo editable donde el usuario indica qué versión tiene instalada en su computadora (ej. `1.8D`).
* **Botón rápido:** *"Estoy jugando la última detectada (1.8D)"*.
* **Estado:** Menú desplegable (*Esperando actualización*, *Jugando*, *En pausa*, *Completado*).

### 3.3. Panel de Alarma de Nueva Versión (Función Clave)
Justo debajo del estado del juego, se presenta una caja estilizada que confirma el estado de la vigilancia:

```
+--------------------------------------------------------------------------+
|  🔔 ALARMA DE NUEVA VERSIÓN: ACTIVA                                      |
|                                                                          |
|  Savestate está vigilando itch.io para este juego.                       |
|  Cuando el desarrollador publique una versión superior a la tuya        |
|  (actualmente 1.8D), te notificaremos al instante por:                   |
|                                                                          |
|  ✓ Campana de Notificaciones en la Web                                   |
|  ✓ Alerta con tarjeta interactiva en tu Servidor de Discord              |
+--------------------------------------------------------------------------+
```

Si el sistema detecta que salió una versión superior (por ejemplo, la `1.9`):
```
+--------------------------------------------------------------------------+
|  🚨 ¡ALARMA DISPARADA: NUEVA VERSIÓN DETECTADA! (v1.9)                  |
|                                                                          |
|  Se ha detectado una nueva versión en el devlog oficial.                 |
|  Tu versión actual: 1.8D  -->  Nueva versión: 1.9                        |
|                                                                          |
|  [Ver devlog ↗]   [Descargar Nueva Versión ↗]                            |
+--------------------------------------------------------------------------+
```

### 3.4. Bloc de Notas Privadas de Guardado
Un desplegable compacto donde anotar recordatorios de la partida (ej: *"Slot 3 de guardado antes de la decisión del festival"*).

---

## 4. Sistema Dual de Notificaciones

Cuando el sistema detecta que el devlog ha cambiado (nueva entrada publicada):

### 4.1. Notificación en Savestate (Web)
* Aparece un indicador en la campana de notificaciones (`/notifications`).
* Mensaje: *"🔔 Starmaker Story tiene una nueva actualización: Starmaker Story 1.9 Release disponible en itch.io"*.
* Al hacer clic, abre la ficha del juego con los enlaces de descarga.

### 4.2. Notificación en Discord (Bot / Webhook)
A través de las credenciales del bot de Discord ya configuradas en Savestate (`DISCORD_WEBHOOK_URL` y `DISCORD_BOT_TOKEN`), se envía un mensaje enriquecido con estética gaming:
* **Título:** 🎮 ¡Nueva Actualización en itch.io!
* **Juego:** Starmaker Story
* **Versión anunciada:** Starmaker 1.9 Release
* **Enlace:** Acceso directo al devlog oficial.
* **Miniatura:** Portada oficial del juego.

---

## 5. Resumen de Ajustes Solicitados sobre la UI Actual

1. **Eliminar Bloque de Hitos:** Se retira la barra `Hitos: 0 / 0 · 0%`, la barra de progreso, la lista de checkboxes y el input *"Nuevo hito"*.
2. **Integrar Indicador de Alarma Activa:** Se añade el panel retro de confirmación de vigilancia activa (Web + Discord).
3. **Mantener todo lo demás:** Portada, título, autor, devlogs, versión jugada, selector de estado, notas privadas, botones de guardar, comprobar actualizaciones y dejar de rastrear.
