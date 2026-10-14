import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const footer = read('src/app/layout.tsx').replaceAll('&apos;', "'").replace(/\s+/g, ' ');
const terms = read('src/app/terms/page.tsx');
const privacy = read('src/app/privacy/page.tsx');
test('Global footer includes the exact Riot notice and Valve non-affiliation', () => {
  assert.ok(
    footer.includes(
      "SaveState isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games and all associated properties are trademarks or registered trademarks of Riot Games, Inc.",
    ),
  );
  assert.match(footer, /Steam y el logotipo de Steam son marcas comerciales/);
  assert.match(
    footer,
    /SaveState no está afiliado, respaldado ni patrocinado por Valve Corporation/,
  );
  for (const path of ['/terms', '/privacy']) assert.ok(footer.includes(`href="${path}"`));
});
test('Public legal pages describe ARCO, the correct Chilean reform and actionable notice-and-takedown', () => {
  assert.match(privacy, /19\.628/);
  assert.match(privacy, /21\.719/);
  assert.doesNotMatch(privacy, /21\.696/);
  assert.match(privacy, /1 de diciembre de 2026/);
  for (const word of [
    'Acceso',
    'Rectificación',
    'Cancelación',
    'Oposición',
    'supresión',
    'RLS',
    'cookies',
    'Discord',
  ])
    assert.ok(privacy.includes(word));
  assert.match(terms, /Notice and Takedown/);
  assert.match(terms, /20\.435/);
  assert.match(terms, /17 U\.S\.C\. § 512/);
  for (const page of [terms, privacy]) {
    assert.ok(page.includes('<LegalContact />'));
    assert.match(page, /export const metadata/);
    assert.match(page, /<h1>/);
    assert.doesNotMatch(page, /authenticated\(|currentUser\(|redirect\(/);
  }
  const contact = read('src/components/legal-contact.tsx');
  assert.match(contact, /savestate\.contacto@proton\.me/);
  assert.match(contact, /mailto:/);
  assert.match(terms, /URLs concretas/);
  assert.match(terms, /buena fe/);
});
