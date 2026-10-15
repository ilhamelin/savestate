# Diagnóstico y Especificación: Rework UX/UI de "Mis Consolas" y "Amigos" en Mi Perfil

## 1. Problemas Detectados en la Captura del Usuario (`media_1792036073643_43ff6e99.png`)

### Descuadre 1: La fila de cada amigo está rota verticalmente
- **Causa en el código:** En `src/components/player-friends-widget.tsx`:
  ```tsx
  <li key={friend.id}>
    <FriendIdentity profile={friend} isOnline={onlineUsers.has(friend.id)} />
    {isOwner && currentUserId && (
      <button type="button" className="button outline small friend-chat-btn" onClick={...}>
        💬 Chat
      </button>
    )}
  </li>
  ```
  El elemento `<li>` no tiene `display: flex; align-items: center; justify-content: space-between;`.
  Como `<FriendIdentity>` es un bloque de ancho 100%, el botón `💬 Chat` cae a una segunda línea debajo del avatar y del estado `● Inactivo`.
- **Efecto visual:** El botón de chat queda desfasado hacia la izquierda abajo, y el círculo de nivel `(1)`, `(2)`, `(3)` queda flotando solo en la esquina superior derecha, generando una fila desarticulada y con saltos de línea antiestéticos.

### Descuadre 2: Disparidad de diseño entre las dos tarjetas (`profile-dual-grid`)
- En `src/components/profile-dossier.tsx`:
  `<section className="panel hardware-showcase">` (tiene clase `panel`, esquinas cyberpunk `::before`/`::after` y padding de 26px).
- En `src/components/player-friends-widget.tsx`:
  `<section className="player-friends-widget">` (NO tiene clase `panel`, carece de las esquinas cyberpunk y tiene padding de 16px).
- **Efecto visual:** Ambas tarjetas conviven lado a lado en un grid, pero parecen de dos aplicaciones distintas.

### Descuadre 3: Vacío gigante en "Mis consolas y hardware"
- `.profile-dual-grid` tiene `align-items: stretch;`.
- Como el panel derecho de amigos tiene 3 elementos más pestañas, su altura crece a ~360px.
- La tarjeta de hardware izquierda se estira a la misma altura, pero solo contiene un único chip (`PC / Steam`), dejando un 85% de espacio en negro completamente muerto sin ninguna acción ni contexto.

### Descuadre 4: Pestañas de amigos toscas y sin jerarquía
- Las pestañas `[Amigos (3)] [Solicitudes recibidas (0)] [Solicitudes enviadas (0)]` se ven como botones rectangulares sin pulir. La activa tiene un borde naranja tosco mientras las demás están apagadas con bordes grises desalineados.

---

## 2. Solución Propuesta (Rework UX/UI + Halloween Atmosphere)

```
┌───────────────────────────────────────────────┐ ┌───────────────────────────────────────────────┐
│ ⌜ HARDWARE INVENTORY                          │ │ ⌜ SOCIAL NETWORK // ALLIES                    │
│   Mis consolas y hardware     [1 sistema]     │ │   Amigos · 🎃 3                   [+ Buscar]  │
├───────────────────────────────────────────────┤ ├───────────────────────────────────────────────┤
│                                               │ │  [ Amigos (3) ] [ Recibidas (0) ] [ Enviadas ]│
│  ┌─────────────────────────────────────────┐  │ ├───────────────────────────────────────────────┤
│  │ 💻 PC / Steam              ● Activo      │  │ │ 👤 @El_Masturba_Abuelas_3000   [💬 Chat] (2) │
│  │ Estación principal de juego sincronizada │  │ │    ● Inactivo                                │
│  └─────────────────────────────────────────┘  │ ├───────────────────────────────────────────────┤
│                                               │ │ 👤 @The_Cheemz                  [💬 Chat] (3) │
│  ┌─ (Si es su perfil) ─────────────────────┐  │ │    ● Inactivo                                │
│  │ ➕ Vincular otra consola (PS5, Switch..) │  │ ├───────────────────────────────────────────────┤
│  │ Configura tus plataformas en Ajustes ↗  │  │ │ 👤 @player_5b990b68e36b...      [💬 Chat] (1) │
│  └─────────────────────────────────────────┘  │ │    ● Inactivo                                │
│                                             ⌟ │ │                                             ⌟ │
└───────────────────────────────────────────────┘ └───────────────────────────────────────────────┘
```

### Mejoras Específicas:
1. **Alineación horizontal perfecta en la lista de amigos:**
   - La estructura de cada `li` pasa a ser:
     - **Izquierda:** Avatar + Nombre + Estado en línea.
     - **Derecha:** Botón `[💬 Chat]` + Insignia de Nivel `(2)` alineados horizontalmente en un contenedor `.friend-actions`.
2. **Equilibrio visual de tarjetas (`panel` compartido):**
   - Se agrega la clase `panel` a `PlayerFriendsWidget`, unificando padding (24px), bordes y esquinas brackets (`::before`/`::after`).
3. **Relleno inteligente y tarjetas de hardware:**
   - Las consolas declaradas se presentan como tarjetas de hardware enriquecidas (con icono, nombre y estado activo).
   - Si el usuario es el dueño de la cuenta, se añade un slot interactivo punteado: `[+ Conectar PlayStation, Xbox o Nintendo Switch en Ajustes →]`, eliminando el vacío y convirtiéndolo en un flujo de valor real.
4. **Pestañas estilo Píldora Cyberpunk:**
   - Botones con `border-radius: 6px`, fondo ahumado y contador estilizado en badge.
5. **Acentos estéticos de Halloween:**
   - Bordes neón con degradado sutil naranja-púrpura.
   - Mini icono de calabaza o murciélago en el título de amigos.
