import { RootProvider } from 'fumadocs-ui/provider/next';
import { Inter } from 'next/font/google';

import { Body } from './layout.client';

import './global.css';

const inter = Inter({
  subsets: ['latin'],
});

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <Body className="flex flex-col min-h-screen">
        <RootProvider>{children}</RootProvider>
      </Body>
    </html>
  );
}
