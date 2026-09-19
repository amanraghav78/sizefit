import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';
import { tools } from '@/lib/tools';

/**
 * Generated from the tool catalogue, so a new tool cannot be added to the site
 * and forgotten here. The host comes from the environment — see lib/site.ts.
 */
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
