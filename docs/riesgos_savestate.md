# 06. Plan de Gestión y Matriz de Riesgos

---

## 1. Matriz de Riesgos Principales

| ID | Riesgo | Probabilidad | Impacto | Estrategia de Mitigación |
| :--- | :--- | :--- | :--- | :--- |
| **R-01** | Caída o rate limit de IGDB API | Alta | Crítico | Ingesta perezosa en base de datos local y caché en Edge de 24h. Modo offline de contingencia con catálogo local. |
| **R-02** | Inyección XSS en reseñas Markdown | Media | Crítico | Doble sanitización estricta con `isomorphic-dompurify` y políticas de Content Security Policy (CSP). |
| **R-03** | Fatiga visual por fuentes pixeladas | Alta | Alto | Fuentes pixeladas reservadas solo para títulos/botones. Lectura en `JetBrains Mono` con contraste WCAG AA. |
| **R-04** | Saturación de almacenamiento por imágenes | Media | Medio | Catálogo de avatares pixel art predefinidos y compresión WebP en el navegador (máx. 500 KB). |
| **R-05** | Spoilers arruinando la experiencia | Alta | Medio | Ocultación por defecto con filtro *blur*, casilla obligatoria y botón de reporte preventivo. |
