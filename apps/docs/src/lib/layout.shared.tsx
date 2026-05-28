import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { MonitorPlay } from 'lucide-react';

import { Logo } from '@/components/logo';

import { gitConfig } from './shared';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: <Logo />,
    },
    links: [
      {
        type: 'icon',
        text: 'Demo',
        icon: <MonitorPlay />,
        url: 'https://ag2b-example.vercel.app',
        external: true,
      },
    ],
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
  };
}
