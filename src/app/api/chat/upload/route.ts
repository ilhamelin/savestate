import { authenticated } from '@/lib/session';
import { body, sameOrigin, AppError, errorResponse } from '@/lib/http';
import { object } from '@/domain/validation';
import { CHAT_MEDIA_LIMIT } from '@/domain/global-chat';
import { prepareChatMedia, uploadChatMedia } from '@/services/global-chat';
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const { user } = await authenticated();
    if (request.headers.get('content-type')?.includes('application/json')) {
      const input = object(await body(request, 4096));
      if (typeof input.size !== 'number' || typeof input.contentType !== 'string')
        throw new AppError('Archivo inválido.', 400);
      return Response.json(await prepareChatMedia(input.size, input.contentType), {
        headers: { 'Cache-Control': 'no-store' },
      });
    }
    if (!request.headers.get('content-type')?.includes('multipart/form-data'))
      throw new AppError('Usa FormData con un archivo.', 415);
    const reader = request.body?.getReader();
    const parts: Uint8Array<ArrayBuffer>[] = [];
    let size = 0;
    if (reader)
      try {
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          size += part.value.length;
          if (size > CHAT_MEDIA_LIMIT + 65536) {
            await reader.cancel();
            throw new AppError('Máximo 5 MB.', 413);
          }
          parts.push(new Uint8Array(part.value));
        }
      } finally {
        reader.releaseLock();
      }
    const form = await new Response(new Blob(parts), {
      headers: { 'Content-Type': request.headers.get('content-type')! },
    }).formData();
    const file = form.get('file');
    if (!(file instanceof File)) throw new AppError('Selecciona una imagen o GIF.', 400);
    return Response.json(await uploadChatMedia(file, user.id), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
