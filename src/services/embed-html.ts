import DOMPurify from 'isomorphic-dompurify';
export function sanitizeEmbedHtml(html: string) {
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['blockquote', 'p', 'a', 'br', 'strong', 'em', 'span', 'div'],
    ALLOWED_ATTR: ['href', 'title'],
    ALLOW_DATA_ATTR: false,
  });
  // Every external link opens separately; no provider scripts or arbitrary images execute here.
  return clean.replace(/<a\b([^>]*)>/g, '<a$1 target="_blank" rel="noopener noreferrer">');
}
