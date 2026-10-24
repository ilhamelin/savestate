import type { DefconLevel } from './threat-shield';
import { object, text, ValidationError } from './validation.ts';
export interface SystemSwitches {
  defcon_level: DefconLevel;
  gatekeeper_enabled: boolean;
  registrations_open: boolean;
  double_xp: boolean;
  seasonal_theme: 'halloween' | 'classic';
}
export interface SystemBroadcast {
  id: string;
  message: string;
  category: 'info' | 'warning' | 'event';
  created_at: string;
}
export const DEFAULT_SYSTEM_SWITCHES: SystemSwitches = {
  defcon_level: 5,
  gatekeeper_enabled: false,
  registrations_open: true,
  double_xp: false,
  seasonal_theme: 'halloween',
};
export function systemSwitchInput(raw: unknown) {
  const input = object(raw);
  const key = input.key;
  if (key === 'seasonal_theme' && (input.value === 'halloween' || input.value === 'classic'))
    return { key, value: input.value };
  if (
    (key === 'gatekeeper_enabled' || key === 'registrations_open' || key === 'double_xp') &&
    typeof input.value === 'boolean'
  )
    return { key, value: input.value };
  throw new ValidationError('Interruptor o valor no válido.');
}
export function broadcastInput(raw: unknown): {
  active: boolean;
  message: string;
  category: SystemBroadcast['category'];
  notifyDiscord: boolean;
} {
  const input = object(raw);
  if (
    typeof input.active !== 'boolean' ||
    (input.notifyDiscord !== undefined && typeof input.notifyDiscord !== 'boolean')
  )
    throw new ValidationError('Estado de alerta no válido.');
  if (!input.active)
    return { active: false, message: '', category: 'info' as const, notifyDiscord: false };
  const category = input.category;
  if (category !== 'info' && category !== 'warning' && category !== 'event')
    throw new ValidationError('Categoría no válida.');
  return {
    active: true,
    message: text(input.message, 'Mensaje', 240),
    category,
    notifyDiscord: input.notifyDiscord === true,
  };
}
export function guardianXp(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isInteger(raw) || raw <= 0 || raw > 100000)
    throw new ValidationError('La XP debe ser un entero entre 1 y 100000.');
  return raw;
}
