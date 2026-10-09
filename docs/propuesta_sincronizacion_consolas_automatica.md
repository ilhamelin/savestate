# Propuesta Técnica: Sincronización Automática de Consolas por ID (PlayStation Network & Xbox Live)
**Fecha:** 9 de octubre de 2026  
**Origen:** Auditoría e Investigación (`research/antigravity`)  
**Destino:** Equipo de Implementación (`implementation/chatgpt` / Codex)  
**Propósito:** Especificar la arquitectura técnica, integración de clientes upstream y componentes de interfaz para sincronizar automáticamente títulos jugados desde PlayStation Network y Xbox Live directamente mediante el identificador público del usuario, eliminando la dependencia de archivos de exportación manuales.

---

## 1. Justificación y Alcance Funcional

En la primera fase del importador de consolas se requería la carga de archivos `.csv` o `.json` o escribir listas manuales de texto. Sin embargo, para la mayoría de los usuarios de consola, extraer un archivo de exportación representa una fricción técnica innecesaria.

Esta mejora introduce:
1. **Sincronización Directa por ID:** El usuario simplemente ingresa su **PSN Online ID** (ej: `Cristian131x`) o **Xbox Gamertag** y presiona `[ 🔍 Sincronizar desde PSN / Xbox ]` (o la tecla Enter).
2. **Extracción Automática de Catálogo:**
   - Consulta los títulos jugados públicos y sus trofeos/logros.
   - Detecta la plataforma nativa (`PlayStation 5`, `PlayStation 4`, `PlayStation 3`, `PlayStation Vita`, `PSP`, `Xbox Series X|S`, `Xbox One`, `Xbox 360`).
   - Sugiere estado completado (`cleared`) si se obtuvo el platino o 100% de logros, o en curso (`playing`) en caso contrario.
3. **Persistencia Automática:** Al sincronizar, el identificador se almacena de inmediato en `profiles.psn_id` o `profiles.xbox_gamertag`.
4. **Organización Limpia de Interfaz:** Las opciones secundarias (subida de archivos o pegado de listas manuales) se conservan dentro de un acordeón colapsable `<details>`.

---

## 2. Arquitectura de Integración Upstream

### 2.1. PlayStation Network (`psn-api`)
* **Dependencia:** Paquete `psn-api` (zero-dependency, compatible con Node.js 24).
* **Secreto de Servidor:** Variable de entorno `PSN_NPSSO` (obtenida una única vez desde `https://ca.account.sony.com/api/v1/ssocookie`).
* **Flujo de Ejecución:**
  1. `exchangeNpssoForAccessCode(process.env.PSN_NPSSO)`
  2. `exchangeAccessCodeForAuthTokens(accessCode)`
  3. `makeUniversalSearch(auth, onlineId, 'SocialAllAccounts')` ➔ resuelve `accountId`.
  4. `getUserTitles(auth, accountId, { limit: 100 })` ➔ obtiene colección de trofeos y juegos jugados.
  5. Mapeo a filas normalizadas de `ConsoleRow`.

### 2.2. Xbox Live (`xbl.io` / OpenXBL)
* **Secreto de Servidor:** Variable `XBL_API_KEY`.
* **Flujo:** Búsqueda por gamertag (`/friends/search?gt=...`) para obtener `xuid`, y posterior consulta de títulos (`/achievements/xuid/...`).

---

## 3. Especificación de Archivos a Modificar

1. **`package.json`**:
   - Dependencia `psn-api`.
2. **`src/integrations/consoles/server.ts`** *(Nuevo)*:
   - Exporta funciones de servidor `fetchPsnTitles(onlineId)` y `fetchXboxTitles(gamertag)`.
   - Control de errores HTTP: 404 (perfil inexistente o privado), 503 (servidor sin variable de entorno configurada), 502 (error de conexión upstream).
3. **`src/services/console-import.ts`**:
   - Añadir soporte para `action === 'sync'`.
   - Validación y guardado automático del identificador en Supabase `profiles`.
4. **`src/components/console-importer.tsx`**:
   - Botón interactivo `[ 🔍 Sincronizar desde PSN / Xbox ]`.
   - Soporte para tecla Enter en el input.
   - Plegado de opciones manuales bajo `<details>`.

---

## 4. Criterios de Aceptación y Calidad

1. `npm run check` debe finalizar con código de salida `0` (lint, typecheck, 48 tests unitarios y formateo Prettier).
2. Si no se introduce identificador, el cliente emite validación sin llamar a la red.
3. Si el servidor no tiene `PSN_NPSSO`, devuelve error amigable 503 orientando al administrador.
4. Despliegue verificado en producción con Vercel.
