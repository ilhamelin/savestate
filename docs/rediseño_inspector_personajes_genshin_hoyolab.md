# Especificación Técnica: Rediseño del Tracker de Genshin Impact al Estilo Inspector de Personajes y Resumen de Partida (Imágenes 3, 4 y 5)

## 1. Resumen Ejecutivo

Este documento especifica la actualización visual y técnica de `GenshinProfileView` (`src/components/genshin-profile-view.tsx`) y su modelo de datos (`src/domain/genshin-build.ts`, `src/domain/competitive-tracker.ts`, `src/services/genshin-enka-store.ts`) para replicar la estructura y riqueza de datos de las **Imágenes 3, 4 y 5**:

1. **Cabecera con Banner NameCard, Avatar de Perfil, Servidor y Panel Unificado `✦ Resumen de la partida` (Imagen 3)**:
   - Muestra el avatar circular del jugador, su Nickname, insignia `Niv. {level}`, región del servidor (`America Server`, `Europe Server`, `Asia Server` según el primer dígito del UID), `UID {uid}` y el banner oficial de su tarjeta de perfil (`nameCardUrl`).
   - Debajo, un panel unificado `✦ Resumen de la partida` con las métricas centradas en grilla limpia (`Rango de Aventura`, `Nivel de Mundo`, `Logros alcanzados`, `Personajes en escaparate`, `Personajes con Amistad Máx.`, `Espiral del Abismo`, `Teatro Fantasía`, `Conflagración estigia`).
2. **Sección `✦ Mis personajes` con Carrusel Superior de Avatares y Vista Maestro-Detalle (Imágenes 4 y 5)**:
   - **Tira horizontal de selección de personajes**: avatares circulares de todos los personajes del escaparate con indicador activo y flechas `‹` / `›`.
   - **Panel Principal Dividido del Personaje Seleccionado**:
     - **Izquierda (Ilustración + Constelaciones + Talentos)**: Splash Art completo (`UI_Gacha_AvatarImg_*.png`), columna curva derecha con los **6 nodos de Constelación** (con icono oficial de cada constelación o candado `🔒` si está bloqueada), indicador `👁️ Amistad: {friendship}` y fila inferior con los **círculos de Talentos con sus iconos oficiales y nivel**.
     - **Derecha (`Atributos del personaje` + `Arma`)**:
       - Cabecera con icono elemental, nombre del personaje, badge `Niv. {level}` y estrellas `★★★★★`.
       - Tabla de 2 columnas con **Base + Bono en cian** para `Vida Máx.`, `ATQ` y `DEF`, más `Maestría Elemental`, `Bono de Daño Elemental/Físico`, `Prob. CRIT`, `Daño CRIT`, `Bono de Curación`, `Bono de Curación recibida` y `Recarga de Energía`.
       - Tarjeta `Arma` con icono `64×64 px`, insignia de refinamiento (`1`–`5`) en la esquina del icono, nombre en español, badge `Niv. {level}`, `ATQ Básico: {baseAtk}` y atributo secundario.
   - **Sección Inferior `Artefactos` con las 5 Tarjetas Completas (Flor, Pluma, Reloj, Cáliz, Corona)**:
     - Fila resumen de `Atributos principales` y `Atributos secundarios`.
     - **5 tarjetas verticales lado a lado**, cada una con: nombre de pieza/set en español, badge `Niv. {level}`, estrellas `★★★★★`, icono del artefacto arriba a la derecha, **Atributo Principal en grande** y la **lista completa de sus 4 Atributos Secundarios (`reliquarySubstats`)** resaltando en dorado los substats críticos/porcentuales.

---

## 2. Ampliación de Datos en Backend y Dominio

### 2.1. Ampliar `src/services/genshin-enka-store.ts`

Descargar y cachear también (junto a `characters.json` y `loc.json`):
- `https://raw.githubusercontent.com/EnkaNetwork/API-docs/master/store/namecards.json`
- `https://raw.githubusercontent.com/EnkaNetwork/API-docs/master/store/pfps.json`

Exportar en `EnkaStore`:
`{ characters, locEs, locEn, namecards, pfps }`.

### 2.2. Ampliar `GenshinProfile` y `GenshinShowcaseCharacter` (`src/domain/genshin-build.ts` y `src/domain/competitive-tracker.ts`)

1. **En `GenshinProfile`**:
   - `profileIconUrl: string | null` (resuelto desde `store.pfps[String(player.profilePicture?.id)]?.iconPath` convirtiendo `_Circle` o usando `store.characters[String(player.profilePicture?.avatarId)]?.SideIconName`, o fallback al `iconUrl` del primer personaje).
   - `nameCardUrl: string | null` (`enkaIcon(record(store.namecards?.[String(player.nameCardId)]).icon)`).
   - `serverRegion: string` (`uid.startsWith('6') ? 'America Server' : uid.startsWith('7') ? 'Europe Server' : uid.startsWith('8') ? 'Asia Server' : uid.startsWith('9') ? 'TW, HK, MO Server' : 'Server'`).

2. **En `GenshinShowcaseCharacter` (`src/domain/genshin-build.ts`)**:
   - `splashUrl: string | null`: derivado de `meta.SideIconName` reemplazando `'UI_AvatarIcon_Side_'` por `'UI_Gacha_AvatarImg_'` y pasándolo por `enkaIcon(...)`.
   - `constellationIcons: string[]`: los 6 iconos en `meta.Consts` convertidos con `enkaIcon(...)`.
   - `talentDetails: { level: number; iconUrl: string | null }[]`: para cada `skillId` en `meta.SkillOrder.slice(0, 3)`, `{ level: nonnegative(record(detail?.skillLevelMap)[String(skillId)]) ?? 1, iconUrl: enkaIcon(record(meta.Skills)[String(skillId)]) }`.
   - `stats` ampliado con:
     - `baseHp: number` (`Math.round(number('1'))`)
     - `bonusHp: number` (`Math.max(0, Math.round(number('2000')) - Math.round(number('1')))`)
     - `hp: number` (`Math.round(number('2000'))`)
     - `baseAtk: number` (`Math.round(number('4'))`)
     - `bonusAtk: number` (`Math.max(0, Math.round(number('2001')) - Math.round(number('4')))`)
     - `atk: number` (`Math.round(number('2001'))`)
     - `baseDef: number` (`Math.round(number('7'))`)
     - `bonusDef: number` (`Math.max(0, Math.round(number('2002')) - Math.round(number('7')))`)
     - `def: number` (`Math.round(number('2002'))`)
     - `critRate: number` (`percent('20')`)
     - `critDmg: number` (`percent('22')`)
     - `healingBonus: number` (`percent('26')`)
     - `incomingHealingBonus: number` (`percent('27')`)
     - `energyRecharge: number` (`percent('23')`)
     - `elementalMastery: number` (`Math.round(number('28'))`)
     - `damageBonusLabel: string` y `damageBonusValue: number` (buscando el mayor bono en `fp` entre `['40', 'Bono de Daño Pyro']`, `['41', 'Bono de Daño Electro']`, `['42', 'Bono de Daño Hydro']`, `['43', 'Bono de Daño Dendro']`, `['44', 'Bono de Daño Anemo']`, `['45', 'Bono de DañoGeo']`, `['46', 'Bono de Daño Cryo']`, `['30', 'Bono de Daño Físico']`; si todos son 0, mostrar el bono del elemento propio del personaje con `0.0%`).
   - `weapon`: añadir diccionario de nombres en español para armas cuyos hashes no estén en `loc.json` (`Pole_BloodMoon: 'Semblante de la Luna Carmesí'`, `Pole_Homa: 'Báculo de Homa'`, `Sword_Zephyrus: 'Espada de Favonius'`, `Catalyst_MenulisRing: 'Espejo Tejenoches'`, `Claymore_Deshret: 'Emblema del Mar de Juncos'`, `Sword_Narukami: 'Reflejo de las Tinieblas'`, `Bow_Worldbane: 'Aqua Simulacra'`, `Pole_Narukami: 'Luz del Segador'`).
   - `artifacts` ampliado para que cada pieza incluya:
     - `slot: string` (`EQUIP_BRACER: 'Flor de la Vida'`, `EQUIP_NECKLACE: 'Pluma de la Muerte'`, `EQUIP_SHOES: 'Arenas del Eón'`, `EQUIP_RING: 'Cáliz de Eonothem'`, `EQUIP_DRESS: 'Tiara de Logos'`)
     - `name: string` (`localized(art.nameTextMapHash, localized(art.setNameTextMapHash, slotLabel, store), store)`)
     - `setName: string` (`localized(art.setNameTextMapHash, '', store)`)
     - `iconUrl: string`
     - `level: number`
     - `rarity: number`
     - `mainStatLabel: string` (ej. `'Vida'`, `'ATQ'`, `'Bono de Daño Pyro'`, `'Prob. CRIT'`, `'Daño CRIT'`)
     - `mainStatValue: string` (ej. `'4780'`, `'311'`, `'46.6%'`, `'62.2%'`)
     - `mainStatHighlight: boolean` (`true` para Reloj, Cáliz y Corona)
     - `substats: { label: string; value: string; highlighted: boolean }[]` mapeando `art.reliquarySubstats` (`highlighted: true` cuando `appendPropId` sea `FIGHT_PROP_CRITICAL`, `FIGHT_PROP_CRITICAL_HURT`, `FIGHT_PROP_ATTACK_PERCENT`, `FIGHT_PROP_HP_PERCENT`, `FIGHT_PROP_CHARGE_EFFICIENCY` o `FIGHT_PROP_ELEMENT_MASTERY`).
     - `mainStat: string` (mantenido por compatibilidad: `${mainStatLabel} ${mainStatValue}`).

---

## 3. Rediseño del Componente `src/components/genshin-profile-view.tsx`

Convertir `GenshinProfileView` en un Client Component (`'use client'`) con `const [selectedIdx, setSelectedIdx] = useState(0)` para navegar entre los personajes del escaparate:

1. **Banner Superior del Jugador + Panel `✦ Resumen de la partida` (Imagen 3)**:
   - Cabecera con imagen de fondo `data.nameCardUrl` oscurecida suavemente, avatar circular a la izquierda (`data.profileIconUrl`), nombre `{data.nickname}`, insignia dorada `Niv. {data.level}`, subtítulo `{data.serverRegion}  |  UID {data.uid}` y firma si existe.
   - Panel `.genshin-chronicle-summary` con título `✦ Resumen de la partida` y grilla de métricas estilo HoYoLAB (valor grande en blanco arriba, etiqueta gris abajo):
     - `{data.level}` / `Rango de Aventura`
     - `{data.worldLevel}` / `Nivel de Mundo`
     - `{data.achievements}` / `Logros alcanzados`
     - `{data.showcase.length}` / `Personajes`
     - `{data.fetterCount}` / `Personajes con Amistad Máx.`
     - `{data.abyss}` / `Espiral del Abismo`
     - `{data.theater ?? '-'}` / `Teatro Fantasía`
     - `{data.stygian ?? '-'}` / `Conflagración estigia`

2. **Inspector de Personajes `✦ Mis personajes` (Imágenes 4 y 5)**:
   - **Tira de Avatares (`genshin-avatar-strip`)**:
     - Botones circulares con `character.iconUrl` para cada personaje en `data.showcase`. El personaje activo (`index === selectedIdx`) tiene anillo luminoso e indicador inferior.
   - ** Tarjeta Principal del Personaje Activo (`genshin-character-showcase-stage`)**:
     - **Columna Izquierda (`genshin-stage-visual`)**:
       - Imagen grande `character.splashUrl ?? character.iconUrl` centrada.
       - Columna vertical/arco a la derecha de la ilustración con los **6 círculos de Constelación (`genshin-constellation-rail`)**: muestra los 6 iconos (`character.constellationIcons`), encendidos para `i < character.constellations` y con candado `🔒` superpuesto para `i >= character.constellations`.
       - En la parte inferior izquierda de la ilustración:
         - Etiqueta `👁️ Amistad: {character.friendship ?? '—'}`
         - Fila de **Talentos circulares (`genshin-talent-row`)** con el icono oficial de cada habilidad (`talent.iconUrl`) y una pastilla circular con el nivel (`{talent.level}`).
     - **Columna Derecha (`genshin-stage-details`)**:
       - Cabecera con nombre `{character.name}`, badge dorado `Niv. {character.level}`, estrellas `★★★★★` y elemento `{character.element}`.
       - **Sub-panel `Atributos del personaje`**:
         - Tabla de 2 columnas exactamente como en las Imágenes 4 y 5:
           - `Vida Máx.`: muestra en dos líneas pequeñas `{baseHp}` y `+{bonusHp}` (en color cian `#38bdf8`) junto al total en grande `{hp}`
           - `ATQ`: `{baseAtk}` y `+{bonusAtk}` (en cian) junto al total `{atk}`
           - `DEF`: `{baseDef}` y `+{bonusDef}` (en cian) junto al total `{def}`
           - `Maestría Elemental`: `{elementalMastery}`
           - `{damageBonusLabel}`: `{damageBonusValue}%`
           - `Prob. CRIT`: `{critRate}%`
           - `Daño CRIT`: `{critDmg}%`
           - `Bono de Curación`: `{healingBonus}%`
           - `Bono de Curación recibida`: `{incomingHealingBonus}%`
           - `Recarga de Energía`: `{energyRecharge}%`
       - **Sub-panel `Arma`**:
         - Miniatura de `64×64 px` del arma con recuadro según rareza y badge de refinamiento `{character.weapon.refinement}` en la esquina superior izquierda, nombre del arma en grande, badge `Niv. {character.weapon.level}`, `ATQ Básico: {character.weapon.baseAtk}` y `{character.weapon.substat}`.
   - **Sección Inferior `Artefactos` (Imágenes 4 y 5)**:
     - Fila superior con chips de `Atributos principales:` (mostrando los atributos principales de Reloj, Cáliz y Corona en dorado) y `Atributos secundarios:` (`Prob. CRIT ✓`, `Daño CRIT ✓`, `ATQ / Vida % ✓`).
     - **Cuadrícula de 5 columnas (`genshin-artifacts-cards-grid`)**:
       - Cada tarjeta muestra:
         - Nombre de pieza/set arriba a la izquierda, badge `Niv. {art.level}`, estrellas `{'★'.repeat(art.rarity)}` y el icono del artefacto (`48×48 px`) arriba a la derecha.
         - **Atributo Principal**: nombre a la izquierda (`{art.mainStatLabel}`) y valor grande a la derecha (`{art.mainStatValue}`, en dorado si `art.mainStatHighlight`).
         - **4 Atributos Secundarios (`art.substats`)**: lista vertical debajo de una línea divisoria sutil, mostrando `{sub.label}` a la izquierda y `+{sub.value}` a la derecha (resaltado en dorado `#facc15` cuando `sub.highlighted` sea `true`).
