<img src="public/icons/icon-512.png" alt="SaveState" width="88" />

# SaveState

**Cada juego. Cada partida. Tu historia.**

Tu diario de a bordo gamer: organiza tu biblioteca, registra tu progreso y comparte tus mejores momentos. SaveState reúne catálogo, comunidad y trackers en una experiencia web con estética cyber-retro, perfiles personalizables y formato PWA.

[![CI](https://github.com/ilhamelin/savestate/actions/workflows/ci.yml/badge.svg?branch=implementation%2Fchatgpt)](https://github.com/ilhamelin/savestate/actions/workflows/ci.yml)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-estricto-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)

[**Abrir SaveState ↗**](https://savestate-eight.vercel.app) · [Documentación](#documentación) · [Contribuir](#desarrollo-en-la-nube) · [Verificaciones](#calidad-y-verificación)

> El acceso al despliegue puede estar limitado por Guardian. Algunas funciones requieren sesión, credenciales de proveedores o un escaparate público en el servicio de origen.

## Un lugar para tu recorrido gamer

### 🎮 Tu biblioteca, a tu manera

- Organiza juegos en seis estados: **Playing, Backlog, Cleared, 100% Platinum, Dropped y Wishlist**.
- Registra sesiones, horas, plataformas y progreso; consulta tu colección con filtros y vistas de tarjetas o tabla.
- Puntúa de 1 a 10 en medios puntos, escribe reseñas con Markdown y protege spoilers.
- Importa y sincroniza datos de Steam, con herramientas de importación para PlayStation y Xbox.
- Destaca tu Top 4 y descubre tu resumen SaveState Wrapped.

### 👾 Comunidad con identidad propia

- Personaliza tu perfil con avatar, banner, fondos, hardware, títulos y marcos desbloqueables.
- Sigue jugadores, gestiona amistades y conversa mediante mensajes privados.
- Comparte Momentos con comentarios y reacciones; sigue la actividad en Transmisión.
- Crea listas de juegos, participa en los foros y busca compañeros de partida.
- Usa el Chat Global conectado a Discord, con imágenes, GIFs y frecuencias autorizadas del servidor.

### 📡 Más allá del catálogo

- **Rift:** trackers de League of Legends, Valorant, Genshin Impact, Honkai: Star Rail y Rust, con las estadísticas que cada proveedor permite consultar.
- **Worlds:** calendario, señales oficiales, repeticiones, telemetría de partidas y reproductor musical.
- **HoYo Hub:** directos, códigos y noticias de Genshin Impact y Honkai: Star Rail.
- **Screen:** bitácora de cine, series y adaptaciones gamer, con tráileres, progreso por episodios y disponibilidad regional.
- **Indie Tracker:** seguimiento de juegos de itch.io y avisos de nuevas versiones.
- **Portada:** noticias RSS, radar de juegos gratis y cuentas regresivas.
- **Bóveda / Memory Card:** galería personal de capturas y clips en Cloudflare R2, accesible desde el perfil.
- **Guardian:** consola de operador para moderación, alertas, controles de acceso y salud del sistema.

La PWA permite instalar SaveState en dispositivos compatibles. Las integraciones muestran sus estados de configuración, error o datos parciales; su disponibilidad depende del proveedor y de los permisos de la cuenta.

## Stack y arquitectura

**Next.js 16 · React 19 · TypeScript 5 · Tailwind CSS 4 · Supabase · Cloudflare R2 · Vercel**

- **Web:** App Router, Server Components y streaming con Suspense.
- **Datos e identidad:** PostgreSQL, Supabase Auth, políticas RLS y Realtime.
- **Archivos:** Supabase Storage y subidas directas a R2 mediante URLs firmadas.
- **Integraciones:** IGDB/Twitch, Steam, Riot Games, HenrikDev, Discord, Enka.Network, TMDB y fuentes de noticias/ofertas.
- **Interfaz:** Silkscreen, JetBrains Mono, Lucide, temas estacionales y preferencias de movimiento reducido.

Las reglas de negocio viven en el dominio; las consultas y los proveedores se mantienen separados de la interfaz.

```text
src/
  app/                 Páginas, endpoints y callbacks
  components/          Interfaz y controles interactivos
  domain/              Modelos, validaciones y reglas de negocio
  services/            Casos de uso y coordinación de proveedores
  repositories/        Consultas de persistencia
  integrations/        Clientes y adaptadores externos
  lib/                 Sesiones, configuración y utilidades
  proxy.ts             Proxy de Next.js 16 y políticas de seguridad
supabase/migrations/   Esquema, funciones, índices y políticas RLS
tests/unit/            Pruebas unitarias
tests/integration/     Pruebas HTTP, SQL y servicios configurados
public/                Iconos, fondos y recursos de la PWA
docs/                  Guías de módulos, decisiones y verificaciones
```

## Desarrollo en la nube

SaveState se mantiene mediante **GitHub + GitHub Actions + Vercel**. No necesitas conservar una copia del proyecto en tu PC para contribuir desde un entorno remoto.

- **Desarrollo e integración:** [`implementation/chatgpt`](https://github.com/ilhamelin/savestate/tree/implementation/chatgpt).
- **Especificaciones y propuestas:** [`research/antigravity`](https://github.com/ilhamelin/savestate/tree/research/antigravity/docs).
- **Contrato de trabajo:** [playbook de operación en la nube](.codex/CODEX_CLOUD_PLAYBOOK.md).

### Flujo de contribución

1. Crea una rama `feature/<nombre>`, `fix/<nombre>` o `docs/<nombre>` desde `implementation/chatgpt`.
2. Implementa un cambio acotado y actualiza sus pruebas o documentación.
3. Abre un Pull Request hacia `implementation/chatgpt` explicando el problema, el resultado y cómo se verificó.
4. Espera los checks del **último commit** y el build/preview de Vercel antes de fusionar.
5. Tras integrar, comprueba el despliegue asociado al commit en la rama de producción configurada en Vercel.

El [workflow de CI](.github/workflows/ci.yml) se ejecuta en PRs hacia `implementation/chatgpt` o `main`, y en pushes a esas ramas. Los previews de PR son distintos del despliegue de producción.

Las variables de Vercel **no se transfieren automáticamente a GitHub Actions**. Configura cada entorno por separado y nunca incluyas secretos en commits, issues o logs.

### Preparar un entorno aislado

Requiere **Node.js 24 o superior** y npm. Estos pasos también sirven en un contenedor o espacio de desarrollo remoto:

```bash
npm ci
cp .env.example .env.local
```

Completa las variables necesarias para el módulo que vas a trabajar y prepara su esquema de Supabase antes de probar guardados. Consulta la [guía inicial](docs/configuracion.md), las [migraciones versionadas](supabase/migrations) y la guía específica del módulo; no reapliques migraciones indiscriminadamente sobre producción.

```bash
npm run dev
```

Abre la URL que exponga el entorno de desarrollo; por defecto, `http://localhost:3000`. Sin las credenciales necesarias, algunas vistas muestran configuración pendiente o un modo demo identificado, como Screen.

## Calidad y verificación

```bash
npm run check
```

La suite ejecuta **ESLint → generación de tipos de rutas y TypeScript → pruebas unitarias con el runner nativo de Node → Prettier**.

Comandos disponibles:

- `npm run dev`: servidor de desarrollo.
- `npm run build`: compilación de producción.
- `npm run start`: servidor del build de producción.
- `npm run lint`: reglas de código, React Hooks y accesibilidad.
- `npm run typecheck`: `next typegen && tsc --noEmit`.
- `npm test`: pruebas unitarias.
- `npm run test:integration`: pruebas que requieren un entorno preparado; algunas se omiten si falta su configuración.
- `npm run format` / `npm run format:check`: aplicar o verificar formato.

Un build correcto no certifica OAuth, RLS, Storage, Realtime ni las APIs de terceros. Esos flujos requieren sus verificaciones de integración en un entorno aislado.

## Seguridad, privacidad y límites

- Las políticas RLS y la autorización del servidor controlan el acceso a los datos personales y los canales privados.
- Las claves de servicio y de proveedores se utilizan en el servidor. `.env.local` permanece fuera de Git; toma [`.env.example`](.env.example) como referencia.
- Las mutaciones protegidas validan sesión y origen. Las respuestas personales no deben almacenarse en cachés compartidas.
- El Markdown se sanitiza y el proxy aplica CSP con nonce por solicitud.
- **Los enlaces de archivos de R2 son públicos:** la galería tiene acceso por propietario, pero compartir una URL no transmite sus permisos. No subas material confidencial.
- Las consultas tienen límites explícitos. La biblioteca carga hasta 500 registros recientes más sus favoritos; no debe confundirse esa selección con un análisis ilimitado del historial.
- Los rangos, horarios, ofertas, códigos y disponibilidad de streaming dependen de fuentes externas y pueden cambiar.

Consulta también los [términos de uso](https://savestate-eight.vercel.app/terms) y la [política de privacidad](https://savestate-eight.vercel.app/privacy).

## Documentación

### Para empezar

- [Configuración del entorno](docs/configuracion.md)
- [Arquitectura](docs/arquitectura_savestate.md)
- [Decisiones aprobadas](docs/decisiones_aprobadas.md)
- [Auditoría de producción](docs/auditoria_produccion_2026-10-22.md)
- [Streaming y optimización del polling](docs/optimizacion_broadcast_y_polling.md)

### Guías por módulo

- [Steam Sync](docs/steam_sync_implementacion_y_verificacion.md) · [Importación de consolas](docs/importador_consolas_implementacion.md)
- [Momentos](docs/momentos_gamer.md) · [Foros](docs/foros_implementacion_y_verificacion.md) · [Amigos](docs/widget_amigos_verificacion.md)
- [Discord: comandos y roles vinculados](docs/discord_interactions_y_roles.md) · [Canales reales del Bridge](docs/discord_bridge_canales_reales.md)
- [Rift Tracker](docs/rift_tracker.md) · [Valorant](docs/valorant_dual_tracker.md) · [Star Rail y Rust](docs/trackers_hsr_y_rust.md)
- [Screen](docs/screen.md) · [Indie Tracker](docs/indie_tracker.md) · [Bóveda R2](docs/vault-r2.md)
- [Guardian](docs/guardian_implementacion_y_activacion.md) · [Operator Suite](docs/especificacion_guardian_operator_suite.md)

Las guías reflejan distintas etapas del proyecto. Para implementar un cambio, contrástalas con el código y las migraciones actuales. Las propuestas de `research/antigravity` no implican que todas sus funciones estén publicadas.

---

SaveState es un proyecto independiente. Las marcas, imágenes y demás materiales de terceros pertenecen a sus respectivos titulares.
