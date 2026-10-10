# Savestate: Rastreador de Juegos Indie y Notificador de Versiones de itch.io

**Versión:** 1.0  
**Fecha:** 9 de octubre de 2026  
**Área:** Perfil de Jugador, Automatizaciones y Puente de Notificaciones  
**Estado:** Documento de Especificación y Manual Funcional  

---

## 1. Resumen Ejecutivo

En plataformas tradicionales como Steam, Xbox o PlayStation, el tiempo de juego y los logros se registran y actualizan de forma automática en los servidores de la compañía. Sin embargo, en **juegos independientes distribuidos en itch.io**, novelas visuales o títulos episódicos en desarrollo continuo:

1. **No existe un cliente que sincronice logros:** El jugador no tiene dónde registrar su avance, rutas completadas ni hitos alcanzados.
2. **No hay aviso centralizado de nuevas versiones:** Cuando el desarrollador lanza un nuevo parche, capítulo o actualización (por ejemplo, el paso de la versión `1.8E` a la `1.9` en *Starmaker Story*), el jugador suele enterarse tarde o debe revisar manualmente la página web.

Esta implementación introduce en el **Perfil de Savestate** una herramienta denominada **"Indie Tracker & Notificador de Versiones"**. Permite pegar la URL de cualquier proyecto de itch.io para monitorizar actualizaciones en tiempo real, recibir alertas duales (en la web y en Discord) y llevar un diario de progreso personalizado creado a medida por el propio usuario.

---

## 2. Los Métodos Técnicos Descubiertos en itch.io

Durante la investigación técnica del sitio `https://arvusgames.itch.io/starmakerstory`, se identificaron 4 mecanismos nativos y gratuitos que permiten consultar datos sin requerir API keys complejas ni realizar web scraping frágil:

```
                  ┌────────────────────────────────────────┐
                  │          itch.io Game Page             │
                  └───────────────────┬────────────────────┘
                                      │
        ┌─────────────────────────────┼─────────────────────────────┐
        │                             │                             │
        ▼                             ▼                             ▼
   /data.json                    /devlog.rss                 /embed/:game_id
(Metadatos Puros)          (Historial de Versiones)         (Widget Interactivo)
- ID único del juego        - Título de la actualización     - Tarjeta con botón
- Portada y capturas        - Fecha exacta de release          de compra/descarga
- Título y autor            - Enlace a notas de parche       - Soporte tema oscuro
- Etiquetas y género        - Detección de parches
```

### 2.1. Endpoint de Metadatos Directos (`/data.json`)
Al agregar `/data.json` a cualquier enlace de itch.io, el servidor responde con un objeto JSON estructurado que incluye:
* `id`: Identificador numérico del proyecto en los servidores de itch.io (`2854233`).
* `title`: Título oficial (`Starmaker Story`).
* `cover_image`: Portada oficial en alta resolución.
* `authors`: Nombre y perfil del creador (`Arvus Games`).
* `tags`: Lista de etiquetas (`visual-novel`, `pixel-art`, `adult`, etc.).
* `screenshots`: Galería de capturas de pantalla oficiales.

### 2.2. Canal de Novedades y Parches (`/devlog.rss`)
itch.io genera un canal RSS con cada entrada del cuaderno de desarrollo (Devlog). Al consultar este archivo XML, Savestate obtiene de inmediato:
* El título del último parche o versión (ej. `Starmaker 1.8D Bugfix`).
* La fecha y hora exacta de publicación.
* El enlace directo para leer el comunicado o descargar los archivos nuevos.

---

## 3. Experiencia de Usuario dentro del Perfil de Savestate

El módulo se integra directamente en la pantalla de Perfil (`/players/[username]` o en la pestaña personal de Biblioteca/Rastreador):

### 3.1. Añadir un Juego al Rastreador
1. El usuario pega el enlace de itch.io en el campo de texto (ejemplo: `https://arvusgames.itch.io/starmakerstory`).
2. Savestate consulta `/data.json` y `/devlog.rss`, cargando automáticamente la portada, el título y la última versión disponible.
3. El juego queda anclado en la colección personal de seguimiento del perfil.

### 3.2. Comparador de Versiones Activo
La tarjeta muestra una comparativa visual clara entre la partida del usuario y el estado en la red:
* **Tu versión jugada:** Un campo editable donde el usuario indica qué versión tiene instalada en su computadora (ej. `1.8E`).
* **Última versión en itch.io:** El valor detectado en el devlog más reciente.
* **Semáforo de estado:**
  * 🟢 **Al día:** Tu versión coincide con la última publicada.
  * 🟡 **¡Nueva versión disponible!:** El sistema detecta que el desarrollador lanzó una actualización superior (por ejemplo, `1.9`). Se enciende una alerta neón con un botón que lleva directo a la descarga.

```
+--------------------------------------------------------------------------+
|  [PORTADA]  Starmaker Story                                              |
|             Desarrollador: Arvus Games                                   |
|                                                                          |
|  ESTADO: 🟡 ¡NUEVA ACTUALIZACIÓN DETECTADA! (v1.9)                      |
|  Tu versión actual: [ v1.8E ]  vs  Última en itch.io: [ v1.9 ]           |
|  [Descargar Actualización]  [Ver Notas del Parche]                       |
|                                                                          |
|  PROGRESO: [████████████░░░░░░░░] 60%                                    |
|  [x] Prólogo completado                                                  |
|  [x] Ruta Anna terminada                                                 |
|  [ ] Desbloquear galería 100%                                            |
|  [+ Añadir nuevo hito...]                                                |
|                                                                          |
|  NOTAS DE PARTIDA:                                                       |
|  "Partida guardada en Slot 3 antes del evento del festival".             |
+--------------------------------------------------------------------------+
```

### 3.3. Cuaderno de Hitos y Progreso Personalizado
Como estos juegos no poseen trofeos de consola predefinidos, el usuario puede estructurar su propio camino:
* **Checklist interactivo:** Crear tareas u objetivos propios (rutas, finales, secretos, logros inventados).
* **Barra de porcentaje dinámica:** Se recalcula automáticamente a medida que se marcan casillas.
* **Bloc de notas de guardado:** Espacio privado para recordar decisiones, rutas abiertas o slots de guardado donde se dejó la partida antes de actualizar.

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

## 5. Arquitectura Técnica de Código

### 5.1. Definición del Modelo de Datos (`src/domain/itch-tracker.ts`)
```typescript
export interface ItchTrackedGame {
  id: string; // ID numérico de itch.io
  url: string; // URL canónica del juego
  title: string;
  author: string;
  coverImage: string;
  currentPlayedVersion: string; // Versión que tiene el usuario (ej: "1.8E")
  latestDetectedVersion: string; // Versión extraída del RSS
  latestDevlogTitle?: string;
  latestDevlogUrl?: string;
  latestDevlogDate?: string;
  status: 'playing' | 'waiting_update' | 'completed' | 'on_hold';
  milestones: {
    id: string;
    title: string;
    completed: boolean;
  }[];
  privateNotes?: string;
  lastCheckedAt: string;
}
```

### 5.2. API Routes en Next.js (`src/app/api/tracker/itch/route.ts`)
* **`POST /api/tracker/itch/inspect`**: Recibe `{ url }`, valida que pertenezca al dominio `itch.io`, realiza fetch en paralelo a `/data.json` y `/devlog.rss`, y devuelve los metadatos limpios para la interfaz.
* **`POST /api/tracker/itch/check-updates`**: Compara la lista de juegos registrados con las fuentes remotas. Si hay discrepancias de versión, dispara la notificación interna y el webhook de Discord.

---

## 6. Beneficios de la Implementación

1. **Autonomía:** Funciona con cualquier enlace público de itch.io sin depender de APIs de terceros de pago ni límites de peticiones.
2. **Paz mental para el jugador:** Ya no es necesario entrar periódicamente a itch.io para verificar si salió un parche; el sistema y el bot de Discord avisan en cuanto esté disponible.
3. **Registro histórico:** Permite que las novelas visuales y juegos independientes tengan el mismo nivel de seguimiento y presencia en el perfil de Savestate que los grandes títulos de consolas.
