import { TAG_BG } from '../domain/tag-colors';
import type { Person } from '../domain/types';

type Size = 'sm' | 'md';

type PersonAvatarProps = {
  person: Person;
  size?: Size;
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: 'h-5 w-5 text-[10px]',
  md: 'h-7 w-7 text-xs',
};

export function PersonAvatar({ person, size = 'sm' }: PersonAvatarProps) {
  return (
    <span
      title={person.name}
      className={[
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white',
        TAG_BG[person.color],
        SIZE_CLASSES[size],
      ].join(' ')}
    >
      {person.initials}
    </span>
  );
}
