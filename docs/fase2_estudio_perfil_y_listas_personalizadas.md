# Propuesta Técnica: Fase 2 — Estudio Visual de Perfil y Listas con Personalidad
**Fecha:** 7 de octubre de 2026  
**Origen:** Auditoría e Investigación (`research/antigravity`)  
**Destino:** Equipo de Implementación (`implementation/chatgpt` / Codex)  
**Propósito:** Especificar el nuevo editor interactivo de perfil WYSIWYG en vivo y la evolución del módulo de listas temáticas con notas emotivas y portadas destacadas.

---

## 1. Alcance Funcional

Esta fase eleva la identidad y capacidad de expresión del jugador:
1. **Editor de Perfil Interactivo en Vivo:** El jugador ya no completa un formulario estático aislado; edita directamente sobre la maqueta real de su perfil con feedback visual inmediato.
2. **Acciones Rápidas de Personalización:** Subida directa sobre avatar y banner, chips de estados rápidos predefinidos y selección de color de acento reactiva.
3. **Barra Flotante de Cambios Pendientes:** Dock inferior con `[Guardar Cambios]` y `[Descartar]`, protegido contra pérdidas accidentales de datos al navegar o recargar.
4. **Previsualizador de Tamaños (Móvil / Escritorio):** Selector de viewport que permite verificar cómo lucirá la tarjeta del perfil en pantallas pequeñas y grandes.
5. **Listas con Personalidad y Emoción:** Visualización y edición de notas individuales por cada juego dentro de una lista (aprovechando la columna `list_items.note` ya existente en la base de datos) y portadas compuestas estilo collage 2x2.

---

## 2. Editor Visual de Perfil en Vivo (`src/app/settings/profile-studio/` o `/settings`)

### 2.1. Arquitectura de Estado en Cliente
El componente mantiene un estado local reactivo (`draftProfile`):
```ts
interface DraftProfile {
  username: string;
  avatar_url: string | null;
  banner_url: string | null;
  theme_color: 'cyan' | 'green' | 'pink' | 'amber';
  terminal_status: string;
  library_private: boolean;
  social_links: Record<string, string>;
}
```
Cualquier cambio modifica `draftProfile` al instante, recalculando variables CSS locales (`--profile-accent`, `--profile-bg`) para mostrar la vista previa en vivo sin requerir guardar en el servidor.

### 2.2. Controles sobre la Vista Previa (Overlays)
* **Avatar y Banner:** Botones flotantes semitransparentes con icono de cámara (`Cambiar avatar`, `Cambiar banner`) que abren el selector de archivos local, realizan la compresión WebP en cliente y preparan la imagen para subida a Supabase Storage (`profiles`).
* **Chips de Estados Rápidos:** Barra de accesos directos estilo píldora debajo del input de estado:
  - `[ 🕹️ Jugando... ]`
  - `[ 🧭 Buscando próxima aventura ]`
  - `[ ⏸️ En pausa ]`
  - `[ 🏆 Platinando ]`
  - `[ 💀 Muriendo en bucle ]`
  - Al pulsar un chip, se rellena o concatena en `terminal_status`, permitiendo edición personalizada posterior.
* **Paleta de Acento Reactiva:** Círculos de color interactivos (`cyan`, `green`, `pink`, `amber`) que cambian al instante los bordes, botones y destellos de la previsualización.

### 2.3. Dock Flotante de Cambios Pendientes
* **Activación:** Se muestra fijo en la parte inferior de la pantalla cuando `isDirty === true` (hay diferencias entre `draftProfile` y el perfil original).
* **Botones:**
  - `[💾 Guardar Cambios (Ctrl+S)]` con indicador de carga retro.
  - `[↺ Descartar]` que revierte el estado al último guardado.
* **Protección `beforeunload`:** Hook que previene el cierre de pestaña o navegación involuntaria mediante un diálogo de confirmación si existen cambios sin guardar.

### 2.4. Switch de Vista Previa Móvil / Escritorio
* Botón toggle `[ 📱 Móvil | 💻 Escritorio ]` en la barra superior del editor.
* En modo móvil, el contenedor del perfil se ajusta a un ancho fijo de 375px con marco de smartphone y barra de scroll virtual, permitiendo certificar el encuadre de avatares, textos y portadas.

---

## 3. Listas con Personalidad

### 3.1. Estado de Datos
La base de datos ya soporta este requerimiento de forma nativa desde la migración 001:
* `user_lists (id, user_id, title, description, is_private, created_at)`
* `list_items (id, list_id, game_id, position_index, note)` *(hasta 1000 caracteres por nota)*.
* **No requiere nuevas migraciones SQL.**

### 3.2. Experiencia de Usuario en `/lists/[id]`
1. **Portada Compuesta Automática:** Si la lista no tiene imagen propia, la cabecera genera un mosaico 2x2 con las carátulas de los primeros 4 juegos agregados a la lista.
2. **Notas y Explicación por Juego:** Cada elemento de la lista muestra:
   - Carátula y título del juego.
   - Píldora de posición (`#1`, `#2`, etc.).
   - Bloque de nota personal enmarcado con estilo terminal:  
     `"💬 Nota del autor: Este juego me enseñó lo que significa la verdadera amistad..."`
   - Si la lista es editada por su dueño, un área de texto inline permite escribir o modificar la nota de cada juego al momento de añadirlo u ordenarlo.
3. **Plantillas Inspiradoras al Crear Lista:** Selector de plantillas que auto-completa el título y descripción inicial:
   - *"Juegos que me hicieron llorar"*
   - *"Una tarde, una aventura"*
   - *"Joyas ocultas que nadie conoce"*
   - *"Mi Top 10 de la era de 16 bits"*

---

## 4. Criterios de Aceptación y Verificación

1. El usuario puede cambiar su avatar, banner, color y estado viendo el cambio reflejado en pantalla en tiempo real sin recargar.
2. La barra flotante aparece únicamente al modificar algún dato y desaparece al guardar o descartar.
3. Al agregar un juego a una lista, el usuario puede adjuntar una nota personal de hasta 1000 caracteres que se guarda en `list_items.note` y se muestra públicamente a los visitantes.
