import { SiReact, SiVuedotjs } from '@icons-pack/react-simple-icons';
import { docs } from 'collections/server';
import { loader } from 'fumadocs-core/source';
import { icons } from 'lucide-react';
import React from 'react';

import { docsContentRoute, docsImageRoute, docsRoute } from './shared';

// See https://fumadocs.dev/docs/headless/source-api for more info
export const source = loader({
  baseUrl: docsRoute,
  source: docs.toFumadocsSource(),
  icon: (name) => {
    if (name === 'React') return <SiReact />;
    if (name === 'Vue') return <SiVuedotjs />;
    // @ts-expect-error assume that icons available in lucide-react
    if (name && name in icons) return React.createElement(icons[name]);
  },
});

export function getPageImage(page: (typeof source)['$inferPage']) {
  const segments = [...page.slugs, 'image.png'];

  return {
    segments,
    url: `${docsImageRoute}/${segments.join('/')}`,
  };
}

export function getPageMarkdownUrl(page: (typeof source)['$inferPage']) {
  const segments = [...page.slugs, 'content.md'];

  return {
    segments,
    url: `${docsContentRoute}/${segments.join('/')}`,
  };
}

export async function getLLMText(page: (typeof source)['$inferPage']) {
  const processed = await page.data.getText('processed');

  return `# ${page.data.title} (${page.url})

${processed}`;
}

export function getSection(path: string | undefined) {
  if (!path) return 'core';
  const [dir] = path.split('/', 1);
  if (!dir) return 'core';

  return (
    {
      react: 'react',
      vue: 'vue',
    }[dir] ?? 'core'
  );
}
