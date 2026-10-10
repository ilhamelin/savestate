# Especificación Técnica: Pulido Visual de Toolbar y Pestañas en Listas (/lists)

**Fecha:** 10 de octubre de 2026  
**Rama de origen:** `research/antigravity`  
**Rama de destino:** `implementation/chatgpt` (Codex)  
**Objetivo:** Pulir el contraste y jerarquía de la barra de herramientas de `/lists`, corrigiendo la ausencia de estilos para `.button.outline` (que provocaba que ambas pestañas y el botón de búsqueda se vieran como bloques cian sólidos idénticos), alineando los márgenes del toolbar y refinando los placeholders vacíos de las tarjetas.

---

## 1. Diagnóstico

1. **Ausencia de clase `.button.outline` en CSS:**
   * En `src/app/lists/page.tsx`, la pestaña inactiva y el botón de búsqueda usan `className="button outline small"`.
   * En `src/app/globals.css`, no existía una regla para `.button.outline`, por lo que el navegador heredaba `.button` estándar: fondo cian sólido (`background: var(--accent)`), texto oscuro (`#08090c`) y sombra cian.
   * **Resultado:** No había diferenciación visual entre la pestaña activa (`Mis listas`) y la inactiva (`Explorar Comunidad`). Además, el botón `Buscar` competía en peso visual con las pestañas principales.

2. **Margen residual en `.filter-buttons`:**
   * `.filter-buttons` tiene por defecto `margin: 18px 0;`, lo que desalineaba verticalmente las pestañas con respecto a la caja de búsqueda dentro de `.collections-toolbar`.

3. **Placeholder de portadas vacías:**
   * Las celdas sin carátula mostraban un simple `#`. Un placeholder más sutil con opacidad reducida o ícono retro (`·` o un gamepad tenue) ofrece un acabado más sobrio.

---

## 2. Cambios Requeridos

### 2.1. Definir `.button.outline` y resetear márgenes en `src/app/globals.css`

Añadir en la sección de botones o colecciones:

```css
/* Soporte para botones outline / fantasma */
.button.outline {
  background: transparent;
  color: var(--muted);
  border-color: #465064;
  box-shadow: none;
}

.button.outline:hover,
.button.outline:focus-visible {
  color: #f2f4f8;
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 8%, transparent);
}

/* Resetear margen de filter-buttons dentro del toolbar de colecciones */
.collections-toolbar .filter-buttons {
  margin: 0;
}

/* Alineación general del toolbar */
.collections-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  margin-top: 1.25rem;
  margin-bottom: 0.75rem;
}
```

### 2.2. Opcional: Icono o detalle en `src/components/collection-card.tsx`

Para las celdas vacías del mosaico 2x2, estilizar el placeholder para que sea sutil:
```css
.collection-cover-cell span {
  font-size: 11px;
  color: #465064;
  user-select: none;
}
```

---

## 3. Plan de Verificación

1. Revisar en el navegador que al estar en la pestaña `Mis listas`, esta tenga el fondo cian brillante y `Explorar Comunidad` tenga fondo oscuro transparente con borde gris sutil.
2. Confirmar que el botón `Buscar` tenga estilo outline sobrio y no sature visualmente la barra.
3. Verificar con `npm run check`.
