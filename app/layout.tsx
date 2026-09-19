import type { Metadata } from 'next';
import { INDEXABLE, SITE_URL } from '@/lib/site';
import { SITE_NAME, SITE_TAGLINE } from '@/lib/tools';
import './globals.css';

/**
 * `metadataBase` makes every page's canonical and Open Graph URLs absolute.
 * The host is resolved from the environment rather than written in — see
 * lib/site.ts — so a .vercel.app deployment is correct today and a real domain
 * is one environment variable away.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — compress an image or PDF to an exact file size`,
    template: `%s`,
  },
  description: SITE_TAGLINE,
  applicationName: SITE_NAME,
  robots: { index: INDEXABLE, follow: INDEXABLE },
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
