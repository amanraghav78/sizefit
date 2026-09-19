import type { MetadataRoute } from 'next';
import { INDEXABLE, SITE_URL } from '@/lib/site';

export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  if (!INDEXABLE) {
    // A preview deployment: keep it out of the index entirely.
    return { rules: { userAgent: '*', disallow: '/' } };
  }
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
