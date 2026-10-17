import { NextResponse } from 'next/server';
import { body, sameOrigin, errorResponse, AppError } from '@/lib/http';
import { safeNext } from '@/domain/validation';
import { GATE_COOKIE, GATE_PASS_SECONDS, createGatePass, validGateCode } from '@/domain/gatekeeper';
import {
  claimGatekeeperAttempt,
  configuredGateSecret,
  auditGatekeeperFailure,
} from '@/services/gatekeeper';
import { currentUser } from '@/lib/session';
import { serverClient } from '@/integrations/supabase/server';
import { acknowledgePlayerGate } from '@/services/player-moderation';
import { dbCheck } from '@/lib/http';
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const input = await body(request, 2048);
    if (!input || typeof input !== 'object' || !('code' in input) || typeof input.code !== 'string')
      throw new AppError('Ingresa una clave de seis dígitos.', 400);
    const secret = configuredGateSecret();
    await claimGatekeeperAttempt(request, secret);
    if (!(await validGateCode(secret, input.code))) {
      await auditGatekeeperFailure(request, secret);
      throw new AppError(
        'Clave incorrecta o caducada. Consulta la clave actual en la app móvil.',
        401,
      );
    }
    const next = safeNext('next' in input && typeof input.next === 'string' ? input.next : '/');
    const user = await currentUser();
    const issuedAt = Date.now();
    if (user) {
      const db = await serverClient();
      const state = await db
        .from('profiles')
        .select('access_locked,access_locked_at')
        .eq('id', user.id)
        .maybeSingle();
      dbCheck(state.error);
      if (state.data?.access_locked_at) {
        if (Date.parse(state.data.access_locked_at) > issuedAt)
          throw new AppError('Actualiza la hora e inténtalo de nuevo.', 409);
        await acknowledgePlayerGate(user.id, state.data.access_locked_at);
      }
    }
    const response = NextResponse.json(
      { success: true, redirect: next },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
    response.cookies.set(GATE_COOKIE, await createGatePass(secret, issuedAt, user?.id), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: GATE_PASS_SECONDS,
    });
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
