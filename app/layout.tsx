import type { Metadata } from 'next';
import { Bricolage_Grotesque, Space_Grotesk, Space_Mono } from 'next/font/google';
import { INDEXABLE, SITE_URL } from '@/lib/site';
import { SITE_NAME, SITE_TAGLINE } from '@/lib/tools';
import './globals.css';

/**
 * The three faces the design calls for. Loaded through next/font so they are
 * self-hosted and preloaded rather than fetched from Google at runtime: no
 * third-party request, and no flash of fallback text on a slow connection.
 *
 * Each carries a fallback of close metrics, so the layout does not jump if a
 * face fails to load at all.
 */
const display = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
  fallback: ['Trebuchet MS', 'Segoe UI', 'sans-serif'],
});

const body = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-body',
  display: 'swap',
  fallback: ['Helvetica Neue', 'Arial', 'sans-serif'],
});

const mono = Space_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-mono',
  display: 'swap',
  fallback: ['Courier New', 'monospace'],
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
  themeColor: '#14120E',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
