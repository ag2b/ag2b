import { generate as DefaultImage } from 'fumadocs-ui/og';
import { notFound } from 'next/navigation';
import { ImageResponse } from 'next/og';

import { appName } from '@/lib/shared';
import { getPageImage, getSection, source } from '@/lib/source';

export const revalidate = false;

const sectionColors = {
  core: '#abd483',
  react: '#60dcfb',
  vue: '#33a06f',
} as const;

export async function GET(_req: Request, { params }: RouteContext<'/og/docs/[...slug]'>) {
  const { slug } = await params;
  const pageSlug = slug.slice(0, -1);
  const page = source.getPage(pageSlug);
  if (!page) notFound();

  const section = getSection(pageSlug[0]) as keyof typeof sectionColors;
  const primaryTextColor = sectionColors[section];

  return new ImageResponse(
    <DefaultImage
      title={page.data.title}
      description={page.data.description}
      site={appName}
      primaryColor={`${primaryTextColor}4d`}
      primaryTextColor={primaryTextColor}
    />,
    {
      width: 1200,
      height: 630,
    }
  );
}

export function generateStaticParams() {
  return source.getPages().map((page) => ({
    lang: page.locale,
    slug: getPageImage(page).segments,
  }));
}
