import { status, text, ValidationError } from './validation.ts';
import type { GameStatus } from './model.ts';

export const CONSOLE_PLATFORMS = {
  PlayStation: [
    'PlayStation',
    'PlayStation 2',
    'PlayStation 3',
    'PlayStation 4',
    'PlayStation 5',
    'PSP',
    'PlayStation Vita',
  ],
  Xbox: ['Xbox', 'Xbox 360', 'Xbox One', 'Xbox Series X|S'],
} as const;
export type ConsoleSource = keyof typeof CONSOLE_PLATFORMS;
export interface ConsoleRow {
  title: string;
  platform: string;
  hours: number;
  status: GameStatus;
  progress?: import('./console-progress.ts').ConsoleProgress;
}
export function consoleSource(value: unknown): ConsoleSource {
  if (value !== 'PlayStation' && value !== 'Xbox') throw new ValidationError('Consola inválida.');
  return value;
}
export function consoleIdentity(value: unknown): string | null {
  if (value === null || value === '') return null;
  const id = text(value, 'Identificador de consola', 30, 3);
  if (
    /[<>]/.test(id) ||
    [...id].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
  )
    throw new ValidationError('Identificador de consola inválido.');
  return id;
}
function key(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}
export function consolePlatform(value: unknown, source: ConsoleSource): string {
  const input = text(value, 'Plataforma', 100);
  const aliases: Record<string, string> = {
    ps1: 'PlayStation',
    ps2: 'PlayStation 2',
    ps3: 'PlayStation 3',
    ps4: 'PlayStation 4',
    ps5: 'PlayStation 5',
    psvita: 'PlayStation Vita',
    xboxseries: 'Xbox Series X|S',
    xboxseriesx: 'Xbox Series X|S',
    xboxseriess: 'Xbox Series X|S',
    xboxseriesxs: 'Xbox Series X|S',
  };
  const found =
    CONSOLE_PLATFORMS[source].find((platform) => key(platform) === key(input)) ??
    aliases[key(input)];
  if (!found || !(CONSOLE_PLATFORMS[source] as readonly string[]).includes(found))
    throw new ValidationError(`Plataforma incompatible con ${source}: ${input}.`);
  return found;
}
export function consoleHours(value: unknown): number {
  const numeric =
    typeof value === 'string' && /^\d+(?:[.,]\d+)?$/.test(value.trim())
      ? Number(value.trim().replace(',', '.'))
      : value;
  if (typeof numeric !== 'number' || !Number.isFinite(numeric) || numeric < 0 || numeric > 100000)
    throw new ValidationError('Horas: usa un número entre 0 y 100000.');
  return Math.round(numeric * 100) / 100;
}
export function applyBulkHours<T extends { selected: boolean; done: boolean; hours: number }>(
  rows: T[],
  value: unknown,
): T[] {
  const hours = consoleHours(value);
  return rows.map((row) => (row.selected && !row.done ? { ...row, hours } : row));
}
function importStatus(value: unknown, hours: number): GameStatus {
  if (value === undefined || value === null || value === '')
    return hours > 0 ? 'playing' : 'backlog';
  const aliases: Record<string, GameStatus> = {
    completed: 'cleared',
    finished: 'cleared',
    abandoned: 'dropped',
    terminado: 'cleared',
  };
  const input = text(value, 'Estado', 30).toLowerCase();
  return status(aliases[input] ?? input);
}
function csv(content: string): string[][] {
  const firstLine = content.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = firstLine.includes(';') ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [],
    cell = '',
    quoted = false;
  for (let i = 0; i < content.length; i++) {
    const char = content[i]!;
    if (char === '"') {
      if (quoted && content[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (quoted || !cell.trim()) quoted = !quoted;
      else throw new ValidationError('CSV: comillas inválidas.');
    } else if (char === delimiter && !quoted) {
      row.push(cell.trim());
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && content[i + 1] === '\n') i++;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = '';
    } else cell += char;
  }
  if (quoted) throw new ValidationError('CSV: faltan cerrar comillas.');
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}
export function parseConsoleImport(
  input: unknown,
  format: unknown,
  source: ConsoleSource,
  defaultPlatform: unknown,
): ConsoleRow[] {
  const content = text(input, 'Exportación', 200000).replace(/^\uFEFF/, '');
  const fallback = consolePlatform(defaultPlatform, source);
  let values: unknown[];
  if (format === 'text')
    values = content
      .split(/\r?\n/)
      .filter((line) => line.trim())
      .map((line) => ({ title: line.trim() }));
  else if (format === 'json') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new ValidationError('Archivo JSON inválido.');
    }
    if (Array.isArray(parsed)) values = parsed;
    else if (
      parsed &&
      typeof parsed === 'object' &&
      'games' in parsed &&
      Array.isArray(parsed.games)
    )
      values = parsed.games;
    else throw new ValidationError('JSON: usa un array de juegos o un objeto con games.');
  } else if (format === 'csv') {
    const rows = csv(content);
    const headers = rows.shift()?.map(key) ?? [];
    if (
      !headers.some((header) =>
        ['title', 'name', 'game', 'gamename', 'nombre', 'titulo'].includes(header),
      )
    )
      throw new ValidationError('CSV: falta la columna title, name o título.');
    if (new Set(headers).size !== headers.length)
      throw new ValidationError('CSV: columnas duplicadas.');
    values = rows.map((row) => {
      if (row.length !== headers.length)
        throw new ValidationError('CSV: cantidad de columnas inconsistente.');
      return Object.fromEntries(headers.map((header, index) => [header, row[index]]));
    });
  } else throw new ValidationError('Formato no admitido.');
  if (!values.length || values.length > 200)
    throw new ValidationError('Importa entre 1 y 200 juegos por archivo.');
  const result = values.map((value, index) => {
    try {
      const fields = typeof value === 'string' ? { title: value } : value;
      if (!fields || typeof fields !== 'object' || Array.isArray(fields))
        throw new ValidationError('Fila inválida.');
      const data = Object.fromEntries(
        Object.entries(fields).map(([name, field]) => [key(name), field]),
      );
      const title = text(
        data.title ?? data.name ?? data.game ?? data.gamename ?? data.nombre ?? data.titulo,
        'Título',
        200,
      );
      const rawHours = data.hours ?? data.hoursplayed ?? data.playtimehours ?? data.horas;
      const hours =
        rawHours !== undefined && rawHours !== ''
          ? consoleHours(rawHours)
          : data.minutes !== undefined
            ? consoleHours(consoleHours(data.minutes) / 60)
            : 0;
      return {
        title,
        hours,
        platform: consolePlatform(data.platform || data.plataforma || fallback, source),
        status: importStatus(data.status, hours),
      };
    } catch (error) {
      throw new ValidationError(
        `Fila ${index + 1}: ${error instanceof Error ? error.message : 'Datos inválidos.'}`,
      );
    }
  });
  const unique = new Map<string, ConsoleRow>();
  for (const row of result) {
    const identity = `${row.title.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ')}:${row.platform}`;
    if (!unique.has(identity)) unique.set(identity, row);
  }
  return [...unique.values()];
}
