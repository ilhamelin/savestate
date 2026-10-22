import type { ReactNode } from 'react';

export type CardShellSkin = 'ps1_memory_card' | 'gameboy_cartridge' | 'atomic_purple';
export interface CardTiltState {
  rotateX: number;
  rotateY: number;
  glareX: number;
  glareY: number;
  isFlipped: boolean;
}
export interface CardQrCode {
  url: string;
  size: number;
  path: string;
}
export interface InteractiveCardProps {
  username: string;
  avatarUrl: string | null;
  clearRate: number;
  hours: number;
  topGames: { id: string; title: string; coverUrl: string | null }[];
  terminalStatus?: string;
  defaultSkin?: CardShellSkin;
  qrCode?: CardQrCode;
  children?: (skin: CardShellSkin) => ReactNode;
}
export const CARD_SHELLS: Record<CardShellSkin, { label: string; plastic: string; ink: string }> = {
  ps1_memory_card: { label: 'Memory Card PS1', plastic: '#acb0bb', ink: '#242631' },
  gameboy_cartridge: { label: 'Cartucho Game Boy', plastic: '#b9b8ac', ink: '#292b2c' },
  atomic_purple: { label: 'Púrpura Atómico', plastic: '#74569e', ink: '#f4eaff' },
};
export function cardTiltForPoint(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  isFlipped = false,
  reducedMotion = false,
): CardTiltState {
  const neutral = { rotateX: 0, rotateY: 0, glareX: 50, glareY: 50, isFlipped };
  if (
    reducedMotion ||
    rect.width <= 0 ||
    rect.height <= 0 ||
    ![clientX, clientY, rect.left, rect.top, rect.width, rect.height].every(Number.isFinite)
  )
    return neutral;
  const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
  return {
    rotateX: (0.5 - y) * 24,
    rotateY: (x - 0.5) * 24,
    glareX: x * 100,
    glareY: y * 100,
    isFlipped,
  };
}
