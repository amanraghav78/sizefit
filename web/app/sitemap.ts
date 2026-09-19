import type { MetadataRoute } from 'next';
import { tools } from '@/lib/tools';

/**
 * Generated from the tool catalogue, so a new tool cannot be added to the site
 * and forgotten here.
 *
 * Change SITE_URL to the real domain before launch — a sitemap listing the
 * wrong host is worse than none at all.
 */
export const SITE_URL = 'https://sizefit.app';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: 'monthly', priority: 1 },
    ...tools.map((tool) => ({
      url: `${SITE_URL}/${tool.slug}/`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.9,
    })),
  ];
}
