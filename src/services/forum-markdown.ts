import DOMPurify from 'isomorphic-dompurify';
import { Marked } from 'marked';
const markdown = new Marked({
  breaks: true,
  extensions: [
    {
      name: 'spoiler',
      level: 'inline',
      start(source) {
        return source.indexOf('||');
      },
      tokenizer(source) {
        const match = /^\|\|([^\n]+?)\|\|/.exec(source);
        if (match)
          return { type: 'spoiler', raw: match[0], tokens: this.lexer.inlineTokens(match[1]!) };
      },
      renderer(token) {
        return `<details class="forum-spoiler"><summary>Revelar spoiler</summary>${this.parser.parseInline(token.tokens!)}</details>`;
      },
    },
  ],
});
export function forumMarkdown(source: string): string {
  return DOMPurify.sanitize(markdown.parse(source, { async: false }), {
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
      'details',
      'summary',
    ],
    ALLOWED_ATTR: ['href', 'title', 'class'],
    ALLOW_DATA_ATTR: false,
  });
}
