/**
 * The tool catalogue: one entry per URL.
 *
 * This is the single source for the navigation, the home grid, the sitemap and
 * each page's metadata, so a new tool cannot end up listed in one place and
 * missing from another.
 */
export interface Tool {
  slug: string;
  /** Short label, for navigation and cards. */
  name: string;
  /** The <h1> and <title> subject — written the way people search. */
  heading: string;
  title: string;
  description: string;
  /** One line under the card. */
  blurb: string;
  icon: 'image' | 'pdf' | 'stack' | 'crop';
}

export const SITE_NAME = 'SizeFit';
export const SITE_TAGLINE = 'Hit the exact file size a form demands — without going one byte over.';

export const tools: Tool[] = [
  {
    slug: 'compress-image',
    name: 'Compress image',
    heading: 'Compress an image to an exact file size',
    title: 'Compress Image to Exact KB Size — 20KB, 50KB, 100KB | SizeFit',
    description:
      'Compress a JPG or PNG to the exact KB size a form asks for — 20KB, 50KB, under 100KB — without ever going over the limit. Free, no sign-up, and nothing is uploaded.',
    blurb: 'Give it a size in KB and it lands inside it, never over.',
    icon: 'image',
  },
  {
    slug: 'compress-pdf',
    name: 'Compress PDF',
    heading: 'Compress a PDF to a target size',
    title: 'Compress PDF to a Target Size — Free, In Your Browser | SizeFit',
    description:
      'Shrink a scanned PDF under a size limit while the text stays sharp and selectable. Runs entirely in your browser — your document is never uploaded.',
    blurb: 'Shrink a scan under a limit, with text left sharp.',
    icon: 'pdf',
  },
  {
    slug: 'image-to-pdf',
    name: 'Image to PDF',
    heading: 'Turn images into one PDF',
    title: 'Convert Images to PDF Under a Size Limit | SizeFit',
    description:
      'Combine JPG or PNG photos into a single PDF that fits under the size limit a form allows. Pick A4 or page-per-image. Nothing leaves your device.',
    blurb: 'Several photos into one PDF that fits the limit.',
    icon: 'stack',
  },
  {
    slug: 'resize-image',
    name: 'Resize image',
    heading: 'Resize an image to exact pixel dimensions',
    title: 'Resize Image to Exact Pixels — Passport Photo, Signature | SizeFit',
    description:
      'Resize a photo to the exact pixel size a form demands — 200×230 passport photo, 140×60 signature, 240×240 thumb impression — cropped to fit, never squashed.',
    blurb: 'Exact pixel sizes, cropped to fit rather than squashed.',
    icon: 'crop',
  },
];

export function toolBySlug(slug: string): Tool {
  const tool = tools.find((candidate) => candidate.slug === slug);
  if (!tool) throw new Error(`Unknown tool: ${slug}`);
  return tool;
}
