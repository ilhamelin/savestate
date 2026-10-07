export interface ReviewDraft {
  version: 1;
  content: string;
  rating: string;
  spoilers: '' | 'yes' | 'no';
  revision: string | null;
}
export function parseReviewDraft(raw: string | null): ReviewDraft | null {
  if (!raw || raw.length > 60000) return null;
  try {
    const data = JSON.parse(raw);
    if (
      !data ||
      data.version !== 1 ||
      typeof data.content !== 'string' ||
      data.content.length > 10000 ||
      typeof data.rating !== 'string' ||
      !['', 'yes', 'no'].includes(data.spoilers) ||
      (data.revision !== null && typeof data.revision !== 'string')
    )
      return null;
    if (data.rating !== '' && !/^(?:[1-9](?:\.5)?|10)$/.test(data.rating)) return null;
    return {
      version: 1,
      content: data.content,
      rating: data.rating,
      spoilers: data.spoilers,
      revision: data.revision,
    };
  } catch {
    return null;
  }
}
