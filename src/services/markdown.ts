import DOMPurify from 'isomorphic-dompurify';
import { marked } from 'marked';
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p',
      'br',
      'strong',
      'em',
      'ul',
      'ol',
      'li',
      'blockquote',
      'code',
      'pre',
      'a',
      'h2',
      'h3',
      'hr',
      'del',
    ],
    ALLOWED_ATTR: ['href', 'title'],
    ALLOW_DATA_ATTR: false,
  });
}
export function cleanMarkdown(source: string) {
  return DOMPurify.sanitize(source, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
}
export function renderMarkdown(source: string): string {
  return sanitizeHtml(marked.parse(cleanMarkdown(source), { async: false, breaks: true }));
}
