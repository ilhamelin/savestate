# Especificación Técnica: Rediseño Visual y Técnico de Genshin Impact (Enka.Network Builds Completas) y Visibilidad del Radar en Vivo (Steam + CheapShark + Twitch)

## 1. Diagnóstico del Estado Actual

1. **Genshin Impact · Enka.Network en `/rift` (`src/domain/competitive-tracker.ts` y `src/components/competitive-hub-tabs.tsx`)**:
   - Actualmente solo lee `playerInfo.showAvatarInfoList` sin cruzar con el diccionario oficial de personajes/localización de Enka (`characters.json` y `loc.json`) ni extraer el detalle completo de `avatarInfoList`.
   - Como resultado, muestra tarjetas vacías con `"Personaje #10000096 · Nivel 90 · Pyro 🔥"` sin nombre real, sin retrato oficial, sin rareza (`5★`/`4★`), sin constelaciones (`C0`–`C6`), sin talentos (`8 / 10 / 8`), sin estadísticas de combate (`HP`, `ATQ`, `DEF`, `Prob. CRIT`, `Daño CRIT`, `Recarga de Energía`, `Maestría Elemental`), sin arma equipada y sin artefactos.
2. **Visibilidad del Radar en Vivo (Ofertas CheapShark + Jugadores en Steam + Twitch Live Radar)**:
   - Actualmente solo se renderiza dentro de `/games/[slug]` (`GameLiveRadar`) y además `src/services/game-live-telemetry.ts` exige igualdad exacta de cadenas (`normalized(first.name) === normalized(title)`), provocando que muchos juegos devuelvan `null` y oculten el panel por completo.
   - Tampoco existe una pestaña dedicada en `/rift` para consultar cualquier juego bajo demanda.

---

## 2. Mejora Visual y Técnica #1: Genshin Impact Showcase Pro (Enka.Network Full Build Telemetry)

### 2.1. Enriquecimiento de Datos con el Store Oficial de Enka.Network

En el servidor (`src/app/api/tracker/multi/inspect/route.ts` o nuevo helper en `src/services/genshin-enka.ts`), cachear con `unstable_cache` (`revalidate: 86400`):
- `https://raw.githubusercontent.com/EnkaNetwork/API-docs/master/store/characters.json`
- `https://raw.githubusercontent.com/EnkaNetwork/API-docs/master/store/loc.json`

Para cada personaje en `playerInfo.showAvatarInfoList` (cruzado con `data.avatarInfoList` por `avatarId`):
1. **Identidad y Retrato**:
   - `name`: `loc.es[String(meta.NameTextMapHash)] ?? loc.en[String(meta.NameTextMapHash)] ?? fallbackName`
   - `iconUrl`: `meta.SideIconName ? https://enka.network/ui/${meta.SideIconName.replace('UI_AvatarIcon_Side_', 'UI_AvatarIcon_')}.png : null`
   - `rarity`: `meta.QualityType === 'QUALITY_ORANGE' ? 5 : 4`
   - `constellations`: `Array.isArray(detail?.talentIdList) ? detail.talentIdList.length : 0` (`C0` a `C6`)
   - `friendship`: `detail?.fetterInfo?.expLevel ?? null`
   - `talents`: `(meta.SkillOrder ?? []).map(skillId => detail?.skillLevelMap?.[String(skillId)] ?? 1)` (ej. `[8, 10, 8]`)
2. **Estadísticas de Combate Reales (`detail.fightPropMap`)**:
   - `hp`: `Math.round(Number(fp['2000'] ?? 0))`
   - `atk`: `Math.round(Number(fp['2001'] ?? 0))`
   - `def`: `Math.round(Number(fp['2002'] ?? 0))`
   - `critRate`: `Number(((Number(fp['20'] ?? 0)) * 100).toFixed(1))`
   - `critDmg`: `Number(((Number(fp['22'] ?? 0)) * 100).toFixed(1))`
   - `energyRecharge`: `Number(((Number(fp['23'] ?? 0)) * 100).toFixed(1))`
   - `elementalMastery`: `Math.round(Number(fp['28'] ?? 0))`
3. **Arma Equipada (`detail.equipList.find(e => e.weapon)`)**:
   - `name`: `loc.es[String(weapon.flat.nameTextMapHash)] ?? loc.en[String(weapon.flat.nameTextMapHash)] ?? weaponFallbackName`
   - `iconUrl`: `https://enka.network/ui/${weapon.flat.icon}.png`
   - `level`: `weapon.weapon.level ?? 1`
   - `refinement`: `(Object.values(weapon.weapon.affixMap ?? {})[0] ?? 0) + 1` (ej. `R1`–`R5`)
   - `rarity`: `weapon.flat.rankLevel ?? 4`
   - `baseAtk`: `weapon.flat.weaponStats?.find(s => s.appendPropId === 'FIGHT_PROP_BASE_ATTACK')?.statValue ?? null`
   - `substat`: segundo elemento de `weapon.flat.weaponStats` formateado con su etiqueta (`Prob. CRIT`, `Daño CRIT`, `ATQ%`, `Recarga de Energía`, `Maestría Elemental`, `VIDA%`, `DEF%`).
4. **Artefactos Equipados (`detail.equipList.filter(e => e.reliquary)`)**:
   - Lista de hasta 5 piezas con:
     - `iconUrl`: `https://enka.network/ui/${art.flat.icon}.png`
     - `level`: `(art.reliquary.level ?? 1) - 1` (ej. `+20`)
     - `rarity`: `art.flat.rankLevel ?? 5`
     - `mainStatLabel` y `mainStatValue` (ej. `Daño CRIT +62.2%`, `Bono Pyro +46.6%`, `ATQ +46.6%`).
5. **Métricas Adicionales de Cuenta (`playerInfo`)**:
   - `stygian`: si existe `stygianIndex`, devolver `Nivel ${stygianIndex} (${stygianSeconds ?? 0}s)`.
   - `theater`: si existe `theaterActIndex`, devolver `Acto ${theaterActIndex}`.

### 2.2. Rediseño Visual HUD del Perfil y Tarjetas de Personajes en `CompetitiveHubTabs`

1. **Cabecera de Cuenta Genshin (Hero HUD)**:
   - Mostrar el nombre del jugador en grande, su firma (`signature`), badge con el `UID` y una cuadrícula de **6 tarjetas KPI (`genshin-kpi-grid`)**:
     - `RANGO DE AVENTURA`: `AR {level}`
     - `NIVEL DE MUNDO`: `WL {worldLevel}`
     - `LOGROS TOTALES`: `🏆 {achievements}`
     - `ESPIRAL DEL ABISMO`: `🌀 Piso {abyss}`
     - `ASALTO / TEATRO`: `⚔️ {stygian ?? theater ?? 'Sin registro'}`
     - `AMISTAD MÁXIMA`: `❤️ {fetterCount} personajes`
2. **Tarjetas de Personaje Estilo Enka Build Card (`genshin-character-card`)**:
   - **Borde y acento dinámico por elemento** (`Pyro` rojo/ámbar, `Electro` violeta, `Hydro` azul cian, `Dendro` verde esmeralda, `Cryo` celeste hielo, `Geo` dorado, `Anemo` turquesa).
   - **Encabezado del personaje**:
     - Retrato oficial de 64×64 px (`https://enka.network/ui/UI_AvatarIcon_*.png`) con marco dorado (`5★`) o púrpura (`4★`).
     - Nombre real del personaje (`Arlecchino`, `Shogun Raiden`, `Furina`, etc.), estrellas `★★★★★`, píldora de constelación `C{constellations}`, nivel `Nvl. {level}/90`, elemento y talentos `Talentos: {talents.join(' / ')}`.
   - **Grid de Estadísticas de Combate (2×3 compacta)**:
     - `❤️ VIDA: {hp.toLocaleString('es-CL')}`
     - `⚔️ ATQ: {atk.toLocaleString('es-CL')}`
     - `🛡️ DEF: {def.toLocaleString('es-CL')}`
     - `🎯 Prob. CRIT: {critRate}%`
     - `💥 Daño CRIT: {critDmg}%`
     - `⚡ Recarga (ER): {energyRecharge}%` / `✨ Maestría (EM): {elementalMastery}`
   - **Bloque de Arma Equipada**:
     - Miniatura de 44×44 px del arma, nombre del arma, `Nvl. {level}`, badge `R{refinement}`, `ATQ Base {baseAtk}` y sub-estadística.
   - **Fila de Artefactos Equipados (5 iconos)**:
     - Los 5 iconos de artefactos con su badge `+{level}` y tooltip con su estadística principal.

---

## 3. Mejora Visual y Técnica #2: Hacer Visible y Accesible el Radar en Vivo (Steam + CheapShark + Twitch)

1. **Mejorar el emparejamiento en `src/services/game-live-telemetry.ts`**:
   - En lugar de exigir igualdad estricta `normalized(first.name) === normalized(title)`, normalizar eliminando signos de puntuación (`[^a-z0-9\s]`) y aceptar coincidencia cuando los nombres normalizados sean iguales o uno contenga al otro (`a === b || a.includes(b) || b.includes(a)`).
   - En CheapShark, si no hay `steamAppId`, consultar `https://www.cheapshark.com/api/1.0/deals?title=${encodeURIComponent(title)}&pageSize=6` (sin `&exact=1`, que bloquea títulos con signos o ediciones).
   - En Twitch Helix, si `helix/games?name=` no devuelve coincidencia exacta, usar como fallback `https://api.twitch.tv/helix/search/categories?query=${encodeURIComponent(title)}&first=1` para obtener el `id` de la categoría en Twitch y cargar sus streams en vivo.
2. **Añadir la 4ª Pestaña `📡 Radar en Vivo (Steam · Ofertas · Twitch)` en `/rift` (`CompetitiveHubTabs`)**:
   - Crear el endpoint `POST /api/tracker/radar` que reciba `{ title: string }` y devuelva `await fetchGameLiveTelemetry(title)`.
   - Añadir la pestaña `📡 Radar en Vivo (Steam · Ofertas · Twitch)` en `src/components/competitive-hub-tabs.tsx` con:
     - Buscador por título de juego y botones de acceso rápido (`Elden Ring`, `Counter-Strike 2`, `Cyberpunk 2077`, `Hollow Knight`, `Baldur's Gate 3`).
     - Renderizado completo de los jugadores actuales en Steam (`🟢 X jugando ahora en Steam`), espectadores en vivo de Twitch (`🔴 X espectadores`), precio mínimo histórico (`🏷️ Mínimo histórico`), comparador de ofertas PC con enlaces directos y grilla de los 4 streams de Twitch en directo.
   - Mantener también el componente `<GameLiveRadar title={game.title} />` dentro de cada ficha de juego `/games/[slug]`.
