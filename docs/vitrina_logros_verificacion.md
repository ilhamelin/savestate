# Vitrina de logros y distribución de nivel

Implementación en `implementation/chatgpt`, siguiendo
`research/antigravity:docs/propuesta_showcase_logros_y_layout_nivel.md`.

- La identidad (avatar, nombre, rango, estado y enlaces) ocupa la izquierda de la
  cabecera; el HUD de XP ocupa la derecha. A 900 px o menos se apilan. La vista
  previa de Profile Studio también se adapta mediante su consulta de contenedor.
- `AchievementsShowcase` aparece inmediatamente después de `StatsDossier`, usando
  exclusivamente los juegos, entradas y partidas ya disponibles en el perfil.
  Se mantiene dentro del acceso a la biblioteca: no se muestra una biblioteca privada
  a quien no tenga permiso.
- Destacado con carátula, enlace a la ficha, horas y progreso por plataforma; lista
  con cuatro títulos por página, selección interactiva y filtros Steam/Xbox/PlayStation.
- El destacado inicial prioriza porcentaje y después horas. El filtro 100% usa el
  valor exacto, sin convertir 99,9% en una completitud real por redondeo visual.
- Los juegos con varias plataformas conservan sus progresos independientes. Para
  registros repetidos de una misma plataforma se muestra el mayor porcentaje disponible;
  no se suman logros duplicados. Las horas suman todas las partidas del juego.
- El dominio excluye partidas ajenas a las entradas recibidas, datos sin total válido
  y juegos sin progreso. Los filtros reinician la página y el destacado; al cambiar
  de página se conserva el destacado mientras siga perteneciendo al conjunto filtrado.
- No hay migraciones, dependencias ni consultas nuevas a proveedores externos.

## Comprobaciones

- `npm run check`: código 0; lint, TypeScript, formato y 70 pruebas unitarias.
- `npm run build`: código 0 con Next.js 16.4.0.
- Navegador sobre build local y cuenta temporal con seis juegos en Supabase:
  página inicial de cuatro títulos y segunda de dos; clic en Chrono Cross cambia
  carátula/progreso/horas; Steam vuelve a página 1 con dos juegos; Steam + 100% produce
  estado vacío; PlayStation + 100% muestra únicamente el juego completado.
- Escritorio: identidad y XP en fila, vitrina de dos columnas. En móvil de 375 px:
  identidad y XP en columna, vitrina de una columna; `clientWidth` y `scrollWidth`
  coinciden (318 px), sin desbordamiento interno. Se restauró el viewport.
- No se observaron errores ni advertencias de consola. Pestaña de prueba cerrada.
- Evidencia visual: `docs/evidence/achievements-showcase.png` con datos sintéticos.

La cuenta temporal y sus seis registros se eliminaron tras la autorización explícita
del usuario. Los archivos temporales de prueba también se retiraron. No se desplegó
esta entrega a producción.
