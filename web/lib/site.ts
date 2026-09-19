/**
 * Where this build thinks it lives.
 *
 * Canonical links and the sitemap have to name an absolute host, and getting
 * it wrong is worse than omitting it — a sitemap pointing at a domain you do
 * not control sends crawlers somewhere else entirely. So the host is resolved
 * at build time instead of being written into the source:
 *
 *   1. NEXT_PUBLIC_SITE_URL, once a real domain exists. Set it in Vercel's
 *      environment variables and nothing else needs to change.
 *   2. Vercel's own production URL, which is what a .vercel.app deployment
 *      gets for free before a domain is bought.
 *   3. localhost, for `next dev`.
 */
function resolve(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, '');

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;

  return 'http://localhost:3000';
}

export const SITE_URL = resolve();

/**
 * Preview deployments must not be indexed.
 *
 * Every push to Vercel gets its own URL. Letting those into a search index
 * splits the site across a dozen near-identical hosts, and the one people find
 * is whichever branch Google happened to crawl. Only the production build
 * invites crawlers.
 */
export const INDEXABLE = process.env.VERCEL_ENV !== 'preview';
