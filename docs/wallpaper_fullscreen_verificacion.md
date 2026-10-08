# Wallpaper de perfil a pantalla completa

Fecha: 8 de octubre de 2026.

El perfil público usa `ProfileWallpaper` en modo `fullScreen` envolviendo todas sus secciones. El arte se dibuja en una capa fija con `inset: 0`, altura mínima de viewport, `object-fit: cover` y posición superior centrada. No depende del ancho del contenedor central. Se evita `width: 100vw` para no sumar el ancho de la barra vertical a la página.

Una viñeta y un degradado suave dejan visibles los laterales. El contenido del jugador conserva su ancho centrado y recibe un panel oscuro semitransparente, situado sobre el arte. El contexto aislado del body mantiene la capa decorativa por encima del fondo del documento y detrás de la navegación y del perfil. La decoración no captura clics ni aparece en el árbol de accesibilidad.

El modo contenido sigue disponible para la vista previa del Profile Studio. Un perfil sin wallpaper no recibe fondo ni panel adicional. No hay cambios de datos, migraciones o dependencias nuevas.

## Comprobaciones

- `npm run check`: lint, tipos estrictos, 44 pruebas unitarias y formato correctos.
- `npm run build`: compilación de producción completa en Next.js 16.4.0.
- Navegador sobre el build local con un perfil público temporal; consola sin errores.
- Escritorio 1920 × 1080: fondo fijo desde x=0/y=0, de 1905 × 1080 px (ancho útil sin scrollbar), panel centrado de 1184 px. Ambos laterales muestran el arte. Al desplazarse 3800 px hasta la biblioteca, el fondo permanece en y=0.
- Laptop 1366 × 900: fondo de 1351 px, panel centrado con margen lateral de 83.5 px; el documento no excede el ancho útil de la ventana.
- Móvil 375 × 812: documento y fondo de 360 px, panel de 320 px; sin scroll horizontal.
- Habitaciones consola portátil, CRT y estantería verificadas. Estantería también comprobada en móvil sin desbordamiento.
- Perfil sin wallpaper: no se renderiza la capa decorativa y el contenedor de contenido permanece transparente.
- Perfil temporal eliminado y servidor detenido al finalizar.

Evidencias: `docs/evidence/profile-wallpaper-fullscreen-desktop.jpg` y `docs/evidence/profile-wallpaper-fullscreen-mobile.jpg`.
