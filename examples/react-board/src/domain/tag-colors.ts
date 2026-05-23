import type { TagColor } from './types';

export const TAG_COLORS: readonly TagColor[] = [
  'rose',
  'amber',
  'emerald',
  'sky',
  'violet',
  'fuchsia',
  'neutral',
  'orange',
];

// Tailwind class fragments for each color. Keep them as plain strings (NOT
// template-built) so the Tailwind v4 scanner can discover every class.
export const TAG_BG: Record<TagColor, string> = {
  rose: 'bg-rose-500',
  amber: 'bg-amber-500',
  emerald: 'bg-emerald-500',
  sky: 'bg-sky-500',
  violet: 'bg-violet-500',
  fuchsia: 'bg-fuchsia-500',
  neutral: 'bg-neutral-500',
  orange: 'bg-orange-500',
};

export const TAG_TEXT: Record<TagColor, string> = {
  rose: 'text-rose-400',
  amber: 'text-amber-400',
  emerald: 'text-emerald-400',
  sky: 'text-sky-400',
  violet: 'text-violet-400',
  fuchsia: 'text-fuchsia-400',
  neutral: 'text-neutral-400',
  orange: 'text-orange-400',
};

// Used for the "selected swatch" outline in pickers.
export const TAG_RING: Record<TagColor, string> = {
  rose: 'ring-rose-400',
  amber: 'ring-amber-400',
  emerald: 'ring-emerald-400',
  sky: 'ring-sky-400',
  violet: 'ring-violet-400',
  fuchsia: 'ring-fuchsia-400',
  neutral: 'ring-neutral-400',
  orange: 'ring-orange-400',
};
