# SPEC-07: Revisión, Validación y Fusión del PR #5 (Modernización del README Principal)

> **Documento:** Especificación Técnica Quirúrgica de Entrega  
> **Rama de Especificación:** `research/antigravity`  
> **Rama Base del PR #5:** `implementation/chatgpt` (Head: `docs/project-readme`)  
> **Rama de Producción:** `main`  
> **Destinatario:** OpenAI Codex / Lead Engineer  
> **Prioridad:** Media-Alta (Presentación del repositorio, documentación canónica y alineación de ramas)

---

## 1. Objetivo y Contexto

El repositorio `ilhamelin/savestate` contaba con un `README.md` desactualizado que describía entregas tempranas del proyecto, indicando erróneamente que características clave como Steam, chat privado o PWA estaban pendientes.

En el **Pull Request #5** (`docs: renovar la presentación de SaveState en GitHub`), se propone una versión moderna y fidedigna del `README.md` que:
1. Presenta la identidad visual y valor de SaveState: *"Cada juego. Cada partida. Tu historia."*, con el icono PWA de alta resolución.
2. Añade badges oficiales de CI (`implementation/chatgpt`), Next.js 16, TypeScript estricto y Supabase.
3. Resume con exactitud los módulos implementados: Biblioteca (6 estados, 1-10 en medios puntos, Steam/PSN/Xbox), Comunidad (perfiles, mensajes privados, foros, momentos, Discord Bridge), y Hubs multimedia (Rift, Worlds, HoYo Hub, Screen, Indie Tracker, Bóveda R2 y Guardian Operator Suite).
4. Actualiza la estructura de directorios (`src/proxy.ts`, `services/`, `repositories/`, `domain/`, etc.).
5. Documenta el flujo de trabajo en la nube sin dependencias locales y la suite determinista de calidad (`npm run check`).
6. Enlaza guías canónicas de arquitectura, decisiones y módulos en `docs/`.

**Meta de Codex:** Auditar formalmente el PR #5, verificar la integridad de todos los enlaces internos y técnicos, ejecutar la fusión (*merge*) limpia hacia `implementation/chatgpt`, y sincronizar los cambios en `main` garantizando 0 roturas en CI.

---

## 2. Lista Exacta de Archivos a Modificar / Verificar

| Acción | Archivo | Responsabilidad |
|---|---|---|
| **Auditar / Fusionar** | `README.md` | Sustituir el README legacy por la versión modernizada del PR #5 (`docs/project-readme`). |
| **Verificar existencia** | `public/icons/icon-512.png` | Confirmar que el recurso visual referenciado en el encabezado existe y renderiza. |
| **Verificar enlaces** | `docs/*.md`, `.codex/CODEX_CLOUD_PLAYBOOK.md`, `.github/workflows/ci.yml` | Validar que cada hipervínculo relativo en el nuevo README apunta a un archivo real. |
| **Sincronizar** | Ramas `implementation/chatgpt` y `main` | Mantener ambas ramas alineadas con la nueva presentación sin conflictos. |

---

## 3. Contratos de Estructura y Reglas del Documento

El contenido propuesto en `README.md` debe respetar las siguientes directrices deterministas:
1. **Veracidad técnica:**
   - Stack: Next.js 16 App Router, React 19, TypeScript 5, Tailwind CSS 4, Supabase (PostgreSQL 16), Cloudflare R2 Vault, Vercel.
   - Node.js runtime: Node.js 24 (`engines` y runners de GitHub Actions).
   - Calidad: suite `npm run check` (ESLint → Next.js route typegen & TypeScript → Unit tests nativos de Node → Prettier).
2. **Límites de Privacidad y Alcance:**
   - Debe advertir explícitamente que los enlaces generados en Cloudflare R2 son públicos y no deben usarse para material confidencial.
   - La biblioteca tiene límite de carga de hasta 500 registros recientes + favoritos.
   - Aclarar que la biblioteca offline (objeto del PR #4) **no se anuncia como integrada** en esta entrega.
3. **Badge de CI:**
   - Debe apuntar al workflow `ci.yml` en la rama de integración correspondiente:
     `[![CI](https://github.com/ilhamelin/savestate/actions/workflows/ci.yml/badge.svg?branch=implementation%2Fchatgpt)](https://github.com/ilhamelin/savestate/actions/workflows/ci.yml)`

---

## 4. Algoritmo y Flujo de Ejecución Paso a Paso

Codex ejecutará la siguiente secuencia ordenada:

### Paso 1: Verificación de Enlaces e Integridad (Pre-Merge Audit)
Validar mediante script o comandos de consola que todos los archivos referenciados en `README.md` existen en el árbol de archivos:
- `public/icons/icon-512.png`
- `.codex/CODEX_CLOUD_PLAYBOOK.md`
- `.github/workflows/ci.yml`
- `.env.example`
- `supabase/migrations`
- Todos los documentos en `docs/`: `configuracion.md`, `arquitectura_savestate.md`, `decisiones_aprobadas.md`, `auditoria_produccion_2026-10-22.md`, `optimizacion_broadcast_y_polling.md`, `steam_sync_implementacion_y_verificacion.md`, `importador_consolas_implementacion.md`, `momentos_gamer.md`, `foros_implementacion_y_verificacion.md`, `widget_amigos_verificacion.md`, `discord_interactions_y_roles.md`, `discord_bridge_canales_reales.md`, `rift_tracker.md`, `valorant_dual_tracker.md`, `trackers_hsr_y_rust.md`, `screen.md`, `indie_tracker.md`, `vault-r2.md`, `guardian_implementacion_y_activacion.md`, `especificacion_guardian_operator_suite.md`.

### Paso 2: Aprobación y Fusión del PR #5 en GitHub
Ejecutar la fusión del Pull Request #5 hacia `implementation/chatgpt`:
- Utilizar `gh pr merge 5 --squash --delete-branch` o la API REST de GitHub:
  `PUT /repos/ilhamelin/savestate/pulls/5/merge` con método `squash` y commit message:
  `docs: renovar la presentación de SaveState en GitHub (#5)`

### Paso 3: Propagación a la Rama `main`
Para que los visitantes de GitHub y el despliegue de Vercel muestren el nuevo README:
1. Traer los cambios actualizados de `README.md` a la rama `main`.
2. Confirmar que no hay discrepancias ni conflictos de merge.
3. Hacer push a `origin/main`.

### Paso 4: Verificación Final de Calidad
Ejecutar la suite local o remota:
```bash
npm run check
```
Asegurar que el formateador Prettier no marque diferencias en `README.md` y que el runner de GitHub Actions finalice con estado `success`.

---

## 5. Criterios de Aceptación Deterministas

1. **Estado del PR #5:** El Pull Request #5 en `https://github.com/ilhamelin/savestate/pull/5` debe figurar como `Merged` y la rama de trabajo `docs/project-readme` eliminada o archivada.
2. **Integridad de Hipervínculos:** 100% de los links relativos en `README.md` deben ser válidos y abrir el archivo correspondiente en GitHub sin arrojar 404.
3. **Badge Funcional:** El badge de GitHub Actions debe renderizarse correctamente y reflejar el estado actual del CI runner.
4. **Validación CI:** `npm run check` pasando con 0 errores (ESLint, `next typegen && tsc --noEmit`, 394 pruebas unitarias pasando, Prettier conforme).
5. **Visibilidad en Producción:** Tanto la vista por defecto del repositorio en GitHub como la rama `main` deben contar con el `README.md` modernizado.
