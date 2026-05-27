import { Button } from '@heroui/react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router';

import { TagCreator } from '../components/tag/TagCreator';
import { TagList } from '../components/tag/TagList';

export function Settings() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen w-full bg-neutral-950 text-neutral-100">
      <header className="flex items-center gap-3 border-b border-neutral-800 px-6 py-5 sm:px-8">
        <Button
          variant="ghost"
          size="md"
          isIconOnly
          aria-label="Back to board"
          onPress={() => void navigate('/')}
        >
          <ArrowLeft size={16} />
        </Button>
        <div className="flex flex-col gap-0.5">
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-neutral-400">Manage the tags available to tasks.</p>
        </div>
      </header>
      <main className="flex w-full flex-col gap-8 px-6 py-8 sm:px-8">
        <TagCreator />
        <TagList />
      </main>
    </div>
  );
}
