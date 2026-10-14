# Informe Jurídico y Auditoría de Cumplimiento Normativo: Proyecto SaveState

**Fecha:** 14 de Octubre de 2026  
**Jurisdicción Aplicable:** Chile (Ley N° 17.336 de Propiedad Intelectual, Ley N° 19.628 y N° 21.696 de Protección de Datos Personales, Ley N° 20.435) y Estándares Internacionales (DMCA de EE. UU., GDPR de la Unión Europea y Términos de Servicio de Plataformas Terceras).

---

## 1. Resumen Ejecutivo y Dictamen

El proyecto **SaveState** es una plataforma web orientada a la comunidad gamer que funciona como bitácora de partidas, seguimiento de adaptaciones cinematográficas/series (*Screen*), sincronización de perfiles competitivos (*Rift/Valorant/Steam*) y chat comunitario en tiempo real.

### Dictamen General
El núcleo arquitectónico del proyecto está diseñado con **altos estándares de seguridad técnica** (Row Level Security en Supabase, credenciales `server-only`, sanitización de entradas contra XSS/SSRF y respeto a las cuotas de APIs). **Sin embargo, existen vacíos legales formales indispensables para su operación pública:**
1. **Ausencia de Términos y Condiciones (TOS) y Política de Privacidad (Privacy Policy)**.
2. **Falta de procedimiento de "Safe Harbor" / DMCA / Ley 20.435** para el Chat Global y el contenido multimedia subido por usuarios.
3. **Ausencia de leyendas obligatorias de marcas registradas** exigidas expresamente por los contratos de desarrollador de **Riot Games** y **Valve Corporation (Steam)**.
4. **Uso de artes y logos oficiales de terceros** (Nintendo, Rockstar Games, Marvel/Disney, TGA) sin la correspondiente cláusula de uso nominativo justo (*Nominative Fair Use*).

---

## 2. Lo que el Proyecto Respeta Rigurosamente (Cumplimiento Vigente)

### 2.1. Seguridad de Credenciales y Aislamiento de APIs
* **Protección de API Keys**: Las claves sensibles (`RIOT_API_KEY`, `STEAM_API_KEY`, `TMDB_READ_TOKEN`, `DISCORD_BOT_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`) están confinadas estrictamente al entorno de servidor mediante módulos `server-only` de Next.js. Ninguna clave privada se expone en el cliente (`NEXT_PUBLIC_*`).
* **Protección contra Abuso y DoS de Proveedores**:
  - Valve/Steam: Se limita a 3 sincronizaciones diarias por usuario con reinicio atómico en UTC medianoche.
  - Discord: Implementación de detección de rate-limit (`discordRetryDelay`) con cabeceras `X-RateLimit-Reset-After`.
  - TMDB: Timeouts acotados (6s) y límites máximos de payload (2.5 MB) para evitar saturación de memoria.

### 2.2. Protección de Datos Técnicos y Arquitectura de Acceso
* **Row Level Security (RLS)**: Todas las tablas en PostgreSQL/Supabase (`user_screen_entries`, `global_chat_messages`, `profiles`, `reviews`, `library_entries`) tienen políticas RLS activas que impiden a un usuario autenticado o anónimo leer, alterar o eliminar datos privados ajenos.
* **Privacidad de Notas de Usuario**: Las notas personales de avance en películas y series se mantienen privadas por diseño y no se transmiten al compartir checkpoints en el Chat Global.

### 2.3. Embebido Multimedia Legítimo
* **YouTube**: Los tráilers se reproducen mediante el dominio `youtube-nocookie.com` utilizando el reproductor `<iframe>` oficial, sin alterar controles ni eludir publicidad del creador, respetando los Términos de Servicio de la API de YouTube.
* **Twitch**: Las transmisiones oficiales de LoL Esports (`lvpes`, `lla`, `riotgames`) se embeben con el parámetro obligatorio `parent`, cumpliendo la política de desarrollador de Twitch.
* **TMDB Attribution**: En la vista de `/screen` se incluye la leyenda requerida por The Movie Database: *"This product uses the TMDB API but is not endorsed or certified by TMDB."*

---

## 3. Lo que NO se Respeta o Presenta Riesgos Legales (Acciones Requeridas)

A continuación se detallan los puntos donde el proyecto se encuentra desprotegido o incumple requisitos contractuales y normativos:

---

### Riesgo 1: Ausencia de Términos de Servicio y Mecanismo Safe Harbor (DMCA / Ley 20.435) para Chat Global
* **Descripción del problema**: En el Chat Global (`/chat`), los usuarios pueden redactar mensajes libres y adjuntar imágenes o GIFs (subidos directamente a Supabase Storage o enlazados desde Imgur, Tenor, Giphy, Discord).
* **Riesgo Legal**: Si un usuario publica contenido que infrinja derechos de autor (fotografías protegidas, arte sin licencia) o material ilícito (difamación, contenido ofensivo), los administradores de SaveState podrían ser considerados **responsables solidarios o directos de la infracción** ante la justicia civil o penal (infracción contributiva de copyright).
* **Fundamento Legal**:
  - **Ley N° 20.435 de Chile (Limitación de responsabilidad de prestadores de servicios de Internet)**: Exime de responsabilidad por daños causados por contenidos transmitidos o alojados por terceros **únicamente si** el prestador no tiene conocimiento efectivo de la ilicitud y actúa con prontitud para retirar o bloquear el acceso una vez notificado (*procedimiento de notificación y bajada*).
  - **DMCA Title 17 U.S.C. § 512 (Safe Harbor)**: Mismo estándar para usuarios y proveedores de alojamiento en EE.UU.
* **Acción Correctiva Requerida**:
  1. Redactar y publicar los **Términos y Condiciones de Uso (TOS)** con una **Política de Uso Aceptable (AUP)** que prohíba expresamente subir contenido con derechos de autor sin autorización o material ilícito.
  2. Implementar una página de **Contacto Legal / Reporte de Infracción (DMCA Notice)** con una dirección de correo designada (`legal@savestate...` o formulario de reporte) para que los titulares puedan solicitar la retirada inmediata de archivos infractores.
  3. Establecer en los TOS que el usuario otorga a SaveState una licencia limitada para mostrar su contenido dentro de la plataforma y asume la responsabilidad exclusiva por lo que publique.

---

### Riesgo 2: Ausencia de Política de Privacidad Pública (Ley N° 19.628 / Nueva Ley N° 21.696 y GDPR)
* **Descripción del problema**: Aunque el sistema protege técnicamente las bases de datos con RLS, la plataforma **no tiene una página de Política de Privacidad** visible para los usuarios.
* **Riesgo Legal**:
  - En Chile, la **Ley N° 19.628** y la **Nueva Ley N° 21.696 de Protección de Datos Personales (2024)** obligan a los responsables del tratamiento de datos a informar de forma previa, transparente e inequívoca la finalidad de la recolección de datos, los destinatarios y los derechos del titular.
  - La falta de política de privacidad expone al titular del sitio a fiscalizaciones y sanciones de la nueva **Agencia de Protección de Datos Personales de Chile** o de reguladores internacionales (GDPR art. 13).
* **Acción Correctiva Requerida**:
  - Crear la ruta `/privacy` (Política de Privacidad) explicando:
    1. **Datos recopilados**: Correo electrónico, nombre de usuario, contraseña cifrada, logs de videojuegos, identificadores de plataformas (Riot PUUID, SteamID, Discord ID) y cookies esenciales de sesión.
    2. **Finalidad**: Exclusivamente para el funcionamiento técnico de la bitácora, perfiles y estadísticas. **Aclarar que los datos jamás se venden ni se ceden a terceros para fines comerciales o de marketing**.
    3. **Terceros procesadores**: Supabase (alojamiento de base de datos), Vercel (servidores de aplicación), Discord (envío de notificaciones autorizadas).
    4. **Derechos ARCO**: Cómo los usuarios pueden solicitar el acceso, rectificación, cancelación u oposición de sus datos, así como la eliminación permanente de su cuenta.

---

### Riesgo 3: Incumplimiento Contractual de las Políticas de Desarrollador de Riot Games
* **Descripción del problema**: El proyecto utiliza intensivamente la API de Riot Games para League of Legends, Valorant, perfiles, notas de parche y la vista del mundial de LoL (`/worlds`).
* **Riesgo Legal**:
  - La **Política de la API de Riot Games** y su sección contractual **"Legal Jibber Jabber"** exigen como condición obligatoria para mantener activa la clave de API (y para la obtención de la clave permanente en producción):
    1. Incluir el descargo de responsabilidad oficial de Riot en un lugar visible de la aplicación.
    2. Mantener la aplicación 100% gratuita (sin cobrar por estadísticas de Riot ni bloquear funciones tras muros de pago).
  - Actualmente, el aviso solo está presente en el componente de perfil de LoL, pero **está ausente en el footer global y en la vista de Worlds 2026 (`/worlds`)**.
* **Acción Correctiva Requerida**:
  - Incluir en el pie de página global (`src/app/layout.tsx`) o en un pie legal común el texto oficial exigido por Riot:
    > *"[SaveState] isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc."*

---

### Riesgo 4: Falta del Aviso de Marcas de Valve / Steam
* **Descripción del problema**: SaveState se conecta a la API de Steam para importar bibliotecas y logros, mostrando el logo oficial de Steam y referencias a Valve.
* **Riesgo Legal**: El contrato de desarrollador de Steam (*Steam Web API Terms of Use*) exige declarar que la aplicación no está afiliada ni patrocinada por Valve Corporation.
* **Acción Correctiva Requerida**:
  - Agregar en la sección de sincronización de Steam y en los términos legales:
    > *"Steam y el logotipo de Steam son marcas comerciales y/o marcas registradas de Valve Corporation en EE. UU. y/u otros países. SaveState no está afiliado, respaldado ni patrocinado por Valve Corporation."*

---

### Riesgo 5: Uso de Artes Oficiales Almacenadas Localmente (Nintendo, Marvel/Disney, Rockstar Games)
* **Descripción del problema**: En el directorio `public/` del proyecto existen archivos locales correspondientes a propiedades intelectuales de terceros:
  - `public/zelda/`: Artes y logos oficiales de *The Legend of Zelda* (Nintendo).
  - `public/avengers/`: Artes y logos de *Avengers: Doomsday* (Marvel / Disney).
  - `public/gta6/`: Artes y logos de *Grand Theft Auto VI* (Rockstar Games / Take-Two).
* **Riesgo Legal**:
  - Las marcas registradas y artes promocionales gozan de protección por derechos de autor. **Nintendo y Disney son particularmente activas en la emisión de notificaciones de cese y desista (Cease & Desist)** cuando se redistribuyen sus artes sin autorización formal.
  - El uso de estos materiales en SaveState es meramente **informativo y referencial** (cuenta regresiva de lanzamientos comunitarios), lo que califica como *Uso Nominativo Justo (Fair Use)*, pero **carece del respaldo formal que lo declare**.
* **Acción Correctiva Requerida**:
  1. Agregar una **Cláusula de Atribución de Marcas de Terceros** en el sitio:
     > *"Todas las marcas comerciales, logotipos, carátulas y nombres de personajes mostrados en SaveState pertenecen a sus respectivos propietarios (incluyendo Nintendo Co., Ltd., Rockstar Games, Marvel Entertainment/Disney, Sony Interactive Entertainment, Microsoft Corporation, entre otros). Su uso en esta plataforma tiene fines estrictamente informativos, culturales y de bitácora comunitaria sin fines de lucro, al amparo del uso justo nominativo."*
  2. En caso de recibir una solicitud de retirada de arte por parte de un titular (por ejemplo Nintendo), contar con el procedimiento para sustituir el arte local por un enlace dinámico o póster neutral de TMDB/IGDB.

---

## 4. Matriz de Riesgo y Plan de Acción Priorizado

| Prioridad | Área de Riesgo | Acción Legal / Técnica | Esfuerzo | Impacto |
|:---:|---|---|:---:|:---:|
| 🔴 **ALTA** | **Términos de Servicio y Safe Harbor** | Crear la página `/terms` con cláusulas de exención de responsabilidad sobre contenido del usuario (Chat/Foro) y correo de contacto para reportes de copyright. | Bajo | Protege a los administradores contra demandas por contenido subido por terceros. |
| 🔴 **ALTA** | **Política de Privacidad (Ley 19.628 / 21.696)** | Crear la página `/privacy` detallando qué datos se recopilan, para qué fines, proveedores de nube y ejercicio de derechos ARCO. | Bajo | Cumple con la normativa chilena e internacional de protección de datos. |
| 🟡 **MEDIA** | **Cláusula Contractual de Riot Games** | Insertar el descargo obligatorio de Riot Games ("Legal Jibber Jabber") en el footer global y en la vista `/worlds`. | Mínimo | Previene la revocación de la API Key y facilita la aprobación de la Production Key. |
| 🟡 **MEDIA** | **Cláusula de Valve / Steam** | Agregar la leyenda de no afiliación de Steam en el footer y en el importador de consolas/PC. | Mínimo | Cumplimiento del Steam Web API Agreement. |
| 🟢 **BAJA** | **Aviso General de Marcas de Terceros** | Añadir leyenda general de marcas (Nintendo, Rockstar, Disney) en el pie de página de la aplicación. | Mínimo | Mitiga riesgos de reclamos marcarios por el uso de artes en las cuentas regresivas. |

---

## 5. Conclusión

SaveState opera bajo un **modelo técnico pulcro y ético**: no participa en piratería, no aloja streams ilegales de video, no vulnera sistemas de terceros y protege las claves de API con aislamiento estricto en servidor.

Para alcanzar un **100% de blindaje legal**, solo requiere implementar los instrumentos formales que toda aplicación web moderna necesita: **Términos de Servicio, Política de Privacidad y Cláusulas de Atribución de Marcas**, las cuales garantizan el amparo del puerto seguro de la ley y el cumplimiento de los contratos de desarrollador de Riot Games y Valve.
