# Guía Completa de Niveles y Especificación de Rework del Sistema de Recompensas

## 1. Guía Oficial: Cómo Ganar XP y Subir de Nivel en SaveState

En SaveState, tu nivel (`✦ LVL`) representa tu trayectoria y odisea gamer. Cada acción significativa en la plataforma otorga puntos de experiencia (**XP**) auditados por el sistema de progresión.

### Tabla Oficial de Acciones y Recompensas de XP (`XP_ACTIONS`)

| Acción en la Plataforma | XP Otorgada | Cómo Realizarlo / Requisitos |
| :--- | :---: | :--- |
| 👑 **100% Platinum alcanzado** | **+300 XP** | Marcar un juego en estado `100% Platinum` habiendo desbloqueado todos los trofeos/logros. Dispara alerta especial. |
| 🎮 **Conectar cuenta de Steam** | **+200 XP** | Vincular tu Steam ID 64 en Ajustes y sincronizar tu biblioteca. |
| 🟦 **Conectar PlayStation (PSN)** | **+200 XP** | Vincular tu PSN ID en tu perfil de jugador. |
| 🟩 **Conectar Xbox Live** | **+200 XP** | Vincular tu Xbox Gamertag en tu perfil de jugador. |
| 🏆 **Campaña Finalizada (Cleared)** | **+150 XP** | Marcar un juego en estado `Cleared` al superar los créditos finales. |
| ✍️ **Escribir Reseña de Juego** | **+75 XP** | Publicar una crítica con valoración y texto detallado en la ficha de un juego. |
| 📸 **Publicar Momento (Highlight)** | **+40 XP** | Subir una captura o clip con nota y estado a tu muro de momentos. |
| 🕹️ **Sesión de Juego Registrada** | **+10 XP** | Registrar horas jugadas y progreso en el diario de partidas (`play_logs`). |

---

### Fórmula de Nivelación y Curva de Progresión
El sistema de niveles utiliza una curva exponencial suave:
$$\text{Nivel} = \lfloor (\text{XP} / 100)^{1 / 1.65} \rfloor + 1$$
$$\text{XP Requerida para Nivel } N = \lceil 100 \times (N - 1)^{1.65} \rceil$$

#### Hitos Principales de Nivel (1 al 50)
- **Nivel 1 (0 XP):** Título `Insert Coin` + Marco `Clásico`
- **Nivel 3 (314 XP):** Título `Button Masher`
- **Nivel 5 (985 XP):** Marco `Bronce Arcade`
- **Nivel 7 (1,842 XP):** Título `Backlog Explorer`
- **Nivel 10 (3,431 XP):** Título `Cartridge Blower` + Marco `Famicom 8-Bit`
- **Nivel 15 (6,950 XP):** Marco `Cyber Neon`
- **Nivel 20 (11,624 XP):** Título `Save Scummer` + Marco `Dorado 16-Bit`
- **Nivel 25 (17,402 XP):** Título `Speedrunner` + Marco `CRT Glitch`
- **Nivel 30 (24,250 XP):** Título `Achievement Hunter` + Marco `Platino`
- **Nivel 40 (41,208 XP):** Título `Secret Boss` + Marco `Vaporwave`
- **Nivel 50 (62,492 XP):** Título `Final Boss` + Marco `Final Boss`

---

## 2. Diagnóstico de Problemas Detectados en las Capturas del Usuario

1. **Horizontal Scrollbar indeseado en el modal (`media_1792077338451_89781062.png`):**
   - El contenedor `.rewards-dialog` tiene desbordamiento por cálculo de ancho y padding en `.rewards-road li`.
2. **Monotonía en niveles intermedios:**
   - 39 de los 50 niveles muestran el texto plano *"Continúa tu aventura"*, sin indicar a qué rango pertenece ni qué recompensa se aproxima.
3. **Falta de Guía accesible:**
   - El usuario no tiene cómo saber en la interfaz qué actividades dan XP, perdiéndose el incentivo de explorar la plataforma.
4. **HUD de Perfil plano (`media_1792077325902_6b0122a4.png`):**
   - Es una caja de texto simple con una barra sin relieve.

---

## 3. Rework UX/UI Propuesto

### Modal Unificado con Pestañas:
- **Pestaña 1: Camino de Recompensas (`50 Niveles`):**
  - Distinción visual clara entre:
    - `[✓ DESBLOQUEADO]` (Borde tenue, icono verde/naranja)
    - `[★ TU NIVEL ACTUAL]` (Resplandor neón naranja, badge `NIVEL ACTUAL`, scroll automático)
    - `[🔒 BLOQUEADO]` (Candado, XP faltante)
  - Identificación por tipo:
    - 👑 **Título:** Nombre en dorado con etiqueta de equipable.
    - 🖼️ **Marco de Avatar:** Mini previsualización del marco.
    - ⭐ **Rango:** Subtítulo que indica el tier (Novato, Bronce, Plata, Oro, Platino, Leyenda, Final Boss).
- **Pestaña 2: Guía de XP ("Cómo Subir de Nivel"):**
  - Tarjetas interactivas con cada una de las 8 acciones de `XP_ACTIONS`, indicando los puntos que otorga y un botón de acceso directo (ej: *"Ir a registrar partida"*, *"Vincular Steam en Ajustes"*).
- **Eliminación del Scrollbar Horizontal:**
  - `overflow-x: hidden;` en el diálogo y lista con padding controlado.
