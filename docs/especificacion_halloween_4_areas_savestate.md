# Especificación Técnica: Expansión Temática Halloween en 4 Áreas de SaveState

## 1. Visión General
Esta especificación define los cambios exactos de diseño, maquetación, estilos CSS e iconos para implementar la estética **Cyberpunk Halloween** en cuatro áreas clave de SaveState:

1. **Buscador Rápido / Command Palette (`Ctrl + K`)**: *El Grimorio Espectral*.
2. **Radar de Juegos Gratis (`FreebiesTracker`)**: *Truco o Trato & Loot de Ultratumba*.
3. **Página de Error 404 (`NotFound`)**: *Cementerio de Checkpoints Perdidos*.
4. **Cabecera de Perfil de Jugador (`ProfileIdentity`)**: *Insignia Estacional "Survivor '26"*.

> **Nota de alcance:** Se excluye intencionadamente el contador de lanzamientos de GTA 6 (`Gta6Countdown`), manteniéndose en su diseño original.

---

## 2. Iconografía Empleada (Assets ya en `public/icons/halloween/`)
- `fantasma.png` -> Usado en el Command Menu y en la página 404.
- `comida-de-halloween.png` -> Usado en el Radar de Juegos Gratis (badge "Truco o Trato").
- `calabaza.png` -> Usado en el botón de retorno del 404 y en el badge de perfil de jugador.
- `telarana-de-halloween.png` -> Acentos decorativos de esquina.

---

## 3. Especificación Detallada por Componente

### Área 1: Buscador `Ctrl + K` (`src/components/command-menu.tsx`)
1. **Título del Diálogo:**
   - Incorporar icono `/icons/halloween/fantasma.png` (18x18) junto al título:
     ```tsx
     <h2 className="command-title command-title-halloween">
       <Image src="/icons/halloween/fantasma.png" alt="" width={18} height={18} unoptimized />
       <span>Grimorio de Comandos // Tu próximo checkpoint</span>
     </h2>
     ```
2. **Placeholder Temático:**
   - Actualizar `placeholder="Invocar juego, @jugador o comando en las sombras…"`
3. **Empty State:**
   - Si no hay resultados: `"Sin señales de vida... Ningún checkpoint en este cementerio 🪦"`
4. **Estilos en `src/app/halloween.css`:**
   - `[cmdk-dialog]`: Borde `#ff6b0066`, fondo `#090a12f2` con `backdrop-filter: blur(16px)`, sombra `0 0 45px rgba(121, 40, 202, 0.4)`.
   - `[cmdk-item][data-selected='true']`: Resaltado en naranja neón `#ff6b00` con fondo sutil `#ff6b0018`.
   - `[cmdk-group-heading]`: Púrpura espectral `#c084fc` con tipografía pixel.

---

### Área 2: Radar de Juegos Gratis (`src/components/freebies-tracker.tsx`)
1. **Eyebrow de Sección:**
   - Mostrar icono `/icons/halloween/comida-de-halloween.png` (16x16) con texto:
     `🎃 TRUCO O TRATO // JUEGOS GRATIS ACTIVOS`.
2. **Etiqueta de Valor (Worth Tag):**
   - Actualizar el formato a: `🎃 100% OFF · Valor {item.worth}` con halo brillante naranja.
3. **Botón de Reclamo:**
   - Texto y emoji festivo: `🍬 Reclamar dulce ↗` manteniendo el atributo accesible `<span className="sr-only"> (abre en otra pestaña)</span>`.
4. **Estilos en `src/app/halloween.css`:**
   - `.freebie-card:hover`: Borde con resplandor neón naranja/púrpura (`box-shadow: 0 0 20px rgba(255, 107, 0, 0.25)`).

---

### Área 3: Pantalla 404 (`src/app/not-found.tsx`)
1. **Estructura Renovada:**
   - Convertir la vista en el *"Cementerio de Checkpoints Perdidos"*:
     ```tsx
     import Link from 'next/link';
     import Image from 'next/image';

     export default function NotFound() {
       return (
         <div className="empty-state not-found-halloween">
           <div className="not-found-halloween-art">
             <Image
               src="/icons/halloween/fantasma.png"
               alt=""
               width={84}
               height={84}
               className="halloween-ghost-float"
               unoptimized
             />
           </div>
           <p className="eyebrow text-halloween-orange">ERROR 404 // CHECKPOINT PERDIDO</p>
           <h1>Partida devorada por las sombras.</h1>
           <p className="muted">
             El save state que buscas se perdió en la niebla espectral o nunca existió.
           </p>
           <Link href="/explore" className="button">
             <Image src="/icons/halloween/calabaza.png" alt="" width={16} height={16} unoptimized />
             Huir al catálogo seguro
           </Link>
         </div>
       );
     }
     ```
2. **Animación CSS (`halloween.css`):**
   - `.halloween-ghost-float`: Animación `ghost-bob 3s ease-in-out infinite alternate` que hace flotar el fantasma con un ligero resplandor azul/violeta.

---

### Área 4: Perfil de Jugador (`src/components/profile-identity.tsx`)
1. **Insignia Conmemorativa:**
   - En la fila `.player-rank` junto a `LevelBadge` y `profile.equipped_title`, añadir un badge estacional:
     ```tsx
     <span className="halloween-player-badge" title="Visitante durante el evento de Halloween 2026">
       <Image
         src="/icons/halloween/calabaza.png"
         alt=""
         width={14}
         height={14}
         className="halloween-badge-pumpkin"
         unoptimized
       />
       <span>SURVIVOR &apos;26</span>
     </span>
     ```
2. **Estilos en `src/app/halloween.css`:**
   - `.halloween-player-badge`: Píldora compacta con borde `#ff6b0055`, fondo `#231024`, texto `#ffb16c`, y resplandor sutil.
