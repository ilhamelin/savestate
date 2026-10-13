export type StatDirection = 'buff' | 'nerf' | 'adjust' | 'new' | 'removed';
export interface ParsedStatChange {
  raw: string;
  label: string;
  before: string | null;
  after: string | null;
  direction: StatDirection;
}
function numbers(text: string): number[] {
  // A hyphen between numbers denotes a range; a leading minus remains a sign.
  const normalized = text.replace(/(\d)\s*[-–]\s*(?=\d)/g, '$1 ').replace(/(\d),(?=\d)/g, '$1.');
  return [...normalized.matchAll(/[+-]?\d+(?:\.\d+)?/g)].map((match) => Number(match[0]));
}
export function analyzePatchStatChange(line: string): ParsedStatChange {
  const raw = line,
    text = line.trim(),
    arrow = /⇒|->/.exec(text);
  if (arrow) {
    const left = text.slice(0, arrow.index).trim(),
      colon = left.indexOf(':');
    const label = colon >= 0 ? left.slice(0, colon).trim() : '';
    const before = (colon >= 0 ? left.slice(colon + 1) : left).trim();
    const after = text.slice(arrow.index + arrow[0].length).trim();
    const previous = numbers(before),
      next = numbers(after);
    let direction: StatDirection = 'adjust';
    if (previous.length > 0 && previous.length === next.length) {
      const deltas = next.map((value, index) => value - previous[index]!);
      const up = deltas.some((value) => value > 0),
        down = deltas.some((value) => value < 0);
      const inverse =
        /enfriamiento|recarga|coste|costo|man[aá]|energ[ií]a necesaria|da[ñn]o recibido|tiempo de|retardo|demora/i.test(
          label,
        );
      if (up && !down) direction = inverse ? 'nerf' : 'buff';
      else if (down && !up) direction = inverse ? 'buff' : 'nerf';
    }
    return { raw, label, before: before || null, after: after || null, direction };
  }
  const added = /^(?:nuevo|añadido|agregado)\b\s*:?\s*/i.exec(text);
  if (added)
    return {
      raw,
      label: 'Nuevo',
      before: null,
      after: text.slice(added[0].length) || null,
      direction: 'new',
    };
  const removed = /^eliminado\b\s*:?\s*/i.exec(text);
  if (removed)
    return {
      raw,
      label: 'Eliminado',
      before: text.slice(removed[0].length) || null,
      after: null,
      direction: 'removed',
    };
  return { raw, label: '', before: null, after: null, direction: 'adjust' };
}
export function summarizeStatDirections(changes: string[]): StatDirection {
  let balance = 0;
  for (const change of changes) {
    const direction = analyzePatchStatChange(change).direction;
    if (direction === 'buff' || direction === 'new') balance++;
    else if (direction === 'nerf' || direction === 'removed') balance--;
  }
  return balance > 0 ? 'buff' : balance < 0 ? 'nerf' : 'adjust';
}
export interface BugfixTextPart {
  text: string;
  kind: 'prefix' | 'key' | 'text';
}
export function formatBugfixRichText(text: string): BugfixTextPart[] {
  const parts: BugfixTextPart[] = [];
  const prefix =
    /^Hemos corregido un error (?:que provocaba que|que impedía que|por el que)\s*/i.exec(
      text,
    )?.[0];
  if (prefix) parts.push({ text: prefix, kind: 'prefix' });
  const body = prefix ? text.slice(prefix.length) : text;
  let cursor = 0;
  for (const match of body.matchAll(/\((?:Q|W|E|R|Pasiva)\)|\bla\s+[QWER]\s+de\b/gi)) {
    if (match.index > cursor) parts.push({ text: body.slice(cursor, match.index), kind: 'text' });
    parts.push({ text: match[0], kind: 'key' });
    cursor = match.index + match[0].length;
  }
  if (cursor < body.length) parts.push({ text: body.slice(cursor), kind: 'text' });
  return parts;
}
