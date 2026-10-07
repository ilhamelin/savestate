# 03. Arquitectura del Sistema y Modelo de Datos

---

## 1. Visión General del Patrón Arquitectónico

**SaveState** implementa una arquitectura **Fullstack Serverless / Híbrida** basada en Next.js (App Router) con renderizado en el servidor (SSR / Server Components) y un Backend as a Service gestionado con **Supabase (PostgreSQL 16)**.

```mermaid
flowchart TD
    subgraph Cliente["Cliente (Navegador)"]
        UI["Interfaz Web (Pixel Art & Cyberpunk UI)"]
        State["Estado Local & Caché"]
    end

    subgraph Edge["Capa de Red & Backend (Next.js)"]
        SSR["Server Components & Rutas API"]
        Proxy["Proxy Seguro para IGDB API"]
    end

    subgraph BaaS["Servicios & Persistencia (Supabase)"]
        Auth["Supabase Auth (OAuth & Email)"]
        DB[(PostgreSQL 16 Relacional)]
        Storage["Storage Buckets (Avatares/Banners)"]
        Realtime["Motor Realtime (WebSockets)"]
    end

    subgraph Externo["APIs Externas"]
        IGDB["Twitch / IGDB API v4"]
    end

    UI --> Edge
    SSR --> BaaS
    Proxy --> IGDB
    UI -.-> Realtime
```

---

## 2. Modelo Entidad-Relación (ERD)

```mermaid
erDiagram
    USERS ||--o{ USER_GAMES : "registra en biblioteca"
    USERS ||--o{ REVIEWS : "redacta"
    USERS ||--o{ USER_LISTS : "crea"
    USERS ||--o{ FRIENDSHIPS : "conecta con"
    USERS ||--o{ ACTIVITY_LOGS : "genera"
    
    GAMES ||--o{ USER_GAMES : "es catalogado en"
    GAMES ||--o{ REVIEWS : "recibe"
    GAMES ||--o{ LIST_ITEMS : "incluido en"
    
    REVIEWS ||--o{ REVIEW_REACTIONS : "recibe reacciones"
    USER_LISTS ||--o{ LIST_ITEMS : "contiene"

    USERS {
        uuid id PK
        string username UK
        string email UK
        string avatar_url
        string banner_url
        string theme_color
        string terminal_status
        jsonb social_links
        boolean is_private
        timestamp created_at
    }

    GAMES {
        uuid id PK
        bigint igdb_id UK
        string title
        string slug UK
        string cover_url
        int release_year
        text[] platforms
        text[] genres
        text developer
        text synopsis
        timestamp cached_at
    }

    USER_GAMES {
        uuid id PK
        uuid user_id FK
        uuid game_id FK
        string status
        string platform_played
        decimal rating
        int hours_played
        date start_date
        date finish_date
        boolean is_favorite
        timestamp updated_at
    }

    REVIEWS {
        uuid id PK
        uuid user_id FK
        uuid game_id FK
        decimal rating
        text content
        boolean has_spoilers
        timestamp created_at
        timestamp updated_at
    }

    REVIEW_REACTIONS {
        uuid id PK
        uuid review_id FK
        uuid user_id FK
        string reaction_type
    }

    USER_LISTS {
        uuid id PK
        uuid user_id FK
        string title
        text description
        boolean is_private
        timestamp created_at
    }

    LIST_ITEMS {
        uuid id PK
        uuid list_id FK
        uuid game_id FK
        int position_index
        text note
    }

    FRIENDSHIPS {
        uuid id PK
        uuid sender_id FK
        uuid receiver_id FK
        string status
        timestamp created_at
    }

    ACTIVITY_LOGS {
        uuid id PK
        uuid user_id FK
        string event_type
        uuid target_game_id FK
        jsonb event_data
        timestamp created_at
    }
```

---

## 3. Seguridad y Políticas RLS (Row Level Security)

* **Políticas de Lectura Pública:** Fichas de juegos, listas marcadas como públicas y perfiles sin restricción son legibles por cualquier usuario (incluso visitantes anónimos).
* **Políticas de Escritura:** Exclusivas para usuarios autenticados donde `auth.uid() = user_id`.
* **Privacidad de Perfil:** Si un perfil está marcado como privado, únicamente los usuarios con un registro aceptado en `FRIENDSHIPS` tienen acceso a su biblioteca y reseñas.
* **Sanitización de Markdown:** Todo texto pasa por `isomorphic-dompurify` antes del guardado y del renderizado para evitar ataques XSS.
