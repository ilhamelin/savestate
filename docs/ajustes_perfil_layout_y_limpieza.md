# Ajustes de Diseño: Hardware y Amigos en Paralelo + Retiro de BacklogPicker

**Fecha:** 9 de octubre de 2026  
**Rama de origen:** `research/antigravity`  
**Rama de destino:** `implementation/chatgpt` (Codex)  
**Solicitud del usuario:**
1. Colocar **HARDWARE INVENTORY** y el widget de **Amigos** uno al lado del otro en el perfil de jugador.
2. Eliminar la función **«¿Qué juego hoy?»** (BacklogPicker) de la biblioteca.

---

## 1. Módulo 1: Layout en Paralelo para Hardware e Inventario de Amigos

### 1.1. Modificación en `src/app/players/[username]/page.tsx`
Agrupar `<HardwareBadges />` y `<PlayerFriendsWidget />` dentro de un contenedor en cuadrícula (`profile-dual-grid`):

```tsx
<div className="profile-dual-grid" id="player-friends">
  <HardwareBadges platforms={hardware} />
  <PlayerFriendsWidget
    key={profile.id}
    friends={friendships.friends}
    available={friendships.available}
    receivedRequests={requests.received}
    sentRequests={requests.sent}
    isOwner={isOwner}
  />
</div>
```

### 1.2. Estilos en `src/app/globals.css`
Añadir soporte de 2 columnas para pantallas medianas/grandes y columna única en móvil:

```css
.profile-dual-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1.5rem;
  align-items: stretch;
  margin-block: 1rem;
}

@media (max-width: 900px) {
  .profile-dual-grid {
    grid-template-columns: 1fr;
  }
}
```

---

## 2. Módulo 2: Retiro de «¿Qué juego hoy?» (`BacklogPicker`)

### 2.1. Modificación en `src/components/library.tsx`
1. Remover la importación de `BacklogPicker`:
   ```tsx
   // Eliminar: import { BacklogPicker } from '@/components/backlog-picker';
   ```
2. Remover el renderizado del componente:
   ```tsx
   // Eliminar: {editable ? <BacklogPicker entries={entries} games={games} logs={logs} /> : null}
   ```
3. El archivo `src/components/backlog-picker.tsx` puede eliminarse o dejarse sin invocar.
