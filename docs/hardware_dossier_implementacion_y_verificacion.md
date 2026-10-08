# Hardware, dossier y Memory Card

Referencia original conservada: `docs/propuesta_hardware_y_stats_dossier.md`, de `research/antigravity`.

## Base de datos y Profile Studio

La migración `202610080012_owned_platforms.sql` añade `profiles.owned_platforms` y el permiso de actualización de columna para `authenticated`. El usuario confirmó su ejecución en Supabase; la prueba real verificó que el permiso conserva RLS por propietario.

El selector incluye plataformas populares y nombres personalizados añadidos con Enter. Se integra con Guardar/Ctrl+S, Descartar y la detección de cambios del dock. Se validan hasta 16 nombres de 48 caracteres, sin controles ni duplicados por mayúsculas/minúsculas, tanto en cliente como en servidor. La lectura pública normaliza datos escritos directamente en PostgreSQL para evitar contenido desmesurado o elementos nulos. El hardware declarado es información pública de perfil y la interfaz lo indica.

## Métricas y privacidad

- Completados: estados `cleared` y `platinum`. Se conserva `dropped`; no se inventa el estado `abandoned` mencionado en un ejemplo de la propuesta.
- Clear Rate: completados / empezados × 100. Empezados incluye Playing, Cleared, Platinum y Dropped, además de Backlog con horas o fechas de inicio/finalización. Wishlist y Backlog sin iniciar quedan fuera. Sin juegos empezados devuelve 0.
- Las horas incluyen rejugadas e importaciones de Steam y se suman en centésimas. El promedio se presenta por título completado, usando únicamente las horas de esos títulos y contando una sola vez cada ficha.
- El termómetro muestra los seis estados. Las plataformas se ordenan por horas y sus porcentajes usan el total de horas. Hardware original, emulación y otros métodos usan proporción de partidas; se muestran también sus horas.
- El dossier pagina todas las entradas y partidas, sin usar los límites de 500 juegos visibles ni 1000 filas de una respuesta. Ante 50 000 filas por consulta, falla explícitamente y no presenta métricas parciales.
- El resumen principal de horas/completados del perfil usa este agregado completo. Las estadísticas previas de géneros/años siguen vinculadas a la biblioteca visible; el aviso de 500 juegos aclara esta diferencia.
- Se consulta `can_view_library` y se conserva RLS. Dossier, favoritos y datos del exportador solo se entregan a visitantes autorizados. El hardware sigue siendo público como el nombre y avatar.

## Exportación

Canvas nativo genera un PNG de 1080 × 1350 con avatar, usuario, estado, hardware, Clear Rate, horas, Top 4 ordenado y dirección del perfil. No requiere paquetes adicionales ni servicios externos de generación. Carga imágenes en paralelo con CORS anónimo y timeout de cuatro segundos; una imagen no disponible se sustituye por un bloque retro y se informa al usuario. Se esperan las fuentes, se recorta texto largo y se revoca el Object URL de descarga.

## Verificación

- `npm run check`: lint, tipos, 39 pruebas unitarias y formato.
- `npm run build`: compilación de producción, Next.js 16.4.0 y proxy nativo intacto.
- Integración real optativa: `TEST_HARDWARE_LIVE=1`, `TEST_APP_URL=http://localhost:3000`, ejecutar `tests/integration/hardware-dossier.test.ts` con `.env.local` y servidor local. Verifica guardado y validación, 1001 partidas / 100,1 horas, Clear Rate de 50 %, RLS de otro propietario y ocultación de dossier/exportación para visitantes de una biblioteca privada. Limpia el usuario temporal.
- Navegador: chips, alta personalizada con Enter, descarte, guardado Ctrl+S y persistencia; perfil con 66,7 % Clear Rate, 63,5 horas y cuatro favoritos; descarga PNG inspeccionada (1080 × 1350, avatar y cuatro carátulas presentes); vista móvil a 375 px sin desbordamiento horizontal. Consola sin errores durante estas pruebas.
- Evidencias en `docs/evidence/`: `hardware-studio.png`, `profile-dossier.png`, `profile-dossier-mobile.png` y `memory-card-example.png`. La tarjeta de ejemplo usa un usuario temporal eliminado y la URL de localhost del entorno de prueba.

Entrega preparada para despliegue; esta solicitud no publica una nueva versión en Vercel.
