import { Colors } from '@/src/constants/colors';

export type MuscleTone = {
  bar: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
};

export function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');
  const value = normalized.length === 3
    ? normalized.split('').map((char) => char + char).join('')
    : normalized;
  if (value.length !== 6) return `rgba(232, 255, 90, ${alpha})`;
  const intValue = Number.parseInt(value, 16);
  const r = (intValue >> 16) & 255;
  const g = (intValue >> 8) & 255;
  const b = intValue & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function getGroupAccent(groupColor?: string | null) {
  return groupColor && groupColor.trim() ? groupColor : Colors.accent;
}

export function getGroupTone(groupColor?: string | null): MuscleTone {
  const accent = getGroupAccent(groupColor);
  return {
    bar: accent,
    badgeBg: hexToRgba(accent, 0.14),
    badgeBorder: hexToRgba(accent, 0.35),
    badgeText: accent,
  };
}
