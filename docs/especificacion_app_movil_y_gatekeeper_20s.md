# Especificación Técnica: App Móvil Companion (PWA) & Gatekeeper de Acceso Web (TOTP 20s)

## 1. Visión General
Esta especificación define la arquitectura para dos componentes sinérgicos:
1. **SaveState Mobile Guardian (PWA / App Móvil en Pantalla de Inicio)**:
   - **Acceso Exclusivo de Administrador**: Reservado únicamente para `@ilhamelin_v2` (cuenta Google `benjaigancioreyes56@gmail.com`).
   - **Generador de Claves Dinámicas (TOTP 20s)**: Genera sucesivamente una clave aleatoria cada 20 segundos basada en el estándar criptográfico RFC 6238 (Time-based One-Time Password), con temporizador visual regresivo y soporte offline.
   - **Directorio de Usuarios Registrados**: Interfaz móvil que lista a todos los jugadores registrados en SaveState (avatar, username, nivel, estado de terminal y fecha de registro) con buscador en tiempo real.
2. **Gatekeeper Web Checkpoint (`src/proxy.ts` & `/gatekeeper`)**:
   - Sistema de bloqueo perimetral en la web: Cualquier usuario o visitante que ingrese a SaveState debe autenticarse ingresando la clave activa de 20 segundos generada en la app móvil.
   - Si no cuenta con la clave válida, el acceso a la web y a todas sus funciones queda estrictamente bloqueado.
   - Al validar la clave, se emite una cookie firmada de sesión de acceso (`savestate_gate_pass`) que desbloquea la navegación.

---

## 2. Autenticación y Rol Administrador (`src/lib/session.ts`)

### 2.1 Identidad del Operador Supremo
- **Usuario autorizado**: `@ilhamelin_v2`
- **Email autorizado**: `benjaigancioreyes56@gmail.com`
- **Variables de Entorno**:
  - `ADMIN_USERNAME=ilhamelin_v2`
  - `ADMIN_EMAIL=benjaigancioreyes56@gmail.com`
  - `GATEKEEPER_SECRET=...` (Semilla criptográfica para el generador TOTP)

### 2.2 Helper `currentAdmin()` en `src/lib/session.ts`
```typescript
export const currentAdmin = cache(async () => {
  const profile = await currentViewerProfile();
  if (!profile) return null;
  const adminUsername = (process.env.ADMIN_USERNAME ?? 'ilhamelin_v2').toLowerCase();
  const adminEmail = (process.env.ADMIN_EMAIL ?? 'benjaigancioreyes56@gmail.com').toLowerCase();
  
  if (profile.username.toLowerCase() === adminUsername) {
    return profile;
  }
  
  const db = await serverClient();
  const { data } = await db.auth.getClaims();
  const email = String(data?.claims.email ?? '').toLowerCase();
  if (email && email === adminEmail) {
    return profile;
  }
  
  return null;
});

export async function authenticatedAdmin() {
  const admin = await currentAdmin();
  if (!admin) throw new AppError('Acceso denegado: solo el operador supremo @ilhamelin_v2 puede acceder.', 403);
  return admin;
}
```

---

## 3. Arquitectura Criptográfica: TOTP de 20 Segundos (RFC 6238)

### 3.1 Principio Matemático
A diferencia de un sistema dependiente de peticiones de red cada 20 segundos (que fallaría por latencia o cortes de Wi-Fi), el generador utiliza **HMAC-SHA1/SHA256 con paso de tiempo (time step) de 20 segundos**:

$$\text{Counter} = \left\lfloor \frac{\text{Timestamp actual en ms}}{20000} \right\rfloor$$

$$\text{Hash} = \text{HMAC-SHA1}(\text{Secret}, \text{Counter})$$

$$\text{Código (6 dígitos)} = \text{Truncate}(\text{Hash}) \pmod{10^6}$$

### 3.2 Sincronización y Tolerancia a Desfase
Tanto el servidor web en Next.js como la app móvil comparten el secreto `GATEKEEPER_SECRET`. Al verificar en el servidor:
- Se evalúa el paso actual $C_0 = \lfloor t / 20000 \rfloor$.
- Se permite una ventana de tolerancia de $\pm 1$ paso ($C_{-1}$ y $C_{+1}$) para absorber desfases leves de reloj entre el teléfono y el servidor (un margen seguro de $\pm 20$ segundos).

---

## 4. Arquitectura del Gatekeeper Web (Next.js)

### 4.1 Interceptor Perimetral (`src/proxy.ts`)
El middleware intercepta las solicitudes entrantes:
1. Rutas excluidas de validación:
   - `_next/` (assets estáticos y bundles).
   - `/gatekeeper` (pantalla de introducción de clave).
   - `/api/gatekeeper/verify` (endpoint de validación de clave).
   - `/guardian` (consola protegida por sesión admin).
   - `/api/guardian/` (endpoints protegidos por sesión admin).
   - `/favicon.ico` e iconos estáticos.
2. Si la cookie `savestate_gate_pass` no está presente o su firma HMAC es inválida:
   - Redirige inmediatamente a `/gatekeeper?next=<pathname>`.

### 4.2 Endpoint de Verificación (`POST /api/gatekeeper/verify`)
- Recibe `{ code: string }`.
- Valida el código contra el algoritmo TOTP de 20s.
- Si es válido:
  - Genera un token firmado con HMAC (`crypto.createHmac('sha256', GATEKEEPER_SECRET)`).
  - Establece la cookie HTTP-only, Secure, SameSite=Lax: `savestate_gate_pass`.
  - Retorna `{ success: true, redirect: nextUrl }`.
- Si es inválido: Retorna `401 Unauthorized` con mensaje: *"Clave incorrecta o caducada. Consulta la clave actual en la app móvil."*

---

## 5. Arquitectura de la Consola Móvil PWA (`/guardian`)

### 5.1 Instalación en Móvil
1. Entras desde tu teléfono a `https://savestate-eight.vercel.app/guardian`.
2. Inicias sesión con tu cuenta de Google (`benjaigancioreyes56@gmail.com`).
3. El navegador te ofrece **"Instalar aplicación"** / **"Agregar a pantalla de inicio"**.
4. Se crea el icono nativo de SaveState Guardian en tu celular, el cual abre la app a pantalla completa sin barras de navegador.

### 5.2 Pantallas Principales
1. **Pestaña 1: 🔐 Security Token (20s Authenticator)**
   - Visor digital central con tipografía monoespaciada grande (ej: `482 910`).
   - Barra de progreso que decrece en tiempo real de 20s a 0s.
   - Al llegar a 0s, genera instantáneamente la nueva clave matemática en el teléfono sin llamadas de red.
   - Botón *"Copiar clave"*.
2. **Pestaña 2: 👥 Directorio de Jugadores**
   - Tarjetas de usuario con avatar, `@username`, badge de nivel (ej. `LVL 7`), estado de terminal en vivo y fecha de registro.
   - Buscador en tiempo real para filtrar por nombre de usuario.
   - Contador de jugadores registrados totales.
   - Pull-to-refresh para refrescar la lista.

---

## 6. Matriz de Seguridad y Privacidad

| Aspecto | Implementación |
|---|---|
| Acceso de administración | Restringido exclusivamente a `@ilhamelin_v2` (`benjaigancioreyes56@gmail.com`). |
| Algoritmo de clave | RFC 6238 TOTP (paso de 20 segundos, 6 dígitos). |
| Dependencia de red del Token | **Ninguna**. Funciona 100% offline en el móvil. |
| Cookie de pase web | `savestate_gate_pass` con firma criptográfica HMAC-SHA256, `HttpOnly`, `SameSite=Lax`. |
| Bloqueo perimetral | Redirección estricta en `src/proxy.ts` antes de renderizar páginas o APIs internas. |
