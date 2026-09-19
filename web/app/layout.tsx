import type { Metadata } from 'next';
import { SITE_NAME, SITE_TAGLINE } from '@/lib/tools';
import './globals.css';

/**
 * `metadataBase` makes every page's Open Graph URL absolute. Set it to the
 * real domain before launch — relative OG images are ignored by most crawlers.
 */
export const metadata: Metadata = {
  metadataBase: new URL('https://sizefit.app'),
  title: {
    default: `${SITE_NAME} — compress an image or PDF to an exact file size`,
    template: `%s`,
  },
  description: SITE_TAGLINE,
  applicationName: SITE_NAME,
  robots: { index: true, follow: true },
  openGraph: { type: 'website', siteName: SITE_NAME },
  twitter: { card: 'summary' },
};

export const viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F4EFE7' },
    { media: '(prefers-color-scheme: dark)', color: '#141210' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
