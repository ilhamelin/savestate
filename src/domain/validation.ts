import { GAME_STATUSES, REACTIONS, type GameStatus, type Reaction } from './model.ts';

export class ValidationError extends Error {
  constructor(message: string) { super(message); this.name = 'ValidationError'; }
}
export function object(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ValidationError('Se esperaba un objeto.');
  return input as Record<string, unknown>;
}
export function text(input: unknown, label: string, max = 200, min = 1): string {
  if (typeof input !== 'string') throw new ValidationError(`${label}: texto requerido.`);
  const value = input.trim();
  if (value.length < min || value.length > max) throw new ValidationError(`${label}: debe tener entre ${min} y ${max} caracteres.`);
  return value;
}
export function uuid(input: unknown): string {
  const value = text(input, 'Identificador', 36);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new ValidationError('Identificador inválido.');
  return value;
}
export function rating(input: unknown, required = false): number | null {
  if (input === null || input === undefined || input === '') {
    if (required) throw new ValidationError('Selecciona una puntuación.');
    return null;
  }
  if (typeof input !== 'number' || !Number.isFinite(input) || input < 1 || input > 10 || !Number.isInteger(input * 2)) throw new ValidationError('La nota debe estar entre 1 y 10, con incrementos de 0.5.');
  return input;
}
export function status(input: unknown): GameStatus {
  if (!GAME_STATUSES.includes(input as GameStatus)) throw new ValidationError('Estado de biblioteca inválido.');
  return input as GameStatus;
}
export function reaction(input: unknown): Reaction {
  if (!REACTIONS.includes(input as Reaction)) throw new ValidationError('Reacción inválida.');
  return input as Reaction;
}
export function bool(input: unknown, label: string): boolean {
  if (typeof input !== 'boolean') throw new ValidationError(`${label}: confirma tu elección.`);
  return input;
}
export function date(input: unknown): string | null {
  if (input === null || input === undefined || input === '') return null;
  const value = text(input, 'Fecha', 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new ValidationError('Fecha inválida.');
  return value;
}
export function validatePlayLog(input: unknown) {
  const data = object(input);
  const start = date(data.start_date), finish = date(data.finish_date);
  if (start && finish && finish < start) throw new ValidationError('La fecha de fin no puede preceder al inicio.');
  if (typeof data.hours_played !== 'number' || !Number.isFinite(data.hours_played) || data.hours_played < 0 || data.hours_played > 100000) throw new ValidationError('Horas inválidas.');
  if (!['hardware', 'emulator', 'other'].includes(String(data.play_method))) throw new ValidationError('Método de juego inválido.');
  return {
    user_game_id: uuid(data.user_game_id), platform_played: text(data.platform_played, 'Plataforma', 100),
    play_method: data.play_method as 'hardware' | 'emulator' | 'other', difficulty: text(data.difficulty ?? '', 'Dificultad', 80, 0),
    hours_played: data.hours_played, start_date: start, finish_date: finish, note: text(data.note ?? '', 'Nota', 2000, 0),
  };
}
export function favorites(input: unknown): string[] {
  if (!Array.isArray(input) || input.length > 4) throw new ValidationError('Puedes fijar hasta cuatro juegos.');
  const ids = input.map(uuid);
  if (new Set(ids).size !== ids.length) throw new ValidationError('Los favoritos no pueden repetirse.');
  return ids;
}
export function username(input: unknown): string {
  const value = text(input, 'Nombre de usuario', 30, 3);
  if (!/^[a-zA-Z0-9_]+$/.test(value)) throw new ValidationError('Usa letras, números y guion bajo.');
  return value;
}
export function socialLinks(input: unknown): Record<string, string> {
  const data = object(input);
  const hosts: Record<string, string[]> = {
    steam: ['steamcommunity.com'], discord: ['discord.com', 'discord.gg'], twitch: ['twitch.tv'], github: ['github.com'], x: ['x.com', 'twitter.com'],
  };
  const result: Record<string, string> = {};
  for (const [key, raw] of Object.entries(data)) {
    if (!hosts[key]) throw new ValidationError('Red social no permitida.');
    if (raw === '') continue;
    let url: URL;
    try { url = new URL(text(raw, 'Enlace', 300)); } catch { throw new ValidationError('Enlace inválido.'); }
    const host = url.hostname.replace(/^www\./, '');
    if (url.protocol !== 'https:' || url.username || url.password || !hosts[key]!.includes(host)) throw new ValidationError('El enlace debe ser HTTPS y pertenecer a la red indicada.');
    result[key] = url.toString();
  }
  return result;
}
export function safeNext(input: string | null): string {
  return input && input.startsWith('/') && !input.startsWith('//') && !/[\\\r\n]/.test(input) ? input : '/library';
}
