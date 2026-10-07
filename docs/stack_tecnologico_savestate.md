# 04. Stack Tecnológico y Configuración

---

## 1. Tecnologías Seleccionadas por Capa

| Capa | Tecnología | Propósito |
| :--- | :--- | :--- |
| **Framework Web** | Next.js 16 (App Router) | Renderizado SSR para fichas de juegos, SEO optimizado y API routes |
| **Biblioteca de UI** | React 19 + TypeScript 5 | Componentes tipados y renderizado reactivo |
| **Framework de Estilos** | Tailwind CSS v4 | Tokens de diseño personalizados (neón, bordes pixel art, scanlines) |
| **Tipografías** | Silkscreen + JetBrains Mono | Títulos en pixel art retro y cuerpo de texto monoespaciado |
| **Iconos & Efectos** | Lucide React + canvas-confetti | Iconografía HUD retro y celebraciones visuales para completistas |
| **Backend as a Service** | Supabase (PostgreSQL 16) | Autenticación (OAuth & Email), base de datos relacional y WebSockets |
| **API de Videojuegos** | IGDB API v4 (Twitch Developer) | Metadatos globales de videojuegos, carátulas y fechas |
| **Seguridad de Contenido** | isomorphic-dompurify | Sanitización estricta de código en reseñas Markdown |

---

## 2. Variables de Entorno Requeridas (`.env.example`)

```bash
# ==========================================
# SUPABASE CONFIGURATION
# ==========================================
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key-publica
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key-privada

# ==========================================
# TWITCH / IGDB API (Backend Only)
# ==========================================
TWITCH_CLIENT_ID=tu-twitch-client-id
TWITCH_CLIENT_SECRET=tu-twitch-client-secret

# ==========================================
# APP URL
# ==========================================
NEXT_PUBLIC_APP_URL=http://localhost:3000
```
