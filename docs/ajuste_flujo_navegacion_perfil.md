# Ajuste de Flujo de Navegación: Botón «Mi perfil» en Header hacia Perfil Público

**Fecha:** 9 de octubre de 2026  
**Rama de origen:** `research/antigravity`  
**Rama de destino:** `implementation/chatgpt` (Codex)  
**Objetivo:** Alinear el flujo de navegación natural:
1. En la barra superior (`Header`), reemplazar el botón **«Mi cuenta»** por **«Mi perfil»**, redirigiendo a `/players/[username]` del usuario autenticado.
2. Desde la vista de perfil propio, el botón **«Editar perfil»** mantiene su destino a `/settings` (donde se configura la cuenta, avatar, banner, etc.).

---

## 1. Modificación en `src/components/header.tsx`

Actualmente:
```tsx
<Link className="button small" href={user ? '/settings' : '/login'}>
  {user ? 'Mi cuenta' : 'Conectar'}
  <ArrowUpRight size={15} />
</Link>
```

Actualización solicitada:
```tsx
<Link
  className="button small"
  href={user ? (profile?.username ? `/players/${encodeURIComponent(profile.username)}` : '/settings') : '/login'}
>
  {user ? 'Mi perfil' : 'Conectar'}
  <ArrowUpRight size={15} />
</Link>
```

---

## 2. Flujo Resultante

* **Usuario sin sesión:** Botón **«Conectar»** -> `/login`.
* **Usuario con sesión desde cualquier página:** Botón **«Mi perfil»** -> `/players/[tu_usuario]` (visualiza su vitrina, amigos, nivel y favoritos).
* **Desde su perfil propio:** Botón **«Editar perfil»** -> `/settings` (edita avatar, banner, tema, estado y contraseñas).
