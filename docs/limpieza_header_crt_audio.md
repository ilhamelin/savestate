# Limpieza de Header: Retiro de Conmutadores CRT y Audio

**Fecha:** 9 de octubre de 2026  
**Rama de origen:** `research/antigravity`  
**Rama de destino:** `implementation/chatgpt` (Codex)  
**Objetivo:** Retirar los botones de **CRT** y **AUDIO** de la barra superior (`Header`) para simplificar y limpiar el diseño visual.

---

## 1. Modificación en `src/components/header.tsx`

1. Remover las importaciones de `CrtToggle` y `AudioToggle`:
   ```tsx
   // Eliminar:
   // import { CrtToggle } from '@/components/ui/crt-toggle';
   // import { AudioToggle } from '@/components/ui/audio-toggle';
   ```
2. Remover los componentes del contenedor `.header-actions`:
   ```tsx
   <div className="header-actions">
     <CommandMenu authenticated={Boolean(user)} username={profile?.username ?? null} />
     {user ? <NotificationBell key={user.id} userId={user.id} /> : null}
     {/* Eliminar: <CrtToggle /> */}
     {/* Eliminar: <AudioToggle /> */}
     <Link
       className="button small"
       href={user ? (profile?.username ? `/players/${encodeURIComponent(profile.username)}` : '/settings') : '/login'}
     >
       {user ? 'Mi perfil' : 'Conectar'}
       <ArrowUpRight size={15} />
     </Link>
   </div>
   ```

> [!NOTE]
> Las funciones de conmutar monitor CRT y silenciar audio siguen disponibles a través de la paleta de comandos (`Ctrl + K`) bajo el menú "Sistema", por lo que no se pierde la funcionalidad para quien desee usarla.
