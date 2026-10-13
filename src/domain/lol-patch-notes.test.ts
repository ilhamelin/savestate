import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzePatchStatChange,
  summarizeStatDirections,
  formatBugfixRichText,
} from './lol-patch-notes.ts';
test('Patch stat semantics compare decimal commas, ranges, scalings and inverse attributes', () => {
  const cases = [
    ['Daño: 5 - 30 (+25 % del DA adicional) ⇒ 5 - 25 (+20 % del DA adicional).', 'nerf'],
    ['Daño de ataque por nivel: 3,5 ⇒ 3.', 'nerf'],
    ['Relación de poder de habilidad de los meeps: 50 % ⇒ 67 %.', 'buff'],
    ['Enfriamiento de la W: 22-12 ⇒ 18-12.', 'buff'],
    ['Daño recibido: 105 % ⇒ 108 %.', 'nerf'],
    ['Escudo: 20/30/40 -> 30/40/50', 'buff'],
    ['Daño: 10/20 ⇒ 15/15', 'adjust'],
    ['Daño: 10 ⇒ 10', 'adjust'],
    ['Daño: 10/20 ⇒ 20', 'adjust'],
    ['Recarga: 8 s ⇒ 5 s', 'buff'],
    ['Coste: 50 ⇒ 60', 'nerf'],
    ['Modificador: -5 ⇒ -3', 'buff'],
    ['Objetivo: uno ⇒ todos', 'adjust'],
  ] as const;
  for (const [line, expected] of cases)
    assert.equal(analyzePatchStatChange(line).direction, expected, line);
  const row = analyzePatchStatChange(cases[0][0]);
  assert.equal(row.raw, cases[0][0]);
  assert.equal(row.label, 'Daño');
  assert.equal(row.before, '5 - 30 (+25 % del DA adicional)');
  assert.equal(row.after, '5 - 25 (+20 % del DA adicional).');
});
test('New and removed mechanics remain explicit and mixed champion changes stay neutral', () => {
  assert.deepEqual(analyzePatchStatChange('Nuevo: efecto al impactar'), {
    raw: 'Nuevo: efecto al impactar',
    label: 'Nuevo',
    before: null,
    after: 'efecto al impactar',
    direction: 'new',
  });
  assert.equal(analyzePatchStatChange('Añadido escudo').direction, 'new');
  assert.equal(analyzePatchStatChange('Agregado: efecto').direction, 'new');
  assert.equal(analyzePatchStatChange('Eliminado: daño adicional').before, 'daño adicional');
  assert.equal(analyzePatchStatChange('Eliminado: daño adicional').direction, 'removed');
  assert.equal(
    analyzePatchStatChange('Nueva funcionalidad descrita sin valores.').direction,
    'adjust',
  );
  assert.equal(analyzePatchStatChange('').direction, 'adjust');
  assert.equal(
    summarizeStatDirections(['Daño: 5 ⇒ 10', 'Vida: 100 ⇒ 120', 'Enfriamiento: 5 ⇒ 6']),
    'buff',
  );
  assert.equal(summarizeStatDirections(['Daño: 10 ⇒ 5', 'Nuevo: escudo']), 'adjust');
  assert.equal(summarizeStatDirections(['Eliminado: escudo']), 'nerf');
  assert.equal(summarizeStatDirections([]), 'adjust');
});
test('Bugfix rich text preserves exact prose and highlights only ability mentions safely', () => {
  for (const prefix of [
    'Hemos corregido un error que provocaba que ',
    'Hemos corregido un error que impedía que ',
    'Hemos corregido un error por el que ',
  ]) {
    const text = prefix + 'la Q de Ahri (Pasiva) y (R) no funcionasen.';
    const parts = formatBugfixRichText(text);
    assert.equal(parts.map((p) => p.text).join(''), text);
    assert.equal(parts[0]?.kind, 'prefix');
    assert.deepEqual(
      parts.filter((p) => p.kind === 'key').map((p) => p.text),
      ['la Q de', '(Pasiva)', '(R)'],
    );
  }
  const unsafe = '<img src=x onerror=alert(1)> Sin tecla (Z).';
  assert.deepEqual(formatBugfixRichText(unsafe), [{ text: unsafe, kind: 'text' }]);
});
