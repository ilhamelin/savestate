# Investigación y Propuesta Técnica: Historial y Tracker de League of Legends en Savestate

**Versión:** 1.0  
**Fecha:** 10 de octubre de 2026  
**Área:** Integración de APIs Gaming, Perfil de Jugador y Fichas de Partidas  
**Estado:** Factibilidad Aprobada y Especificación de Arquitectura  

---

## 1. Resumen Ejecutivo

**Sí, es 100% posible y viable** extraer perfiles, rangos, historial de partidas y estadísticas detalladas de League of Legends utilizando la **Riot Games API oficial**.

Actualmente, millones de jugadores usan plataformas como OP.GG o U.GG. Integrar esta función dentro de **Savestate** con nuestra estética **cyber-retro / terminal arcade** permitirá que cada usuario vincule su Riot ID (`Nombre#TAG`) y tenga en su perfil:
1. **Resumen de Rango:** Liga actual (Hierro a Retador), LP, victorias, derrotas y winrate (%).
2. **Historial de Partidas Recientes:** Lista interactiva de las últimas 10-20 partidas (Victoria 🟢 / Derrota 🔴).
3. **Ficha Detallada de Cada Partida:**
   * Campeón jugado con miniatura oficial de alta resolución.
   * KDA (`Kills / Deaths / Assists`), ratio y participación en asesinatos.
   * Farm / Súbditos (CS total y CS por minuto).
   * Build de objetos (6 ítems + centinela/trinket).
   * Hechizos de invocador (Flash, Ignite, etc.).
   * Daño infligido a campeones y oro total.
   * Desglose 5v5: ver a los 10 jugadores de la partida, sus campeones y estadísticas.

---

## 2. Arquitectura de la Riot Games API

Riot Games ofrece una suite REST oficial gratuita para desarrolladores:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           RIOT GAMES API (OFICIAL)                          │
├───────────────────────┬─────────────────────────┬───────────────────────────┤
│      ACCOUNT-V1       │       LEAGUE-V4         │         MATCH-V5          │
│  (Riot ID -> PUUID)   │    (Rangos y Ligas)     │   (Historial y Detalles)  │
└───────────────────────┴─────────────────────────┴───────────────────────────┘
```

### 2.1. Paso 1: Identificación por Riot ID (`account-v1`)
El usuario ingresa su Riot ID (ejemplo: `Faker#KR1` o `Cristian#LAS`) y su servidor/región.
* **Endpoint:** `GET https://{regional-routing}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/{gameName}/{tagLine}`
* **Ruteo regional:**
  * `americas` (para LAS `la2`, LAN `la1`, NA `na1`, BR `br1`).
  * `europe` (para EUW, EUNE, TR, RU).
  * `asia` (para KR, JP).
* **Retorna:** `puuid` (Player Universally Unique Identifier, el ID inmutable del jugador).

### 2.2. Paso 2: Rango Competitivo (`league-v4`)
* **Endpoint:** `GET https://{platform}.api.riotgames.com/lol/league/v4/entries/by-puuid/{puuid}`
* **Retorna:**
  * Cola: `RANKED_SOLO_5x5` y `RANKED_FLEX_SR`.
  * Rango: `tier` (`GOLD`, `PLATINUM`, `EMERALD`, `DIAMOND`, etc.) y `rank` (`I`, `II`, `III`, `IV`).
  * `leaguePoints`: Puntos de liga (LP).
  * `wins`, `losses` -> Cálculo automático de Winrate %.

### 2.3. Paso 3: Historial de Partidas (`match-v5`)
* **Endpoint lista de partidas:**  
  `GET https://{regional}.api.riotgames.com/lol/match/v5/matches/by-puuid/{puuid}/ids?start=0&count=10`  
  Devuelve la lista de IDs únicos: `["LA2_14238910", "LA2_14238805", ...]`.
* **Endpoint de detalle de partida:**  
  `GET https://{regional}.api.riotgames.com/lol/match/v5/matches/{matchId}`  
  Devuelve el objeto completo con los 10 participantes, duración exacta en minutos, modo de juego, mapa y cada estadística individual.

---

## 3. CDN Gratuito de Recursos Visuales (Riot Data Dragon)

Para mostrar las imágenes oficiales de campeones, objetos e iconos **NO se requiere API key** ni consume peticiones. Riot ofrece su CDN público y gratuito denominado **Data Dragon**:

* **Icono de Invocador:**  
  `https://ddragon.leagueoflegends.com/cdn/{version}/img/profileicon/{profileIconId}.png`
* **Miniatura de Campeón:**  
  `https://ddragon.leagueoflegends.com/cdn/{version}/img/champion/{championName}.png`
* **Iconos de Ítems / Objetos:**  
  `https://ddragon.leagueoflegends.com/cdn/{version}/img/item/{itemId}.png`
* **Hechizos de Invocador:**  
  `https://ddragon.leagueoflegends.com/cdn/{version}/img/spell/{spellName}.png`

*(La versión actual de parches se consulta automáticamente con una petición ligera a `https://ddragon.leagueoflegends.com/api/versions.json`).*

---

## 4. Diseño UI/UX en Savestate: Estética Cyber-Arcade

```
+--------------------------------------------------------------------------+
|  [RIFT TRACKER // LEAGUE OF LEGENDS]                SERVIDOR: LAS (LA2)  |
+--------------------------------------------------------------------------+
|  [ICONO]  Cristian#131x   Nivel 412                                      |
|           RANGO SOLO/DUO: 💎 DIAMANTE IV (64 LP)                         |
|           Winrate: 56% (48V - 38D) · Racha de Victorias 🔥               |
+--------------------------------------------------------------------------+
|  HISTORIAL DE PARTIDAS:                                                  |
|                                                                          |
|  ┌────────────────────────────────────────────────────────────────────┐  |
|  │ 🟢 VICTORIA · Clasificatoria Solo/Dúo · Hace 2 horas · 28:14 min   │  |
|  │ [AHRI]  KDA: 12 / 2 / 8 (10.0 KDA) · CS: 224 (7.9/m) · Daño: 28.4k │  |
|  │ OBJETOS: [Ludens] [Shadowflame] [Rabadon] [Zhonya] [Botas] [Ward]  │  |
|  │ [▾ Ver tabla completa 5v5]                                         │  |
|  └────────────────────────────────────────────────────────────────────┘  |
|                                                                          |
|  ┌────────────────────────────────────────────────────────────────────┐  |
|  │ 🔴 DERROTA · ARAM · Hace 5 horas · 17:30 min                       │  |
|  │ [JINX]  KDA: 8 / 9 / 14 (2.4 KDA) · CS: 110 (6.2/m) · Daño: 19.1k  │  |
|  │ OBJETOS: [Kraken] [Infinity Edge] [Lord Dominik] [Botas]           │  |
|  │ [▾ Ver tabla completa 5v5]                                         │  |
|  └────────────────────────────────────────────────────────────────────┘  |
+--------------------------------------------------------------------------+
```

---

## 5. Requisitos y Clave de API de Riot Games

Para que Savestate pueda consultar la API de Riot:

1. **Riot Developer Portal:** Se accede con una cuenta de Riot en [developer.riotgames.com](https://developer.riotgames.com).
2. **Development Key (Instantánea):**
   * Gratuita de inmediato.
   * Límite: 20 peticiones cada 1 segundo y 100 peticiones cada 2 minutos (suficiente para consultas de usuarios).
   * *Nota:* La clave de desarrollo expira cada 24 horas a menos que se registre el proyecto.
3. **Personal Project / Production Key (Recomendada):**
   * Se solicita en la misma web enviando un formulario breve describiendo el proyecto (ej: *"Comunidad Savestate para que los jugadores muestren su historial de LoL en su perfil"*).
   * Es **100% gratuita** y no expira nunca.

---

## 6. Opciones de Implementación

Podemos implementarlo de dos formas según prefieras:

* **Modo A: Con Riot API Key Oficial (Recomendada y más completa)**  
  Guardas tu `RIOT_API_KEY` en `.env.local` y Savestate consulta directamente las partidas oficiales en tiempo real con todos los detalles de daño, runas, oro y tabla 5v5.
* **Modo B: Conexión Híbrida / Proxy con Caché en Supabase**  
  Para no saturar la API de Riot, cada vez que un usuario consulta su historial, Savestate guarda las últimas partidas en la base de datos de Supabase. Así, si refresca la página, la web carga al instante sin gastar peticiones a Riot.
