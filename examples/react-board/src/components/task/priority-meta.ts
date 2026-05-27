import type { LucideIcon } from 'lucide-react';
import { ChevronDown, ChevronsUp, ChevronUp } from 'lucide-react';

import type { Priority } from '../../domain/types';

export const PRIORITY_META: Record<Priority, { icon: LucideIcon; color: string }> = {
  low: { icon: ChevronDown, color: 'text-sky-400' },
  medium: { icon: ChevronUp, color: 'text-amber-400' },
  high: { icon: ChevronsUp, color: 'text-rose-400' },
};
