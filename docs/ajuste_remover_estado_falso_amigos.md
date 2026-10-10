# Especificación Técnica: Eliminación de Estado/Juego en Widget de Amigos

**Fecha:** 10 de octubre de 2026  
**Rama de origen:** `research/antigravity`  
**Rama de destino:** `implementation/chatgpt` (Codex)  
**Objetivo:** Eliminar el subtítulo de estado («Jugando [juego]» o «Ready to play») que se muestra debajo del nombre de usuario en el widget de Amigos (`PlayerFriendsWidget`), ya que no representa telemetría en tiempo real del usuario y genera información inexacta o simulada.

---

## 1. Diagnóstico

En `src/components/player-friends-widget.tsx`:
* El subcomponente `FriendIdentity` renderizaba:
  ```tsx
  <span className={currentGame ? 'friend-playing' : 'muted'}>
    {currentGame ? `Jugando ${currentGame}` : profile.terminal_status || 'Ready to play'}
  </span>
  ```
* `currentGame` se extraía de la tabla `user_games` donde `status = 'playing'`, y de respaldo se mostraba `terminal_status` o `"Ready to play"`.
* Al tratarse de una plataforma web sin cliente de escritorio que detecte procesos de juego activos en segundo plano, este texto transmite una falsa sensación de actividad en tiempo real ("Jugando Titanfall 2") cuando en realidad es simplemente un registro estático de biblioteca.

---

## 2. Modificaciones Requeridas

### 2.1. Simplificar `FriendIdentity` en `src/components/player-friends-widget.tsx`

1. Retirar la prop `currentGame` y la línea de texto secundaria.
2. Mantener únicamente:
   - Avatar cuadrado (36x36px).
   - Nombre de usuario: `<strong>@{profile.username}</strong>`.
   - Medalla circular de nivel con su color por tier (`friend-level-circle`).

```tsx
function FriendIdentity({
  profile,
}: {
  profile: FriendProfile;
}) {
  return (
    <Link className="friend-identity" href={`/players/${profile.username}`}>
      <span className="friend-avatar">
        {profile.avatar_url ? (
          <Image src={profile.avatar_url} alt="" width={36} height={36} unoptimized />
        ) : (
          <span aria-hidden="true">▣</span>
        )}
      </span>
      <span className="friend-copy">
        <strong>@{profile.username}</strong>
      </span>
      <span
        className={`friend-level-circle friend-level-${friendLevelTier(profile.level)}`}
        aria-label={`Nivel ${profile.level}`}
      >
        {profile.level}
      </span>
    </Link>
  );
}
```

3. En el renderizado de la lista de amigos:
```tsx
// Reemplazar:
<FriendIdentity profile={friend} currentGame={friend.current_game} />

// Por:
<FriendIdentity profile={friend} />
```

---

## 3. Verificación

1. Revisar en `/players/[username]` que cada fila de amigo muestre de manera limpia y centrada:
   - Avatar a la izquierda.
   - `@username` en el centro.
   - Medalla de nivel a la derecha.
2. No debe figurar ningún texto de "Jugando..." ni "Ready to play".
3. Ejecutar `npm run check` para confirmar 0 errores de tipado o linter.
