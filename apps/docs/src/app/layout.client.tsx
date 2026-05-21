'use client';

import { useParams } from 'next/navigation';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { getSection } from '@/lib/source';

export function Body({ className, children }: { className?: string; children: ReactNode }) {
  const { slug = [] } = useParams();
  const mode = Array.isArray(slug) ? getSection(slug[0]) : undefined;

  return <body className={cn(mode, className)}>{children}</body>;
}
