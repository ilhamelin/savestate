export async function readJsonResponse<T>(response: Response): Promise<T> {
  let result: T & { error?: unknown };
  try {
    result = (await response.json()) as T & { error?: unknown };
  } catch {
    throw new Error(
      response.ok
        ? 'El servidor devolvió una respuesta no válida. Inténtalo de nuevo.'
        : `El servidor no pudo completar la solicitud (${response.status}). Inténtalo de nuevo.`,
    );
  }
  if (!response.ok)
    throw new Error(
      result && typeof result.error === 'string'
        ? result.error
        : 'No se pudo completar la solicitud. Inténtalo de nuevo.',
    );
  return result;
}
