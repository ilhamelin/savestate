# 02. Especificación de Requerimientos de Software (SRS)

---

## 1. Introducción y Visión General
**SaveState** es una plataforma web orientada al público gamer que combina las funciones de catalogación de videojuegos (estilo *Letterboxd / Backloggd*), diario de juego (*logbook*) y red social personalizable, bajo una identidad visual temática de **Pixel Art y estética Cyberpunk / Hacker**.

---

## 2. Actores del Sistema
* **Visitante (Guest):** Usuario no registrado que explora catálogo, reseñas y perfiles públicos.
* **Usuario Registrado (Player):** Usuario autenticado que gestiona biblioteca personal, redacta reseñas, personaliza perfil e interactúa socialmente.
* **Administrador / Moderador:** Supervisa contenido reportado, gestiona spoilers y mantiene la integridad de los datos.

---

## 3. Requerimientos Funcionales (RF)

### Módulo 1: Autenticación y Gestión de Cuentas
* **RF-01:** Registro e inicio de sesión de usuarios mediante correo/contraseña y proveedores OAuth (Discord, Google, Steam).
* **RF-02:** Recuperación y restablecimiento de contraseña vía correo electrónico.
* **RF-03:** Cierre de sesión seguro y gestión de sesiones activas.
* **RF-04:** Configuración de privacidad de cuenta (público vs. solo amigos).

### Módulo 2: Catálogo y Búsqueda de Juegos
* **RF-05:** Integración con API externa (IGDB) para indexar títulos retro y contemporáneos con carátulas y sinopsis.
* **RF-06:** Búsqueda en tiempo real por título, desarrollador, distribuidor o saga.
* **RF-07:** Filtros avanzados por consola/plataforma, género, año y puntuación.
* **RF-08:** Vista de detalle del juego estilo terminal con metadatos y distribución de reseñas.
* **RF-09:** Sistema de sugerencia o registro manual de juegos retro o hacks no indexados.

### Módulo 3: Tracking de Biblioteca y Diario de Juego (*Logbook*)
* **RF-10:** Asignación de estados: `[Playing]`, `[Backlog]`, `[Cleared]`, `[100% / Platinum]`, `[Dropped]`, `[Wishlist]`.
* **RF-11:** Registro de partida (*Log entry*): plataforma jugada (emulador, hardware original), fechas y dificultad.
* **RF-12:** Contador de horas jugadas estimadas o reales.
* **RF-13:** Selección de "Top 4 Juegos Favoritos" fijados en cabecera del perfil.
* **RF-14:** Creación de listas temáticas personalizadas (públicas o privadas).

### Módulo 4: Reseñas y Puntuación
* **RF-15:** Sistema de puntuación cuantitativa (escala 1 a 10 con estrellas/disquetes pixel art).
* **RF-16:** Editor de reseñas con soporte para Markdown (negritas, cursivas, citas, listas).
* **RF-17:** Indicador obligatorio de advertencia de *Spoilers* con ocultación visual por defecto.
* **RF-18:** Reacciones temáticas a reseñas (*Critical Hit*, *Game Over*, *GG*).
* **RF-19:** Sección de comentarios en reseñas públicas.

### Módulo 5: Perfil Gamer y Personalización Cyberpunk / Pixel Art
* **RF-20:** Avatar de usuario configurable (galería pixel art predefinida o subida de imagen).
* **RF-21:** Banner de cabecera personalizable con motivos retro o cyberpunk.
* **RF-22:** Personalización de tema de color del perfil (Cian Neón, Verde Fósforo, Magenta, Ámbar).
* **RF-23:** Enlaces a redes externas (Steam, Discord, Twitch, GitHub, X).
* **RF-24:** Línea de estado estilo terminal (`user@savestate:~$ Playing Chrono Trigger`).
* **RF-25:** Dashboard de estadísticas del jugador (géneros más jugados, balance anual).

### Módulo 6: Red Social y Actividad Comunitaria
* **RF-26:** Sistema de seguimiento mutuo o solicitudes de amistad.
* **RF-27:** Feed de actividad ("Transmisión") en tiempo real con acciones de amigos.
* **RF-28:** Buscador de usuarios por nombre o etiqueta.
* **RF-29:** Notificaciones internas (nuevos seguidores, comentarios, reacciones).

---

## 4. Requerimientos No Funcionales (RNF)

| Código | Categoría | Especificación |
| :--- | :--- | :--- |
| **RNF-01** | **Interfaz & UI/UX** | Diseño temático Pixel Art + Cyberpunk. Tipografías retro para UI y monoespaciadas para lectura prolongada. |
| **RNF-02** | **Rendimiento** | Tiempo de respuesta en búsquedas y fichas < 1.5 segundos mediante caché inteligente. |
| **RNF-03** | **Seguridad** | Sanitización estricta de Markdown (prevención XSS). Cifrado de credenciales y protección CSRF. |
| **RNF-04** | **Responsividad** | Totalmente adaptable a móviles, tablets y escritorios sin deformar elementos pixel art. |
| **RNF-05** | **Accesibilidad** | Contraste WCAG AA y opción de desactivar efectos CRT, parpadeos y scanlines. |

---

## 5. Matriz de Prioridades (MoSCoW) y Alcance del MVP

* **Must Have (MVP Inicial):** Búsqueda de juegos, Fichas técnicas, Autenticación, Tracking de 6 estados, Top 4 favoritos, Reseñas básicas con calificación y spoilers ocultos.
* **Should Have:** Personalización de perfil cyberpunk, Listas temáticas, Feed de actividad de amigos, Enlaces a redes gamer.
* **Could Have:** Reacciones temáticas a reseñas, Selector modular de avatares pixel art, Gráficos estadísticos del jugador.
* **Won't Have (Fases Futuras):** Mensajería privada en chat directo, Emulación web in-browser de ROMs.
