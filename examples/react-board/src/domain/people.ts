import type { Person } from './types';

export const PEOPLE: readonly Person[] = [
  { id: 'p1', name: 'Alice', initials: 'A', color: 'rose' },
  { id: 'p2', name: 'Bob', initials: 'B', color: 'sky' },
  { id: 'p3', name: 'Carol', initials: 'C', color: 'amber' },
  { id: 'p4', name: 'Dan', initials: 'D', color: 'emerald' },
  { id: 'p5', name: 'Eve', initials: 'E', color: 'violet' },
];

export function findPerson(id: string | null | undefined): Person | undefined {
  if (!id) return undefined;
  return PEOPLE.find((p) => p.id === id);
}
