import { ValidationError } from '@/domain/validation';
export class AppError extends Error {
  constructor(
    message: string,
    public status = 500,
  ) {
    super(message);
  }
}
export function dbCheck(error: { code?: string; message: string } | null) {
  if (!error) return;
  if (error.code === '23505') throw new AppError('Este registro ya existe.', 409);
  if (error.code === '42501') throw new AppError('No tienes acceso a este recurso.', 403);
  if (error.code?.startsWith('23') || error.code === 'P0001')
    throw new AppError('Los datos no cumplen las reglas del registro.', 400);
  console.error('Database operation failed', { code: error.code });
  throw new AppError('No se pudo completar la operación. Inténtalo de nuevo.', 503);
}
export function errorResponse(error: unknown) {
  const status =
    error instanceof ValidationError ? 400 : error instanceof AppError ? error.status : 500;
  if (status === 500)
    console.error('Unhandled request failure', error instanceof Error ? error.name : 'unknown');
  return Response.json(
    { error: status === 500 ? 'Error interno. Inténtalo de nuevo.' : (error as Error).message },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}
export async function body(request: Request) {
  if (!request.headers.get('content-type')?.includes('application/json'))
    throw new AppError('Usa contenido JSON.', 415);
  if (Number(request.headers.get('content-length')) > 24000)
    throw new AppError('Solicitud demasiado grande.', 413);
  const reader = request.body?.getReader();
  const decoder = new TextDecoder();
  let raw = '',
    bytes = 0;
  if (reader) {
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        bytes += value.length;
        if (bytes > 24000) {
          await reader.cancel();
          throw new AppError('Solicitud demasiado grande.', 413);
        }
        raw += decoder.decode(value, { stream: true });
      }
      raw += decoder.decode();
    } finally {
      reader.releaseLock();
    }
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new AppError('JSON inválido.', 400);
  }
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host') ?? new URL(request.url).host;
  const protocol = new URL(process.env.NEXT_PUBLIC_APP_URL || request.url).protocol;
  let allowed = false;
  try {
    const parsed = new URL(origin ?? '');
    allowed = parsed.origin === origin && parsed.host === host && parsed.protocol === protocol;
  } catch {
    /* Missing, null or malformed origins fail closed. */
  }
  if (!allowed) throw new AppError('Origen de solicitud no permitido.', 403);
}
export async function mutation(request: Request, action: (input: unknown) => Promise<unknown>) {
  try {
    sameOrigin(request);
    return Response.json(
      { data: await action(await body(request)) },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
