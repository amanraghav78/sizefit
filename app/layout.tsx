import type { Metadata } from 'next';
import { Fredoka, Outfit } from 'next/font/google';
import { INDEXABLE, SITE_URL } from '@/lib/site';
import { SITE_NAME, SITE_TAGLINE } from '@/lib/tools';
import './globals.css';

/**
 * The two faces the design calls for. Loaded through next/font so they are
 * self-hosted and preloaded rather than fetched from Google at runtime: no
 * third-party request, and no flash of fallback text on a slow connection.
 *
 * Both are variable fonts, so no weight list is given — every weight between
 * 300 and 700 comes from the one file, and asking for a subset would cost a
 * download per weight instead.
 *
 * Each carries a fallback of close metrics, so the layout does not jump if a
 * face fails to load at all.
 */
const display = Fredoka({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  fallback: ['Trebuchet MS', 'Segoe UI', 'sans-serif'],
});

const body = Outfit({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
  fallback: ['Helvetica Neue', 'Arial', 'sans-serif'],
});

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
  themeColor: '#FFF4E8',
  colorScheme: 'light',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
