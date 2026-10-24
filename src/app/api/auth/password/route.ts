import { sameOrigin, body, errorResponse, AppError } from '@/lib/http';
import { object, text } from '@/domain/validation';
import { serverClient } from '@/integrations/supabase/server';
import { isGuardianAdmin } from '@/domain/admin-access';
import { trustedThreatIp, threatQuarantineResponse, refreshThreatShieldSnapshot, registerFailedAuthAttempt, claimSocAuthSlot } from '@/services/threat-shield-service';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const ip = trustedThreatIp(request);
    const early = threatQuarantineResponse(ip);
    if (early) return early;
    const policy = await refreshThreatShieldSnapshot();
    const blocked = threatQuarantineResponse(ip);
    if (blocked) return blocked;
    if (process.env.VERCEL && !ip) throw new AppError('No se pudo identificar el origen de autenticación.', 503);
    const input = object(await body(request, 4096));
    const email = text(input.email, 'Correo', 254);
    const password = input.password;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof password !== 'string' || password.length < 1 || password.length > 128) throw new AppError('Credenciales no válidas.', 400);
    await claimSocAuthSlot(policy.level, ip);
    const db = await serverClient();
    const { data, error } = await db.auth.signInWithPassword({ email, password });
    if (error && error.code !== 'invalid_credentials') throw new AppError(error.status === 429 ? 'Demasiados intentos. Espera antes de reintentar.' : 'El proveedor de autenticación no está disponible.', error.status === 429 ? 429 : 503);
    if (!error && !data.user) throw new AppError('Respuesta de autenticación no válida.', 503);
    if (error || !data.user) {
      if (ip && (await registerFailedAuthAttempt(ip, 'Credenciales de acceso incorrectas')).quarantined) return threatQuarantineResponse(ip)!;
      throw new AppError('Correo o contraseña incorrectos.', 401);
    }
    const user = data.user;
    if (policy.level === 1 && !isGuardianAdmin({ id: user.id, email: user.email, emailConfirmed: Boolean(user.email_confirmed_at) }, { userId: process.env.ADMIN_USER_ID, email: process.env.ADMIN_EMAIL })) {
      await db.auth.signOut();
      throw new AppError('Lockdown: acceso exclusivo al operador.', 403);
    }
    return Response.json({ success: true }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return errorResponse(error); }
}
