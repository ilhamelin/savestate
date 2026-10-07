import test from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown, sanitizeHtml } from '../../src/services/markdown.ts';
test('Markdown: conserva formato y elimina scripts, eventos e imágenes', () => {
  const html = renderMarkdown(
    '**GG**\n\n- RPG\n\n<script>alert(1)</script><img src=x onerror=alert(1)>',
  );
  assert.match(html, /<strong>GG<\/strong>/);
  assert.match(html, /<li>RPG<\/li>/);
  assert.doesNotMatch(html, /<script|<img|onerror/);
});
test('Markdown: neutraliza javascript y SVG en enlace o HTML persistido', () => {
  assert.doesNotMatch(renderMarkdown('[haz clic](javascript:alert%281%29)'), /href="javascript:/i);
  assert.equal(
    sanitizeHtml('<svg onload=alert(1)></svg><p onclick=alert(1)>Hola</p>'),
    '<p>Hola</p>',
  );
});
