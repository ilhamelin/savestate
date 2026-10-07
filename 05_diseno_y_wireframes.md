# 05. Diseño de Interfaz (UI/UX) y Wireframes

---

## 1. Tokens Visuales (Pixel Art & Cyberpunk)

* **Paleta de Colores Neón:**
  * `void-950` (`#08090C`): Fondo espacial profundo.
  * `surface-900` (`#111319`): Paneles de terminal y tarjetas.
  * `neon-cyan` (`#00F0FF`): Color primario de acción y enlaces.
  * `acid-green` (`#00FF66`): Estados `[Playing]` y línea de terminal bash.
  * `synth-pink` (`#FF0055`): Estados `[100% / Platinum]` y alertas.
  * `retro-amber` (`#FFB800`): Puntuación con estrellas/disquetes y advertencias de spoiler.
* **Bordes Pixelados Nítidos:** Implementados con técnicas CSS escalonadas (sin desenfoque moderno).
* **Overlay CRT Opcional:** Capa de líneas de escaneo conmutables para usuarios que deseen la experiencia visual retro completa.

---

## 2. Wireframes de Componentes Clave

### A. Barra HUD Superior
```
+-----------------------------------------------------------------------------------------------+
| [💾 SAVESTATE]   [Explorar]  [Listas]  [Feed]  |  [🔍 Buscar juego... (Ctrl+K)]  |  [⚡ user_99 🟢]  |
+-----------------------------------------------------------------------------------------------+
```

### B. Tarjeta de Juego (Game Card)
```
+---------------------------------------+
| +-----------------------------------+ |
| |          [ PORTADA ]              | |
| |          CHRONO TRIGGER           | |
| +-----------------------------------+ |
|  CHRONO TRIGGER (1995)                |
|  [SNES] [RPG]              ★ 9.8/10   |
|  -----------------------------------  |
|  [ + AGREGAR A BIBLIOTECA ]           |
+---------------------------------------+
```

### C. Perfil Gamer con Top 4 Favoritos
```
+-----------------------------------------------------------------------------------------------+
| [ BANNER PIXEL ART: NEO-TOKYO NIGHTS ]                                                        |
|  +---------+   cyber_warrior#2077                                  [ EDITAR PERFIL ]          |
|  | AVATAR  |   user@savestate:~$ Currently replaying Silent Hill 2                            |
|  +---------+   Seguidores: 142 | Siguiendo: 98 | Juegos: 340                                  |
|                                                                                               |
|  === TOP 4 FAVORITOS ===                                                                      |
|  +-------------+  +-------------+  +-------------+  +-------------+                           |
|  | Chrono      |  | Metal Gear  |  | Castlevania |  | Cyberpunk   |                           |
|  | Trigger     |  | Solid (PS1) |  | SOTN (PS1)  |  | 2077 (PC)   |                           |
|  +-------------+  +-------------+  +-------------+  +-------------+                           |
|                                                                                               |
|  [ BIBLIOTECA (340) ]   [ RESEÑAS (45) ]   [ LISTAS (6) ]   [ ESTADÍSTICAS ]                  |
+-----------------------------------------------------------------------------------------------+
```
