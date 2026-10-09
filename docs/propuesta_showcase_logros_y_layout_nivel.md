# Especificación Técnica: Showcase de Logros Reales y Reubicación de Nivel/XP

**Fecha:** 9 de octubre de 2026  
**Rama de origen:** `research/antigravity`  
**Rama de destino:** `implementation/chatgpt` (Codex)  
**Referencias del usuario:**
1. **Imagen 1:** Mover el bloque de Nivel y Progreso de XP (`LevelProgress`) a la derecha de la cabecera del perfil, llenando el espacio lateral.
2. **Imagen 2:** Crear la **Zona Métrica / Datos de Logros** (`AchievementsShowcase`) ubicada debajo del «Dossier de métricas».

---

## 1. Módulo 1: Reubicación del Bloque de Nivel/XP (Imagen 1)

### 1.1. Diagnóstico del problema actual
En `src/components/profile-identity.tsx`, el bloque `<LevelProgress xp={profile.xp ?? 0} />` se renderiza dentro de la misma columna izquierda debajo de los enlaces de redes sociales, dejando un espacio vacío considerable a la derecha de la cabecera.

### 1.2. Reestructuración en `src/components/profile-identity.tsx`
Dividir la cabecera en dos columnas flex:
* **Columna izquierda (`.profile-identity-main`):** Avatar, nombre de usuario (`@username`), rango, estado terminal y redes sociales.
* **Columna derecha (`.profile-identity-aside`):** Bloque de progreso de nivel (`<LevelProgress xp={profile.xp ?? 0} />`).

```tsx
<div className="profile-heading">
  <div className="profile-identity-main">
    <AvatarFrame frame={profile.equipped_frame}>
      <div className="avatar">
        {profile.avatar_url ? (
          <Image src={profile.avatar_url} alt={`Avatar de ${profile.username}`} fill sizes="80px" unoptimized />
        ) : (
          <span aria-hidden="true">▣</span>
        )}
        {avatarOverlay}
      </div>
    </AvatarFrame>
    <div className="profile-identity-info">
      <p className="eyebrow">PLAYER PROFILE</p>
      <Heading>{usernameEditor ?? <>@{profile.username}</>}</Heading>
      <p className="player-rank">
        <LevelBadge level={profile.level ?? 1} />{' '}
        <span>{profile.equipped_title ?? 'Insert Coin'}</span>
      </p>
      <p className="profile-terminal">
        {terminalEditor ?? (animateTerminal ? <DecryptedText text={terminal} /> : terminal)}
      </p>
      {children}
    </div>
  </div>
  <div className="profile-identity-aside">
    <LevelProgress xp={profile.xp ?? 0} />
  </div>
</div>
```

### 1.3. Estilos en `src/app/globals.css`
```css
.profile-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 2rem;
  padding: 25px 0;
}

.profile-identity-main {
  display: flex;
  align-items: center;
  gap: 22px;
  flex: 1;
  min-width: 0;
}

.profile-identity-aside {
  width: 380px;
  max-width: 100%;
  flex-shrink: 0;
}

@media (max-width: 900px) {
  .profile-heading {
    flex-direction: column;
    align-items: stretch;
  }
  .profile-identity-aside {
    width: 100%;
  }
}
```

---

## 2. Módulo 2: Vitrina de Logros y Trofeos (`AchievementsShowcase`) (Imagen 2)

### 2.1. Arquitectura de Datos
El componente aprovecha directamente los registros en memoria que ya entrega la biblioteca (`entries`, `games`, `logs`):
* Filtra aquellos juegos cuyos `play_logs` contienen `console_progress != null`.
* Cubre todas las plataformas integradas:
  * **Steam:** `kind = 'achievements'` (`X / Y logros (Z%)`)
  * **Xbox:** `kind = 'gamerscore'` (`A / B G (Z%)`)
  * **PlayStation:** `kind = 'trophies'` (`C / D trofeos (Z%)`)
* **No requiere migraciones de base de datos ni llamadas a APIs externas adicionales.**

### 2.2. Diseño de Componentes: `src/components/achievements-showcase.tsx`

El componente se estructura exactamente como el diagrama del usuario:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  VITRINA DE LOGROS Y TROFEOS                                                 │
├───────────────────────────────────┬──────────────────────────────────────────┤
│  [COLUMNA IZQUIERDA: DESTACADO]   │  [COLUMNA DERECHA: LISTA Y FILTROS]      │
│                                   │                                          │
│  • Carátula del juego en grande   │  ┌────────────────────────────────────┐  │
│  • Título del juego               │  │ Filtro: [Todas | Steam | Xbox | PS]│  │
│  • Plataforma y Horas jugadas     │  └────────────────────────────────────┘  │
│  • Barra de progreso grande neón  │                                          │
│  • Cifras exactas de logros / G   │  [Miniatura] Juego 1                     │
│  • Insignia "100% PLATINADO"      │              Logros: 38 / 45 (84%)       │
│                                   │              [████████████████████░░░░]  │
│  * Al hacer clic en un juego de   │                                          │
│    la derecha, se destaca aquí en │  [Miniatura] Juego 2                     │
│    grande de inmediato.           │              Gamerscore: 1000/1000 G 🏆  │
│                                   │                                          │
│                                   │  Paginación: ← [ Página 1 de 3 ] →       │
└───────────────────────────────────┴──────────────────────────────────────────┘
```

#### Estado interno del componente:
1. `selectedId`: Identificador del juego actualmente destacado en grande (por defecto, el juego con mayor porcentaje o más horas).
2. `filterPlatform`: Filtro rápido (`'all'`, `'PC / Steam'`, `'Xbox'`, `'PlayStation'`).
3. `onlyCompleted`: Toggle para ver solo juegos con el `100%`.
4. `page`: Paginación de la lista derecha (4 juegos por página).

### 2.3. Ubicación en `src/app/players/[username]/page.tsx`
Justo debajo de `<StatsDossier stats={dossier} />`:

```tsx
{dossier ? (
  <>
    <StatsDossier stats={dossier} />
    <AchievementsShowcase
      games={library.games}
      entries={library.entries}
      logs={library.logs}
    />
    <MemoryCardExport ... />
  </>
) : null}
```

---

## 3. Plan de Ejecución para Codex

1. En `src/components/profile-identity.tsx` y `globals.css`, reubicar `<LevelProgress />` en la columna derecha `.profile-identity-aside`.
2. Crear `src/components/achievements-showcase.tsx` implementando:
   - Extracción de títulos con `console_progress`.
   - Tarjeta destacada grande en la columna izquierda.
   - Lista filtrable y paginada con miniaturas y barras de progreso en la columna derecha.
   - Interacción interactiva: clic en cualquier elemento de la lista cambia el juego destacado.
3. Importar y renderizar `<AchievementsShowcase />` debajo de `<StatsDossier />` en `src/app/players/[username]/page.tsx`.
4. Comprobar que `npm run check` pase sin errores.
