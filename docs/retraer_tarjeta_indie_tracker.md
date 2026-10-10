# Propuesta Técnica: Modo Retráctil / Compacto para la Tarjeta de itch.io Tracker

**Fecha:** 10 de octubre de 2026  
**Área:** UI/UX del Perfil (`src/components/profile-indie-tracker.tsx`, `src/app/globals.css`)  
**Destino:** Implementación en Savestate (`savestate 2` / Codex)  

---

## 1. Visión del Cambio

Actualmente, cada tarjeta de juego en *"Mis checkpoints de itch.io"* muestra siempre abierta toda la información: inputs de versión jugada, selector de estado, el banner de alarma, las notas privadas de guardado y los botones de acción (`Guardar checkpoint`, `Comprobar actualizaciones`, etc.).

Cuando un usuario solo quiere consultar rápidamente si hay actualizaciones o si tiene varios juegos en seguimiento, la tarjeta ocupa mucho espacio vertical.

### Objetivo:
Agregar un botón interactivo (tipo toggle/acordeón) para **contraer (retraer) y expandir** la tarjeta a gusto del usuario:
* **Modo Contraído (Retraído):** Solo muestra la cabecera compacta (portada oficial, título, autor, devlog, estado *"🟢 Sin actualización pendiente detectada"* o *"🟡 ¡Nueva actualización disponible!"*, botones externos y el botón de desplegar).
* **Modo Expandido:** Muestra todos los controles de edición, alarma y notas privadas.

---

## 2. Implementación en `src/components/profile-indie-tracker.tsx`

### 2.1. Estado Local y Persistencia en `localStorage`
En el componente `TrackerCard`:
```typescript
const [collapsed, setCollapsed] = useState(false);

// Cargar preferencia guardada al montar el componente
useEffect(() => {
  try {
    const saved = window.localStorage.getItem(`savestate_itch_collapsed_${tracker.id}`);
    if (saved !== null) {
      setCollapsed(saved === 'true');
    }
  } catch {
    /* Ignorar restricciones de almacenamiento */
  }
}, [tracker.id]);

// Guardar preferencia al hacer clic
function toggleCollapsed() {
  setCollapsed((prev) => {
    const next = !prev;
    try {
      window.localStorage.setItem(`savestate_itch_collapsed_${tracker.id}`, String(next));
    } catch {}
    return next;
  });
}
```

### 2.2. Botón de Toggle
En la fila de acciones de la cabecera (`indie-tracker-heading`), junto a los botones de *"Ver devlog"* y *"Página / Descargar"*:
```tsx
<div className="indie-tracker-actions-bar">
  <div className="filter-buttons">
    {draft.devlog ? (
      <a href={draft.devlog.url} target="_blank" rel="noopener noreferrer" className="button outline small">
        Ver devlog ↗
      </a>
    ) : null}
    <a href={draft.url} target="_blank" rel="noopener noreferrer" className="button outline small">
      Página / Descargar ↗
    </a>
  </div>
  <button
    type="button"
    className="button outline small indie-toggle-btn"
    aria-expanded={!collapsed}
    aria-label={collapsed ? `Desplegar detalles de ${draft.title}` : `Contraer detalles de ${draft.title}`}
    title={collapsed ? 'Desplegar controles' : 'Contraer controles'}
    onClick={() => setCollapsed((prev) => !prev)}
  >
    {collapsed ? '▾ Desplegar' : '▴ Contraer'}
  </button>
</div>
```

### 2.3. Renderizado Condicional del Contenido Inferior
```tsx
{!collapsed ? (
  <>
    <fieldset disabled={busy} className="indie-tracker-fields">
      {/* Controles de versión, estado, alarma y notas */}
    </fieldset>
    <div className="filter-buttons">
      {/* Guardar checkpoint, Comprobar actualizaciones, Dejar de rastrear */}
    </div>
    <p className="muted">Último intento: ...</p>
  </>
) : null}
```

---

## 3. Estilos en `src/app/globals.css`

```css
.indie-tracker-actions-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 0.75rem;
}

.indie-toggle-btn {
  margin-left: auto;
  font-family: var(--font-mono, monospace);
  letter-spacing: 0.5px;
}
```
