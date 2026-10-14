# Especificación Técnica: Decoración Temática de Halloween para la Barra de Navegación (Navbar)

## 1. Diagnóstico y Objetivo

El usuario solicita extender la ambientación de Halloween a toda la barra de navegación (`site-header`), cubriendo tanto:
1. **Enlaces centrales de navegación (`HeaderNav`):** `Explorar`, `Screen`, `Biblioteca`, `Transmisión`, `Momentos`, `Foro`, `Chat Global`, `Listas`, `Jugadores`, `Rift`, `Worlds`.
2. **Acciones derechas de cabecera (`HeaderActions`):** Botón de búsqueda rápida `[🔍 Ctrl K]`, campana de notificaciones `[🔔]` y botón de acceso a perfil `[Mi perfil ↗]`.

---

## 2. Especificación Visual y de Estilos

### 2.1 Enlaces Centrales (`HeaderNav`)
- **Estados Hover y Activo (`.nav-item-active`):**
  - El color activo se transforma de cian (`#00f0ff`) a **naranja calabaza neón (`#ff6b00`)**.
  - Efecto de resplandor: `text-shadow: 0 0 10px rgba(255, 107, 0, 0.7)`.
  - La barra o indicador activo adopta un degradado de naranja a púrpura espectral (`linear-gradient(90deg, #ff6b00, #7928ca)`).
- **Borde inferior del Header:**
  - El borde plano gris (`border-bottom: 1px solid var(--line)`) se sustituye por:
    `border-bottom: 1px solid #3c1e5a; box-shadow: 0 4px 18px rgba(255, 107, 0, 0.12);`
- **Telaraña sutil colgante:**
  - Una telaraña pequeña (`/icons/halloween/telarana-de-halloween.png`) colocada discretamente en el extremo del menú con opacidad 0.35 (`pointer-events: none`).

### 2.2 Acciones de Cabecera (Lado Derecho)
1. **Buscador Rápido (`.crt-toggle` - Ctrl K):**
   - Borde con acento violeta oscuro `#3a1c52`, transformándose en naranja brillante en hover:
     `border-color: #ff6b00; box-shadow: 0 0 10px rgba(255, 107, 0, 0.35);`
   - La etiqueta `Ctrl K` adopta tipografía con acento naranja tenue.
2. **Campana de Notificaciones (`.notification-trigger`):**
   - Icono de campana con resplandor espectral en hover: `color: #ff6b00; filter: drop-shadow(0 0 6px #ff6b00)`.
   - El badge numérico de alertas pendientes:
     `background: #ff6b00; color: #08070b; box-shadow: 0 0 8px rgba(255, 107, 0, 0.8);`
3. **Botón Principal "Mi perfil ↗" / "Conectar":**
   - Se transforma de cian a la paleta estacional de Halloween:
     - **Fondo:** `#ff6b00` (naranja calabaza).
     - **Borde:** `#ff6b00`.
     - **Texto:** `#08070b` (negro carbón con peso bold).
     - **Sombra arcade 3D:** Morado neón espectral (`box-shadow: 3px 3px 0 #7928ca, 0 0 16px rgba(255, 107, 0, 0.45);`).
     - **Decoración:** Incorpora una mini calabaza (`/icons/halloween/calabaza.png`, 16x16px) a la izquierda de *"Mi perfil"*.

---

## 3. Clases CSS Requeridas (`src/app/halloween.css`)

```css
/* Ambientación Navbar Halloween */
.site-header {
  border-bottom: 1px solid #3c1e5a !important;
  box-shadow: 0 4px 24px rgba(121, 40, 202, 0.15), 0 1px 0 rgba(255, 107, 0, 0.2) !important;
}

/* Enlaces nav */
.site-header nav a:hover {
  color: #ff6b00 !important;
  text-shadow: 0 0 8px rgba(255, 107, 0, 0.6);
}
.site-header nav a.nav-item-active {
  color: #ff6b00 !important;
  border-bottom: 2px solid #ff6b00 !important;
  text-shadow: 0 0 10px rgba(255, 107, 0, 0.75);
}

/* Acciones */
.crt-toggle:hover {
  border-color: #ff6b00 !important;
  box-shadow: 0 0 10px rgba(255, 107, 0, 0.35) !important;
}
.notification-trigger:hover svg {
  color: #ff6b00 !important;
  filter: drop-shadow(0 0 6px #ff6b00);
}
.notification-badge {
  background: #ff6b00 !important;
  color: #08070b !important;
  box-shadow: 0 0 8px rgba(255, 107, 0, 0.8) !important;
}

/* Botón Mi Perfil en Halloween */
.header-actions .button.small {
  background: #ff6b00 !important;
  border-color: #ff6b00 !important;
  color: #08070b !important;
  box-shadow: 3px 3px 0 #7928ca, 0 0 16px rgba(255, 107, 0, 0.45) !important;
  transition: all 0.2s ease;
}
.header-actions .button.small:hover {
  filter: brightness(1.15) !important;
  box-shadow: 3px 3px 0 #9d4edd, 0 0 22px rgba(255, 107, 0, 0.7) !important;
}
```
