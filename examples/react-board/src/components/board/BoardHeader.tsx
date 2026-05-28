import { buttonVariants, Link } from '@heroui/react';
import { BookOpen, Star } from 'lucide-react';

import { ProviderSummary } from '../provider/ProviderSummary';

type BoardHeaderProps = {
  onEditProvider: () => void;
};

function GithubMark({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 .5C5.37.5 0 5.78 0 12.29c0 5.2 3.44 9.6 8.21 11.16.6.11.82-.25.82-.56 0-.28-.01-1.02-.02-2-3.34.71-4.04-1.58-4.04-1.58-.55-1.37-1.33-1.74-1.33-1.74-1.09-.73.08-.72.08-.72 1.2.08 1.83 1.21 1.83 1.21 1.07 1.79 2.81 1.27 3.5.97.11-.76.42-1.27.76-1.56-2.67-.3-5.47-1.31-5.47-5.83 0-1.29.47-2.34 1.24-3.17-.12-.3-.54-1.52.12-3.16 0 0 1.01-.32 3.3 1.21.96-.26 1.98-.39 3-.4 1.02 0 2.04.14 3 .4 2.28-1.53 3.29-1.21 3.29-1.21.66 1.64.24 2.86.12 3.16.77.83 1.24 1.88 1.24 3.17 0 4.53-2.81 5.53-5.49 5.82.43.36.81 1.09.81 2.2 0 1.59-.01 2.87-.01 3.26 0 .31.21.68.83.56C20.57 21.88 24 17.49 24 12.29 24 5.78 18.63.5 12 .5z" />
    </svg>
  );
}

export function BoardHeader({ onEditProvider }: BoardHeaderProps) {
  return (
    <header className="flex items-center justify-between border-b border-neutral-800 pb-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">AG2B Example</h1>
        <ProviderSummary onEdit={onEditProvider} />
      </div>
      <div className="flex items-center gap-2">
        <Link
          href="https://ag2b.ai"
          target="_blank"
          rel="noreferrer"
          aria-label="Read the AG2B docs"
          className={buttonVariants({ variant: 'outline', size: 'md' })}
        >
          <BookOpen size={16} className="mr-2 -ml-0.5" />
          Docs
        </Link>
        <Link
          href="https://github.com/ag2b/ag2b"
          target="_blank"
          rel="noreferrer"
          aria-label="Star ag2b on GitHub"
          className={`group ${buttonVariants({ variant: 'outline', size: 'md' })}`}
        >
          <GithubMark size={16} className="mr-2 -ml-0.5" />
          Star on GitHub
          <Star
            size={14}
            className="ml-2 text-neutral-500 transition-colors group-hover:fill-amber-400 group-hover:text-amber-400"
          />
        </Link>
      </div>
    </header>
  );
}
