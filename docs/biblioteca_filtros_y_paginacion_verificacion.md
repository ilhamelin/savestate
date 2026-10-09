# Biblioteca: filtros contextuales y paginación

Referencia: `docs/propuesta_filtros_plataforma_y_paginacion_biblioteca.md`. No requiere migraciones ni dependencias nuevas.

- Plataformas del selector derivadas exclusivamente de partidas vinculadas a las entradas cargadas. Sin plataformas registradas, se utiliza el catálogo de los juegos de esa biblioteca. Se ignoran valores vacíos y partidas ajenas a la colección.
- Géneros no vacíos de los juegos vinculados, únicos y ordenados alfabéticamente.
- El filtro de biblioteca prioriza plataformas de las partidas por entrada; solo entradas sin partidas utilizan compatibilidad de catálogo. Reconoce equivalencias PC / Steam, PC, PC (Microsoft Windows), Windows y alias PS1–PS5.
- La ruleta recibe partidas y ofrece plataformas del backlog. Los candidatos admiten la plataforma registrada o compatibilidad del juego, según la especificación.
- Cinco entradas por página. Búsqueda, plataforma, género, estado y orden vuelven a página 1; la página efectiva se limita al último índice válido si disminuyen los resultados. Estado vacío y botones deshabilitados conservados.

## Verificación

- `npm run check`: salida 0; 56 pruebas, lint, TypeScript y Prettier.
- `npm run build`: salida 0, Next.js 16.4.0 y proxy nativo.
- Pruebas de dominio: exclusión de logs ajenos, opciones sin logs, equivalencias de plataforma, precedencia de partidas y candidatos de backlog.
- Navegador sobre build local y Supabase real: colección temporal de seis juegos y seis partidas PC / Steam. Selector reducido a PC / Steam; cinco entradas en página 1 y una en página 2. Cambiar plataforma o buscar devolvió a página 1; búsqueda de un título mostró un resultado. Sin errores de consola del navegador.
- Evidencia: `docs/evidence/library-platform-pagination.png`. Cuenta temporal, registros dependientes, scripts y servidor eliminados al finalizar.

La paginación es de cliente sobre la colección ya cargada; no cambia el límite de lectura del servidor ni añade paginación de base de datos.

## Producción

Publicado con `npx vercel --prod` desde `fe90b6f`: estado `READY`, build remoto de 10 segundos. Despliegue `dpl_8xk7agehzyo91piZGJfp4ZSUXAYx`, URL `https://savestate-opar9da1t-ilhamelins-projects.vercel.app`, alias `https://savestate-eight.vercel.app`.

El perfil público respondió HTTP 200 con CSP nonce, etiqueta «Plataforma jugada» y controles de «Paginación de biblioteca» en el HTML de producción.
